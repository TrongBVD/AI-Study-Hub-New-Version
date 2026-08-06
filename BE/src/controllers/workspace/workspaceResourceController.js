const supabase = require("../../config/supabase");
const {
  FLASHCARD_SELECT,
  WORKSPACE_DOCUMENT_SELECT,
  DOCUMENT_BUCKET,
  getWorkspaceAccess,
  mapWorkspaceFlashcard,
  mapWorkspaceDocument,
  moveWorkspaceDocumentToBucket,
} = require("./workspaceHelpers");

exports.listFlashcards = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      workspaceId,
      userId,
    );

    if (!workspace) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    if (!member && !isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this workspace.",
      });
    }

    const { data, error } = await supabase
      .from("flashcards")
      .select(FLASHCARD_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map(mapWorkspaceFlashcard),
    });
  } catch (error) {
    console.error("listFlashcards error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace flashcards.",
    });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      workspaceId,
      userId,
    );

    if (!workspace || (!member && !isAdmin)) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace.",
      });
    }

    const { data, error } = await supabase
      .from("documents")
      .select(WORKSPACE_DOCUMENT_SELECT)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const documents = data || [];
    const uploaderIds = [...new Set(
      documents
        .filter((document) => {
          const uploader = Array.isArray(document.uploader)
            ? document.uploader[0]
            : document.uploader;
          return !uploader;
        })
        .map((document) => document.uploader_id)
        .filter(Boolean),
    )];
    const uploaderById = new Map();

    if (uploaderIds.length > 0) {
      const { data: uploaderProfiles, error: uploaderProfilesError } =
        await supabase
          .from("profiles")
          .select("id, email, username, full_name")
          .in("id", uploaderIds);

      if (uploaderProfilesError) {
        console.warn("Could not load workspace document uploader profiles:", uploaderProfilesError);
      } else {
        (uploaderProfiles || []).forEach((profile) =>
          uploaderById.set(String(profile.id), profile),
        );
      }
    }

    return res.status(200).json({
      status: "success",
      data: documents
        .map((document) =>
          mapWorkspaceDocument({
            ...document,
            uploader:
              uploaderById.get(String(document.uploader_id)) || document.uploader,
          }),
        ),
    });
  } catch (error) {
    console.error("listWorkspaceDocuments error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace documents.",
      error: error.message,
    });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const { workspaceId, documentId } = req.params;
    const { decision, reason } = req.body;
    const userId = req.user.id;

    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({
        status: "error",
        message: "decision must be APPROVE or REJECT.",
      });
    }

    const { workspace, isAdmin } = await getWorkspaceAccess(workspaceId, userId);

    if (!workspace) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    if (!isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace admins can review workspace documents.",
      });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) throw documentError;

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Workspace document not found.",
      });
    }

    const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const reviewedAt = new Date().toISOString();
    const replacementDocumentIds = Array.isArray(
      document.replacement_document_ids,
    )
      ? document.replacement_document_ids.filter(
          (id) => id && String(id) !== String(documentId),
        )
      : [];
    // Approved files belong in the active documents bucket. Rejected files are
    // soft-deleted below, so moving them to an optional waiting bucket would
    // only make rejection fail when that bucket is not configured.
    const storageMove =
      decision === "APPROVE"
        ? await moveWorkspaceDocumentToBucket(document, DOCUMENT_BUCKET)
        : { moved: false, sourceBucket: null, targetBucket: null };

    const { data: updatedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        status: newStatus,
        reviewed_by_admin_id: userId,
        reviewed_at: reviewedAt,
        // Rejected workspace uploads are removed from the active document list.
        // Background AI jobs may still finish, but they never clear deleted_at.
        deleted_at: decision === "REJECT" ? reviewedAt : null,
        admin_review_reason:
          String(reason || "").trim() ||
          `${newStatus.toLowerCase()} by workspace admin.`,
        replacement_document_ids: [],
      })
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .select(WORKSPACE_DOCUMENT_SELECT)
      .single();

    if (updateError) {
      if (storageMove.moved && storageMove.sourceBucket) {
        try {
          await moveWorkspaceDocumentToBucket(
            document,
            storageMove.sourceBucket,
          );
        } catch (rollbackError) {
          console.error(
            "Could not roll back workspace document storage move:",
            rollbackError,
          );
        }
      }
      throw updateError;
    }

    // Keep the currently approved source available while its replacement is
    // waiting for review. It is retired only after the new upload is approved.
    if (decision === "APPROVE" && replacementDocumentIds.length > 0) {
      const { error: replacementDeleteError } = await supabase
        .from("documents")
        .update({ deleted_at: reviewedAt })
        .in("id", replacementDocumentIds)
        .eq("workspace_id", workspaceId)
        .neq("id", documentId)
        .is("deleted_at", null);

      if (replacementDeleteError) {
        await supabase
          .from("documents")
          .update({
            status: document.status,
            reviewed_by_admin_id: document.reviewed_by_admin_id,
            reviewed_at: document.reviewed_at,
            deleted_at: document.deleted_at,
            admin_review_reason: document.admin_review_reason,
            replacement_document_ids: replacementDocumentIds,
          })
          .eq("id", documentId)
          .eq("workspace_id", workspaceId);

        if (storageMove.moved && storageMove.sourceBucket) {
          try {
            await moveWorkspaceDocumentToBucket(
              document,
              storageMove.sourceBucket,
            );
          } catch (rollbackError) {
            console.error(
              "Could not roll back replacement storage move:",
              rollbackError,
            );
          }
        }

        throw replacementDeleteError;
      }
    }

    return res.status(200).json({
      status: "success",
      data: mapWorkspaceDocument(updatedDocument),
    });
  } catch (error) {
    console.error("reviewWorkspaceDocument error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not review workspace document.",
      error: error.message,
    });
  }
};
