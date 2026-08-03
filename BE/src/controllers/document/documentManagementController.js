const crypto = require("crypto");
const supabase = require("../../config/supabase");

const { extractTextFromFile } = require("../../services/textExtractService");
const { validateTagsAndContent } = require("../../services/aiService");
const {
  mapWithConcurrency,
  normalizeConcurrency,
} = require("../../utils/asyncUtils");
const { normalizeSuggestedTags } = require("../../utils/tagUtils");
const {
  parseReplacementDocumentIds,
  resolveDuplicateUploadDecisions,
} = require("../../utils/documentDuplicateUtils");
const { createActivityLog } = require("../../services/activityLogService");
const { canAccessDocument } = require("../../services/documentAccessService");
const { notifyDocumentUploaded, notifyDocumentDeleted } = require("../../services/documentNotificationService");

const {
  BUCKET,
  WAITING_BUCKET,
  LIBRARY_STORAGE_LIMIT_BYTES,
  normalizeUploadedFileName,
  sanitizeFileName,
  getWorkspaceDocumentUploadAccess,
  isSensitiveClassification,
  processDocumentWithAI,
  processWorkspaceDocumentInBackground,
} = require("./documentHelpers");

const FILE_VALIDATION_CONCURRENCY = Math.min(
  normalizeConcurrency(process.env.FILE_VALIDATION_CONCURRENCY, 2),
  4,
);
const FILE_UPLOAD_CONCURRENCY = Math.min(
  normalizeConcurrency(process.env.FILE_UPLOAD_CONCURRENCY, 2),
  4,
);

exports.listMyDocuments = async (req, res) => {
  try {
    const userID = req.user.id;
    const { libraryId, workspaceId } = req.query;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    let query = supabase
      .from("documents")
      .select(
        `
        id,
        uploader_id,
        workspace_id,
        library_id,
        title,
        file_size_bytes,
        is_public,
        status,
        ai_reject_reason,
        created_at
      `
      )
      .eq("uploader_id", userID)
      .is("deleted_at", null);

    if (libraryId) {
      query = query.eq("library_id", libraryId);
    }

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const approvedDocuments = (data || []).filter(
      (document) => String(document.status || "").toUpperCase() === "APPROVED",
    );
    const approvedDocumentIds = approvedDocuments.map((document) => document.id);
    let aiReadyDocumentIds = new Set();

    if (approvedDocumentIds.length > 0) {
      const { data: chunkRows, error: chunkError } = await supabase
        .from("document_chunks")
        .select("document_id")
        .in("document_id", approvedDocumentIds);

      if (chunkError) {
        throw chunkError;
      }

      aiReadyDocumentIds = new Set(
        (chunkRows || []).map((chunk) => String(chunk.document_id)),
      );
    }

    return res.status(200).json({
      status: "success",
      data: approvedDocuments.map((document) => ({
        ...document,
        ai_ready: aiReadyDocumentIds.has(String(document.id)),
      })),
    });
  } catch (error) {
    console.error("Lỗi listMyDocuments:", error);

    return res.status(500).json({
      status: "error",
      message: "Could not load documents list.",
      error: error.message,
    });
  }
};

exports.getMyLibraryStorageUsage = async (req, res) => {
  try {
    const userID = req.user.id;
    const { data: documents, error } = await supabase
      .from("documents")
      .select("file_size_bytes")
      .eq("uploader_id", userID)
      .not("library_id", "is", null)
      .is("deleted_at", null);

    if (error) throw error;

    const usedBytes = (documents || []).reduce(
      (total, document) => total + (Number(document.file_size_bytes) || 0),
      0,
    );

    return res.status(200).json({
      status: "success",
      data: {
        usedBytes,
        limitBytes: LIBRARY_STORAGE_LIMIT_BYTES,
        remainingBytes: Math.max(
          0,
          LIBRARY_STORAGE_LIMIT_BYTES - usedBytes,
        ),
      },
    });
  } catch (error) {
    console.error("Get library storage usage error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load library storage usage.",
    });
  }
};

