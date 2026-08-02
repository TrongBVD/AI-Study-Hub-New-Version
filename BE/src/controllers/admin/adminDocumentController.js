const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const {
  DOCUMENT_BUCKET,
  WAITING_BUCKET,
  getPagination,
  paginationPayload,
} = require("./adminHelpers");

exports.getModerationDocuments = async (req, res) => {
  try {
    const { page, pageSize, from, to } = getPagination(req.query);
    const search = String(req.query.search || "").trim();
    const requestedStatus = String(req.query.status || "").toUpperCase();
    const allowedStatuses = ["REJECTED", "FLAGGED", "PENDING_RETRY"];
    let query = supabase
      .from("documents")
      .select(`
        id,
        uploader_id,
        title,
        file_url,
        file_size_bytes,
        is_public,
        status,
        ai_reject_reason,
        reviewed_by_admin_id,
        reviewed_at,
        admin_review_reason,
        created_at,
        uploader:profiles!documents_uploader_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `, { count: "exact" })
      .in(
        "status",
        allowedStatuses.includes(requestedStatus)
          ? [requestedStatus]
          : allowedStatuses,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
      pagination: paginationPayload(count, page, pageSize),
    });
  } catch (error) {
    console.error("Admin moderation list error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load moderation documents.",
      error: error.message,
    });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { decision, reason } = req.body;

    if (!["APPROVE", "KEEP_REJECTED"].includes(decision)) {
      return res.status(400).json({
        status: "error",
        message: "decision must be APPROVE or KEEP_REJECTED.",
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        status: "error",
        message: "Admin review reason is required.",
      });
    }

    const { data: oldDocument, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!["FLAGGED", "PENDING"].includes(oldDocument.status)) {
      return res.status(400).json({
        status: "error",
        message: "Only documents pending moderation can be reviewed.",
      });
    }

    const reviewedAt = new Date().toISOString();
    const reviewReason = String(reason).trim();
    let updatedDocument;

    if (decision === "APPROVE") {
      if (oldDocument.file_url && oldDocument.status === "FLAGGED") {
        try {
          const { data: fileBlob, error: downloadErr } = await supabase.storage
            .from(WAITING_BUCKET)
            .download(oldDocument.file_url);

          if (downloadErr || !fileBlob) {
            throw downloadErr || new Error("Failed to download file from WAITING_BUCKET");
          }

          const arrayBuffer = await fileBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const { error: uploadErr } = await supabase.storage
            .from(DOCUMENT_BUCKET)
            .upload(oldDocument.file_url, buffer, {
              contentType: "application/octet-stream",
              upsert: true,
            });

          if (uploadErr) throw uploadErr;

          await supabase.storage
            .from(WAITING_BUCKET)
            .remove([oldDocument.file_url]);
        } catch (transferErr) {
          console.error("Storage transfer failed during document approval:", transferErr);
          return res.status(500).json({
            status: "error",
            message: "Could not approve document: Storage file transfer failed.",
            error: transferErr.message,
          });
        }
      }

      const { data, error: updateError } = await supabase
        .from("documents")
        .update({
          status: "APPROVED",
          reviewed_by_admin_id: req.user.id,
          reviewed_at: reviewedAt,
          admin_review_reason: reviewReason,
        })
        .eq("id", documentId)
        .select("*")
        .single();

      if (updateError) throw updateError;
      updatedDocument = data;
    } else {
      if (oldDocument.file_url) {
        await supabase.storage
          .from(WAITING_BUCKET)
          .remove([oldDocument.file_url]);

        await supabase.storage
          .from(DOCUMENT_BUCKET)
          .remove([oldDocument.file_url]);
      }

      await supabase.from("document_chunks").delete().eq("document_id", documentId);
      await supabase.from("document_tags").delete().eq("document_id", documentId);

      const { data, error: updateError } = await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          deleted_at: reviewedAt,
          reviewed_by_admin_id: req.user.id,
          reviewed_at: reviewedAt,
          admin_review_reason: reviewReason,
        })
        .eq("id", documentId)
        .select("*")
        .single();

      if (updateError) throw updateError;
      updatedDocument = data;
    }

    await createActivityLog({
      actorUserId: req.user.id,
      adminId: req.user.id,
      actionType: "ADMIN_REVIEW_DOCUMENT",
      entityType: "documents",
      entityId: documentId,
      oldData: oldDocument,
      newData: updatedDocument,
      request: req,
      riskLevel: decision === "APPROVE" ? "MEDIUM" : "HIGH",
      details: `Admin (ID: ${req.user.id}) ${decision === "APPROVE" ? "approved" : "rejected"} document "${oldDocument.title}". Review note: ${reviewReason}`,
    });

    await createActivityLog({
      actorUserId: oldDocument.uploader_id,
      adminId: req.user.id,
      actionType:
        decision === "APPROVE" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
      entityType: "documents",
      entityId: documentId,
      oldData: oldDocument,
      newData: {
        notificationType:
          decision === "APPROVE" ? "moderationApproved" : "moderationRejected",
        documentTitle: oldDocument.title,
        libraryId: oldDocument.library_id,
        reviewedByAdminId: req.user.id,
        reviewedAt,
      },
      request: req,
      riskLevel: decision === "APPROVE" ? "INFO" : "MEDIUM",
      details:
        decision === "APPROVE"
          ? `Your document "${oldDocument.title}" has been approved by admin and is now available in your library.`
          : `Your document "${oldDocument.title}" was rejected by admin. Reason: ${reviewReason}`,
    });

    return res.status(200).json({
      status: "success",
      message:
        decision === "APPROVE"
          ? "Document approved and moved to main library storage."
          : "Document rejected and removed.",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Admin reviewDocument error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not process document review decision.",
      error: error.message,
    });
  }
};

exports.viewModerationDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docError) throw docError;

    if (!document) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }

    const primaryBucket = (document.status === "FLAGGED" || document.status === "REJECTED" || document.status === "PENDING_RETRY")
      ? WAITING_BUCKET
      : DOCUMENT_BUCKET;

    let signedUrlData = null;
    let { data, error: signedUrlError } = await supabase.storage
      .from(primaryBucket)
      .createSignedUrl(document.file_url, 60 * 60);

    if (data?.signedUrl) {
      signedUrlData = data;
    } else {
      const fallbackBucket = primaryBucket === WAITING_BUCKET ? DOCUMENT_BUCKET : WAITING_BUCKET;
      const { data: fallbackData, error: fallbackError } = await supabase.storage
        .from(fallbackBucket)
        .createSignedUrl(document.file_url, 60 * 60);

      if (fallbackError || !fallbackData?.signedUrl) {
        throw signedUrlError || fallbackError;
      }
      signedUrlData = fallbackData;
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId: document.id,
        fileName: document.title,
        fileSizeBytes: document.file_size_bytes,
        status: document.status,
        viewUrl: signedUrlData.signedUrl,
        expiresIn: 3600
      }
    });
  } catch (error) {
    console.error("viewModerationDocument error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not fetch moderation document preview URL.",
      error: error.message
    });
  }
};