exports.uploadDocuments = async (req, res) => {
  try {
    const userID = req.user.id;
    const files = req.files || [];
    files.forEach((file) => {
      file.originalname = normalizeUploadedFileName(file.originalname);
    });
    const workspaceId = req.body?.workspaceId || req.body?.workspace_id || null;
    const libraryId = req.body?.libraryId || req.body?.library_id || null;
    const tagsString = req.body?.tags || "[]";
    const requestedReplacementIds = parseReplacementDocumentIds(
      req.body?.replacementDocumentIds,
      files.length,
    );

    let userTags = [];
    try {
      const parsed = JSON.parse(tagsString);
      if (Array.isArray(parsed)) {
        userTags = parsed.map(tag => {
          let val = String(tag || "").trim();
          if (!val) return "";
          if (val.startsWith("#")) {
            val = val.substring(1).trim();
          }
          val = val.replace(/\s+/g, "");
          return val;
        }).filter(Boolean);
      }
    } catch (e) {
      console.error("Lỗi parse tags:", e);
    }

    const normalizedTagValues = userTags.map((tag) => tag.toLocaleLowerCase());
    const hasDuplicateTags =
      new Set(normalizedTagValues).size !== normalizedTagValues.length;
    const hasTagStartingWithNumber = userTags.some((tag) => /^\d/.test(tag));

    if (hasDuplicateTags || hasTagStartingWithNumber) {
      return res.status(400).json({
        status: "error",
        code: "TAG_INPUT_INVALID",
        message: hasDuplicateTags
          ? "Tags must be unique."
          : "A tag cannot start with a number.",
      });
    }

    if (files.length === 0) {
      return res.status(400).json({ status: "error", message: "Please select a file to upload." });
    }

    const isDirectWorkspaceUpload = Boolean(workspaceId && !libraryId);

    let targetLibrary = null;
    if (libraryId) {
      const { data: lib, error: libErr } = await supabase
        .from("libraries")
        .select("id, user_id, is_public")
        .eq("id", libraryId)
        .maybeSingle();

      if (libErr || !lib) {
        return res.status(404).json({
          status: "error",
          message: "Library not found.",
        });
      }

      if (String(lib.user_id) !== String(userID)) {
        return res.status(403).json({
          status: "error",
          message: "You can only upload documents to your own library.",
        });
      }
      targetLibrary = lib;
    }

    const workspaceAccess = workspaceId
      ? await getWorkspaceDocumentUploadAccess(workspaceId, userID)
      : null;

    if (workspaceAccess && !workspaceAccess.exists) {
      return res.status(404).json({
        status: "error",
        message: "Workspace not found.",
      });
    }

    if (workspaceAccess && !workspaceAccess.canUpload) {
      return res.status(403).json({
        status: "error",
        message: "Workspace contributors and admins can upload documents.",
      });
    }

    let existingDocumentQuery = supabase
      .from("documents")
      .select("id, uploader_id, title, file_size_bytes, created_at")
      .is("deleted_at", null);

    if (!isDirectWorkspaceUpload) {
      existingDocumentQuery = existingDocumentQuery.eq("uploader_id", userID);
    }

    existingDocumentQuery = libraryId
      ? existingDocumentQuery.eq("library_id", libraryId)
      : existingDocumentQuery.is("library_id", null);
    existingDocumentQuery = workspaceId
      ? existingDocumentQuery.eq("workspace_id", workspaceId)
      : existingDocumentQuery.is("workspace_id", null);

    const {
      data: scopedExistingDocuments,
      error: existingDocumentError,
    } = await existingDocumentQuery.order("created_at", { ascending: false });

    if (existingDocumentError) throw existingDocumentError;

    const existingDocumentsById = new Map(
      (scopedExistingDocuments || []).map((document) => [
        String(document.id),
        document,
      ]),
    );
    const unauthorizedReplacementId =
      isDirectWorkspaceUpload && !workspaceAccess?.canReplaceAny
        ? requestedReplacementIds.find((documentId) => {
            if (!documentId) return false;
            const existingDocument = existingDocumentsById.get(
              String(documentId),
            );

            return (
              existingDocument &&
              String(existingDocument.uploader_id) !== String(userID)
            );
          })
        : null;

    if (unauthorizedReplacementId) {
      return res.status(403).json({
        status: "error",
        code: "DOCUMENT_REPLACEMENT_FORBIDDEN",
        message:
          "Only the original uploader or a workspace admin can replace this document.",
      });
    }

    const duplicateDecision = resolveDuplicateUploadDecisions(
      files,
      scopedExistingDocuments || [],
      requestedReplacementIds,
    );



    if (duplicateDecision.conflicts.length > 0) {
      const duplicateConflicts = duplicateDecision.conflicts.map((conflict) => {
        const existingDocument = conflict.documentId
          ? existingDocumentsById.get(String(conflict.documentId))
          : null;

        return {
          ...conflict,
          canReplace:
            !existingDocument ||
            !isDirectWorkspaceUpload ||
            workspaceAccess?.canReplaceAny === true ||
            String(existingDocument.uploader_id) === String(userID),
        };
      });

      return res.status(409).json({
        status: "error",
        code: "DUPLICATE_DOCUMENT",
        message:
          "One or more documents have already been uploaded. Confirm replacement before uploading again.",
        duplicates: duplicateConflicts,
      });
    }

    const replacementDocumentIds = new Set(
      duplicateDecision.replacementTargetIds.flat(),
    );
    const replacementBytes = (scopedExistingDocuments || []).reduce(
      (total, document) =>
        replacementDocumentIds.has(String(document.id))
          ? total + (Number(document.file_size_bytes) || 0)
          : total,
      0,
    );

    const incomingBytes = files.reduce(
      (total, file) => total + (Number(file.size) || 0),
      0,
    );

    if (workspaceId) {
      const { data: existingDocs, error: workspaceStorageError } = await supabase
        .from("documents")
        .select("file_size_bytes")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);

      if (workspaceStorageError) throw workspaceStorageError;

      const currentUsedBytes = (existingDocs || []).reduce((acc, doc) => acc + (Number(doc.file_size_bytes) || 0), 0);

      if (currentUsedBytes + incomingBytes - replacementBytes > LIBRARY_STORAGE_LIMIT_BYTES) {
        return res.status(400).json({
          status: "error",
          message: "Workspace upload storage limit of 50MB has been reached.",
        });
      }
    } else if (libraryId) {
      const { data: existingLibraryDocs, error: libraryStorageError } =
        await supabase
          .from("documents")
          .select("file_size_bytes")
          .eq("uploader_id", userID)
          .not("library_id", "is", null)
          .is("deleted_at", null);

      if (libraryStorageError) throw libraryStorageError;

      const currentUsedBytes = (existingLibraryDocs || []).reduce(
        (total, document) =>
          total + (Number(document.file_size_bytes) || 0),
        0,
      );

      if (
        currentUsedBytes + incomingBytes - replacementBytes >
        LIBRARY_STORAGE_LIMIT_BYTES
      ) {
        return res.status(400).json({
          status: "error",
          code: "LIBRARY_STORAGE_LIMIT_EXCEEDED",
          message:
            "Your libraries have reached the shared 50 MB storage limit.",
        });
      }
    }

    const processedFilesData = files.map((file, fileIndex) => ({
      file,
      fileIndex,
    }));

    const uploadedDocuments = await mapWithConcurrency(
      processedFilesData,
      FILE_UPLOAD_CONCURRENCY,
      async (processedData) => {
        const { file, fileIndex } = processedData;

        const safeFileName = sanitizeFileName(file.originalname);
        const storagePath = `${userID}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || "application/octet-stream"
          });

        if (uploadError) throw uploadError;

        const { data: document, error: insertError } = await supabase
          .from("documents")
          .insert({
            uploader_id: userID,
            workspace_id: workspaceId,
            library_id: libraryId,
            title: file.originalname,
            file_url: storagePath,
            file_size_bytes: file.size,
            is_public: targetLibrary ? Boolean(targetLibrary.is_public) : false,
            status: "APPROVED",
            ai_reject_reason: null
          })
          .select("*").single();

        if (insertError) throw insertError;

        const replacedDocumentIds =
          duplicateDecision.replacementTargetIds[fileIndex] || [];

        if (replacedDocumentIds.length > 0) {
          const replacementTimestamp = new Date().toISOString();

          // Fetch file_urls of replaced documents to clean up Supabase Storage Bucket
          const { data: replacedDocs } = await supabase
            .from("documents")
            .select("id, file_url")
            .in("id", replacedDocumentIds);

          if (replacedDocs && replacedDocs.length > 0) {
            for (const rDoc of replacedDocs) {
              if (rDoc.file_url) {
                let cleanPath = rDoc.file_url;
                if (cleanPath.startsWith("http")) {
                  const parts = cleanPath.split("/object/public/");
                  if (parts[1]) {
                    cleanPath = parts[1].replace(`${BUCKET}/`, "").replace(`${WAITING_BUCKET}/`, "");
                  }
                }
                cleanPath = cleanPath.replace(/^documents\//, "").replace(/^document_waiting_admin\//, "");
                await supabase.storage.from(BUCKET).remove([cleanPath]);
                await supabase.storage.from(WAITING_BUCKET).remove([cleanPath]);
              }
            }
          }

          // Delete vector chunks of replaced documents
          await supabase
            .from("document_chunks")
            .delete()
            .in("document_id", replacedDocumentIds);

          let replacementDeleteQuery = supabase
            .from("documents")
            .delete()
            .in("id", replacedDocumentIds);

          replacementDeleteQuery = workspaceId
            ? replacementDeleteQuery.eq("workspace_id", workspaceId)
            : replacementDeleteQuery.is("workspace_id", null);
          replacementDeleteQuery = libraryId
            ? replacementDeleteQuery.eq("library_id", libraryId)
            : replacementDeleteQuery.is("library_id", null);

          if (!isDirectWorkspaceUpload || !workspaceAccess?.canReplaceAny) {
            replacementDeleteQuery = replacementDeleteQuery.eq(
              "uploader_id",
              userID,
            );
          }

          const { error: replacementDeleteError } =
            await replacementDeleteQuery;

          if (replacementDeleteError) {
            await supabase
              .from("documents")
              .delete()
              .eq("id", document.id);
            throw replacementDeleteError;
          }
        }

        return {
          ...document,
          status: "APPROVED",
          replaced_document_ids: replacedDocumentIds,
        };
      },
    );

    // Record notification for successful document upload
    for (const doc of uploadedDocuments) {
      if (doc?.id) {
        notifyDocumentUploaded({
          userId: userID,
          documentId: doc.id,
          documentTitle: doc.title,
          libraryId,
          workspaceId,
        }).catch((err) => console.warn("Failed to send upload notification:", err));
      }
    }

    return res.status(201).json({ status: "success", data: uploadedDocuments });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ status: "error", error: error.message });
  }
};

exports.suggestDocumentTags = async (req, res) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Please select at least one file for AI tag suggestions.",
      });
    }

    const suggestedTagGroups = await mapWithConcurrency(
      files,
      FILE_VALIDATION_CONCURRENCY,
      async (file) => {
        const extractedText = await extractTextFromFile(file);
        const result = await validateTagsAndContent(
          extractedText,
          file.originalname,
          [],
          { throwOnError: true },
        );

        return result.aiRecommendedTags || [];
      },
    );
    const suggestedTags = normalizeSuggestedTags(suggestedTagGroups.flat(), 5);

    return res.status(200).json({
      status: "success",
      data: suggestedTags,
    });
  } catch (error) {
    console.error("Lỗi suggestDocumentTags:", error);
    const errorStatus = Number(error?.status || error?.statusCode);
    const isAiQuotaError = errorStatus === 429;
    const isAiServiceUnavailable = errorStatus === 503;
    const isTemporaryAiError = isAiQuotaError || isAiServiceUnavailable;

    return res.status(isTemporaryAiError ? 503 : 500).json({
      status: "error",
      code: isAiQuotaError
        ? "AI_QUOTA_EXHAUSTED"
        : isAiServiceUnavailable
          ? "AI_SERVICE_UNAVAILABLE"
          : "AI_TAG_SUGGESTION_FAILED",
      message: isAiQuotaError
        ? "AI tag suggestions are temporarily unavailable because the service quota was reached. Please try again later."
        : isAiServiceUnavailable
          ? "AI tag suggestions are temporarily unavailable. Please try again shortly."
          : "AI could not suggest tags for this document.",
    });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const userID = req.user.id;
    const { documentId } = req.params;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) {
      throw documentError;
    }

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    if (!(await canAccessDocument(document, userID))) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this document.",
      });
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from(BUCKET).createSignedUrl(document.file_url, 300, {
        download: document.title,
      });

    if (signedUrlError) {
      throw signedUrlError;
    }

    if (document.library_id) {
      try {
        await supabase.from("library_downloads").insert({
          library_id: document.library_id,
          user_id: userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" ? null : userID,
        });
      } catch (dlErr) {
        console.warn("Could not log library download:", dlErr);
      }
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId: document.id,
        fileName: document.title,
        downloadUrl: signedUrlData.signedUrl,
      },
    });
  } catch (error) {
    console.error("downloadDocument error:", error);

    return res.status(500).json({
      status: "error",
      message: "Could not download document.",
      error: error.message,
    });
  }
};

exports.viewDocument = async (req, res) => {
  try {
    const userID = req.user.id;
    const { documentId } = req.params;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) {
      throw documentError;
    }

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    if (
      !(await canAccessDocument(document, userID, {
        workspaceRoles: ["Admin", "Viewer", "Editor"],
        allowWorkspaceUploader: false,
      }))
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this document.",
      });
    }

    const primaryBucket = (document.status === "FLAGGED" || document.status === "REJECTED" || document.status === "PENDING_RETRY")
      ? WAITING_BUCKET
      : BUCKET;

    let signedUrlData = null;
    let { data, error: signedUrlError } = await supabase.storage
      .from(primaryBucket)
      .createSignedUrl(document.file_url, 60 * 60);

    if (data?.signedUrl) {
      signedUrlData = data;
    } else {
      const fallbackBucket = primaryBucket === WAITING_BUCKET ? BUCKET : WAITING_BUCKET;
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
        expiresIn: 60 * 60,
      },
    });
  } catch (error) {
    console.error("View document error:", error);

    return res.status(500).json({
      status: "error",
      message: "Could not open document.",
      error: error.message,
    });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const userID = req.user.id;
    const { documentId } = req.params;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) {
      throw documentError;
    }

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    const isOwner = String(document.uploader_id) === String(userID);
    let isWorkspaceAdmin = false;

    if (!isOwner && document.workspace_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", document.workspace_id)
        .eq("user_id", userID)
        .maybeSingle();

      if (membershipError) throw membershipError;
      isWorkspaceAdmin = String(membership?.role || "").toLowerCase() === "admin";
    }

    if (!isOwner && !isWorkspaceAdmin) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to delete this document.",
      });
    }

    if (document.file_url) {
      try {
        let cleanPath = document.file_url;
        if (cleanPath.startsWith("http")) {
          const parts = cleanPath.split("/object/public/");
          if (parts[1]) {
            cleanPath = parts[1].replace(`${BUCKET}/`, "").replace(`${WAITING_BUCKET}/`, "");
          }
        }
        cleanPath = cleanPath.replace(/^documents\//, "").replace(/^document_waiting_admin\//, "");

        const { data: remBucket, error: errBucket } = await supabase.storage.from(BUCKET).remove([cleanPath]);
        const { data: remWait, error: errWait } = await supabase.storage.from(WAITING_BUCKET).remove([cleanPath]);
        console.log(`[deleteDocument] Storage removal result for "${cleanPath}":`, { remBucket, errBucket, remWait, errWait });
      } catch (storageErr) {
        console.warn("[deleteDocument] Warning removing file from storage:", storageErr);
      }
    }

    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      throw deleteError;
    }

    // Record notification for document deletion
    notifyDocumentDeleted({
      userId: userID,
      documentId: document.id,
      documentTitle: document.title,
      libraryId: document.library_id,
      workspaceId: document.workspace_id,
    }).catch((err) => console.warn("Failed to send delete notification:", err));

    return res.status(200).json({
      status: "success",
      message: "Document deleted successfully.",
    });
  } catch (error) {
    console.error("deleteDocument error:", error);

    return res.status(500).json({
      status: "error",
      message: "Could not delete document.",
      error: error.message,
    });
  }
};
