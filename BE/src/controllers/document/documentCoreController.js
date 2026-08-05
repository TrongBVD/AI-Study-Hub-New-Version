const crypto = require("crypto");
const path = require("path");
const supabase = require("../../config/supabase");

const {
  extractTextFromFile,
  splitTextIntoChunks,
} = require("../../services/textExtractService");

const {
  createBatchEmbeddings,
  toVectorLiteral,
  validateTagsAndContent,
  classifyDocumentHierarchicalTags,
} = require("../../services/aiService");
const { ensureAndLinkDocumentTags } = require("../../services/tagService");
const {
  mapWithConcurrency,
  normalizeConcurrency,
} = require("../../utils/asyncUtils");
const { normalizeSuggestedTags } = require("../../utils/tagUtils");
const {
  parseReplacementDocumentIds,
  resolveDuplicateUploadDecisions,
} = require("../../utils/documentDuplicateUtils");

const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";
const WAITING_BUCKET = process.env.SUPABASE_DOCUMENT_WAITING_ADMIN_APPROVED || "document_waiting_admin";
const { createActivityLog } = require("../../services/activityLogService");
const {
  notifyDocumentUploaded,
  notifyDocumentTaggingFailed,
  notifyDocumentDeleted,
} = require("../../services/documentNotificationService");
const { canAccessDocument } = require("../../services/documentAccessService");
const FILE_VALIDATION_CONCURRENCY = Math.min(
  normalizeConcurrency(process.env.FILE_VALIDATION_CONCURRENCY, 2),
  4,
);
const FILE_UPLOAD_CONCURRENCY = Math.min(
  normalizeConcurrency(process.env.FILE_UPLOAD_CONCURRENCY, 2),
  4,
);
const EMBEDDING_CONCURRENCY = Math.min(
  normalizeConcurrency(process.env.EMBEDDING_CONCURRENCY, 3),
  8,
);
const LIBRARY_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;

function normalizeUploadedFileName(fileName) {
  const value = String(fileName || "");
  if (!value || [...value].some((character) => character.charCodeAt(0) > 255)) {
    return value.normalize("NFC");
  }

  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? value.normalize("NFC") : decoded.normalize("NFC");
}

function sanitizeFileName(fileName) {
  const baseName = path.basename(fileName || "upload.bin");

  return baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 160);
}

function getTaggingErrorMessage(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 429) {
    return "The AI tagging quota has been reached. Please retry later.";
  }
  if (status === 503) {
    return "The AI tagging service is temporarily unavailable. Please retry.";
  }
  if (String(error?.message || "").includes("extract")) {
    return "The file does not contain enough readable text for AI tagging.";
  }
  return error?.message || "The AI could not generate tags for this file.";
}

function isMissingTaggingColumnError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("tagging_status") ||
    message.includes("tagging_error") ||
    message.includes("tagging_updated_at") ||
    message.includes("tagging_")
  );
}

async function updateDocumentTaggingState(
  documentId,
  taggingStatus,
  taggingError = null,
) {
  const { error } = await supabase
    .from("documents")
    .update({
      tagging_status: taggingStatus,
      tagging_error: taggingError,
      tagging_updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    if (isMissingTaggingColumnError(error)) {
      console.warn("tagging_status/tagging_error columns missing from documents table, skipping state update");
      return;
    }
    throw error;
  }
}

async function markDocumentTaggingFailed(documentId, error, context = {}) {
  const message = getTaggingErrorMessage(error);

  await updateDocumentTaggingState(documentId, "FAILED", message);
  await notifyDocumentTaggingFailed({
    ...context,
    documentId,
    errorMessage: message,
  });

  return message;
}

async function getWorkspaceDocumentUploadAccess(workspaceId, userId) {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, created_by")
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workspaceError) throw workspaceError;
  if (!workspace) {
    return { exists: false, canUpload: false, canReplaceAny: false };
  }

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) throw memberError;

  const normalizedRole = String(member?.role || "").trim().toLowerCase();
  const isCreator = String(workspace.created_by) === String(userId);
  const isAdmin = isCreator || normalizedRole === "admin";

  return {
    exists: true,
    canUpload:
      isAdmin || normalizedRole === "editor",
    canReplaceAny: isAdmin,
  };
}

async function processDocumentWithAI(
  file,
  documentId,
  preExtractedText = null,
  overrideStatus = null,
  overrideRejectReason = null,
  taggingContext = {},
  preclassifiedTags = null,
) {
  try {
    await updateDocumentTaggingState(documentId, "PROCESSING");
    const extractedText = preExtractedText || await extractTextFromFile(file);

    if (!extractedText || extractedText.trim().length < 20) {
      const taggingError = new Error(
        "The file does not contain enough readable text for AI tagging.",
      );
      await markDocumentTaggingFailed(documentId, taggingError, taggingContext);
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: { reason: "Could not extract enough readable text from this file." },
        })
        .eq("id", documentId);
      //file rỗng hoặc ít hơn 20 kí tự
      return { status: "REJECTED", reason: "Could not extract enough readable text", chunkCount: 0 };
    }

    const status = overrideStatus || "APPROVED";
    const aiRejectReason = overrideRejectReason || null;
    const chunks = splitTextIntoChunks(extractedText);

    if (chunks.length === 0) {
      await markDocumentTaggingFailed(
        documentId,
        new Error("No readable text chunks could be created."),
        taggingContext,
      );
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: { reason: "No readable text chunks could be created." },
        })
        .eq("id", documentId);

      return {
        status: "REJECTED",
        reason: "No readable text chunks could be created.",
        chunkCount: 0,
      };
    }

    const updatePayload = {
      status,
      ai_reject_reason: aiRejectReason,
    };

    await supabase.from("documents").update(updatePayload).eq("id", documentId);

    let taggingStatus = "COMPLETED";

    // Persist the hierarchy strictly. A tagging failure must be visible to the
    // user instead of being silently treated as a successful upload.
    try {
      const { data: docInfo } = await supabase
        .from("documents")
        .select("title")
        .eq("id", documentId)
        .maybeSingle();

      const classification =
        preclassifiedTags ||
        (await classifyDocumentHierarchicalTags(
          extractedText,
          docInfo?.title || "Document",
          { throwOnError: true },
        ));
      await ensureAndLinkDocumentTags(documentId, classification, {
        throwOnError: true,
      });
      await updateDocumentTaggingState(documentId, "COMPLETED");
    } catch (tagErr) {
      console.warn("3-level document tagging warning:", tagErr.message);
      taggingStatus = "FAILED";
      await markDocumentTaggingFailed(documentId, tagErr, taggingContext);
    }

    // Persist readable chunks even when the embedding provider is unavailable.
    // This keeps overview chat and the text fallback usable while embeddings
    // can be regenerated later.
    if (chunks.length > 0) {
      const chunkRows = chunks.map((chunk, index) => {
        return {
          document_id: documentId,
          chunk_index: index,
          content: chunk,
          embedding: null,
        };
      });

      const { error: deleteChunksError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId);
      if (deleteChunksError) throw deleteChunksError;

      const { error: insertChunksError } = await supabase
        .from("document_chunks")
        .insert(chunkRows);
      if (insertChunksError) throw insertChunksError;

      const embeddings = await createBatchEmbeddings(chunks, "document");
      const embeddingUpdates = embeddings
        .map((embedding, index) => ({ embedding, index }))
        .filter(({ embedding }) => Array.isArray(embedding));

      await mapWithConcurrency(
        embeddingUpdates,
        EMBEDDING_CONCURRENCY,
        async ({ embedding, index }) => {
          const { error: updateEmbeddingError } = await supabase
            .from("document_chunks")
            .update({ embedding: toVectorLiteral(embedding) })
            .eq("document_id", documentId)
            .eq("chunk_index", index);

          if (updateEmbeddingError) {
            console.warn(
              `Could not persist embedding for document ${documentId}, chunk ${index}:`,
              updateEmbeddingError.message,
            );
          }
        },
      );
    }

    return {
      status: status,
      reason: "Document processed.",
      chunkCount: chunks.length,
      tagging_status: taggingStatus,
    };
  } catch (error) {
    console.error("AI processing failed:", error);

    const taggingError = await markDocumentTaggingFailed(
      documentId,
      error,
      taggingContext,
    ).catch(() => getTaggingErrorMessage(error));

    await supabase
      .from("documents")
      .update({
        status: "PENDING_RETRY",
        ai_reject_reason: {
          reason: "AI processing failed. Manual review may be needed.",
          error: taggingError,
        },
      })
      .eq("id", documentId);

    return {
      status: "PENDING_RETRY",
      reason: "AI processing failed. Manual review may be needed.",
      error: taggingError,
      chunkCount: 0,
      tagging_status: "FAILED",
    };
  }
}

async function processWorkspaceDocumentInBackground(
  file,
  documentId,
  storagePath,
  userTags,
  taggingContext = {},
) {
  try {
    const extractedText = await extractTextFromFile(file);
    const tagValidation = await validateTagsAndContent(
      extractedText,
      file.originalname,
      userTags,
      { throwOnError: true },
    );
    const sensitivity = tagValidation?.sensitivity || {};
    const isFlagged = ["SEVERE", "MILD"].includes(
      String(sensitivity.classification || "").toUpperCase(),
    );

    if (!tagValidation.isValid) {
      await markDocumentTaggingFailed(
        documentId,
        new Error("The supplied tags do not match the document content."),
        taggingContext,
      );
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: {
            reason: "Document tags do not match the uploaded content.",
            tagValidations: tagValidation.tagValidations || [],
          },
        })
        .eq("id", documentId);
      return;
    }

    await processDocumentWithAI(
      file,
      documentId,
      extractedText,
      isFlagged
        ? "FLAGGED"
        : taggingContext.workspaceId
          ? "PENDING"
          : "APPROVED",
      isFlagged ? sensitivity : null,
      taggingContext,
      tagValidation.hierarchicalTags,
    );
  } catch (error) {
    console.error("Background workspace document validation failed:", error);
    await markDocumentTaggingFailed(
      documentId,
      error,
      taggingContext,
    ).catch(() => {});
    await supabase
      .from("documents")
      .update({
        status: "PENDING_RETRY",
        ai_reject_reason: {
          reason: "AI processing failed. Manual review may be needed.",
          error: error.message,
        },
      })
      .eq("id", documentId);
  }
}

async function loadDocumentFileForProcessing(document) {
  const preferredBucket = ["FLAGGED", "REJECTED"].includes(
    String(document.status || "").toUpperCase(),
  )
    ? WAITING_BUCKET
    : BUCKET;
  const bucketCandidates = [preferredBucket, BUCKET, WAITING_BUCKET].filter(
    (bucket, index, buckets) => buckets.indexOf(bucket) === index,
  );
  let lastError = null;

  for (const bucket of bucketCandidates) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(document.file_url);

    if (error || !data) {
      lastError = error || new Error("Stored document data is unavailable.");
      continue;
    }

    const arrayBuffer = await data.arrayBuffer();
    return {
      originalname: document.title || "Document",
      mimetype: document.mime_type || "application/octet-stream",
      size: Number(document.file_size_bytes) || arrayBuffer.byteLength,
      buffer: Buffer.from(arrayBuffer),
    };
  }

  throw lastError || new Error("The stored document could not be loaded.");
}

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
        tagging_status,
        tagging_error,
        tagging_updated_at,
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

    let { data, error } = await query.order("created_at", { ascending: false });

    if (error && isMissingTaggingColumnError(error)) {
      let fallbackQuery = supabase
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
        fallbackQuery = fallbackQuery.eq("library_id", libraryId);
      }

      if (workspaceId) {
        fallbackQuery = fallbackQuery.eq("workspace_id", workspaceId);
      }

      const fallbackResult = await fallbackQuery.order("created_at", { ascending: false });
      if (!fallbackResult.error) {
        data = (fallbackResult.data || []).map((doc) => ({
          ...doc,
          tagging_status: "COMPLETED",
          tagging_error: null,
          tagging_updated_at: doc.created_at,
        }));
        error = null;
      }
    }

    if (error) {
      throw error;
    }

    const documents = data || [];
    const approvedDocuments = documents.filter(
      (document) => String(document.status || "").toUpperCase() === "APPROVED",
    );
    const approvedDocumentIds = approvedDocuments.map((document) => document.id);
    let aiReadyDocumentIds = new Set();
    const tagsByDocumentId = new Map();

    if (documents.length > 0) {
      const { data: documentTagRows, error: documentTagError } = await supabase
        .from("document_tags")
        .select(`
          document_id,
          l1:tags!document_tags_level_1_tag_id_fkey(name),
          l2:tags!document_tags_level_2_tag_id_fkey(name),
          l3:tags!document_tags_level_3_tag_id_fkey(name)
        `)
        .in("document_id", documents.map((document) => document.id));

      if (documentTagError) throw documentTagError;

      (documentTagRows || []).forEach((row) => {
        tagsByDocumentId.set(String(row.document_id), {
          level1: row.l1?.name || null,
          level2: row.l2?.name || null,
          level3: row.l3?.name || null,
        });
      });
    }

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
      data: documents.map((document) => ({
        ...document,
        ai_ready: aiReadyDocumentIds.has(String(document.id)),
        tags: tagsByDocumentId.get(String(document.id)) || null,
      })),
    });
  } catch (error) {
    console.error("Lỗi listMyDocuments:", error);

    return res.status(500).json({
      status: "error",
      message: "Không thể tải danh sách tài liệu.",
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
    const workspaceId = req.body?.workspaceId || null;
    const libraryId = req.body?.libraryId || null; // Hỗ trợ up lên Library
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
      return res.status(400).json({ status: "error", message: "Vui lòng chọn tệp." });
    }

    // CHECK GIỚI HẠN 50MB NẾU UP VÀO WORKSPACE
    const isDirectWorkspaceUpload = Boolean(workspaceId && !libraryId);
    // Workspace moderation may continue after the upload response. Library
    // uploads must finish tagging/chunk persistence before reporting success.
    const isBackgroundUpload = Boolean(workspaceId && !libraryId);

    let targetLibrary = null;
    if (libraryId) {
      const { data: lib, error: libErr } = await supabase
        .from("libraries")
        .select("id, user_id, name, is_public")
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
        message: "Only workspace editors and admins can upload documents.",
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
          message: "Workspace đã đạt giới hạn 50MB dung lượng tải lên.",
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

    // 1. Trích xuất text và chạy kiểm tra nhạy cảm + tag validation song song cho tất cả các file
    let processedFilesData = [];
    if (isBackgroundUpload) {
      processedFilesData = files.map((file, fileIndex) => ({
        file,
        fileIndex,
        extractedText: "",
        sensitivity: { classification: "APPROVED", word: "", suspicious_text: "" },
        tagValidationResult: { isValid: true, tagValidations: [], aiRecommendedTags: [] },
      }));
    } else {
      try {
        processedFilesData = await mapWithConcurrency(
          files,
          FILE_VALIDATION_CONCURRENCY,
          async (file, fileIndex) => {
            const extractedText = await extractTextFromFile(file);

            const tagValidationResult = await validateTagsAndContent(
              extractedText,
              file.originalname,
              userTags,
              { throwOnError: true },
            );
            const sensitivity = tagValidationResult.sensitivity || {
              classification: "NONE",
              word: null,
              suspicious_text: null,
            };

            return {
              file,
              fileIndex,
              extractedText,
              sensitivity,
              tagValidationResult,
            };
          },
        );
      } catch (err) {
        console.error("Lỗi song song AI:", err);
        return res.status(500).json({ status: "error", message: "Đã xảy ra lỗi khi kiểm duyệt tài liệu bằng AI." });
      }
    }

    for (const processedData of processedFilesData) {
      if (!processedData.tagValidationResult.isValid) {
        return res.status(400).json({
          status: "error",
          code: "TAG_VALIDATION_FAILED",
          message: `Hashtag kiểm duyệt không hợp lệ cho tài liệu "${processedData.file.originalname}".`,
          tagValidations: processedData.tagValidationResult.tagValidations,
          aiRecommendedTags: processedData.tagValidationResult.aiRecommendedTags
        });
      }
    }

    // 2. Nếu tất cả đều qua kiểm định, tiến hành upload và lưu database
    const tagPromiseCache = new Map();

    function resolveTag(tagName) {
      if (!tagPromiseCache.has(tagName)) {
        tagPromiseCache.set(
          tagName,
          (async () => {
            let { data: tagData } = await supabase
              .from("tags")
              .select("id")
              .eq("name", tagName)
              .maybeSingle();

            if (!tagData) {
              const { data: newTag, error: newTagError } = await supabase
                .from("tags")
                .insert({ name: tagName })
                .select("id")
                .single();

              if (!newTagError) tagData = newTag;
            }

            return tagData;
          })(),
        );
      }

      return tagPromiseCache.get(tagName);
    }

    const uploadedDocuments = await mapWithConcurrency(
      processedFilesData,
      FILE_UPLOAD_CONCURRENCY,
      async (processedData) => {
      const { file, fileIndex, extractedText } = processedData;

      const safeFileName = sanitizeFileName(file.originalname);
      const storagePath = `${userID}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || "application/octet-stream"
        });

      if (uploadError) throw uploadError;

      // Xác định status và reject reason dựa trên mức độ nhạy cảm
      let status = isBackgroundUpload ? "PENDING" : "APPROVED";
      let aiRejectReason = null;

      // Lưu thông tin vào DB, bao gồm cả library_id
      let { data: document, error: insertError } = await supabase
        .from("documents")
        .insert({
          uploader_id: userID,
          workspace_id: workspaceId,
          library_id: libraryId,
          title: file.originalname,
          file_url: storagePath,
          file_size_bytes: file.size,
          is_public: targetLibrary ? Boolean(targetLibrary.is_public) : false,
          status: status,
          ai_reject_reason: aiRejectReason,
          tagging_status: "PENDING",
          tagging_error: null,
          tagging_updated_at: new Date().toISOString(),
        })
        .select("*").single();

      if (insertError && isMissingTaggingColumnError(insertError)) {
        const fallbackInsert = await supabase
          .from("documents")
          .insert({
            uploader_id: userID,
            workspace_id: workspaceId,
            library_id: libraryId,
            title: file.originalname,
            file_url: storagePath,
            file_size_bytes: file.size,
            is_public: targetLibrary ? Boolean(targetLibrary.is_public) : false,
            status: status,
            ai_reject_reason: aiRejectReason,
          })
          .select("*").single();

        document = fallbackInsert.data;
        insertError = fallbackInsert.error;
      }

      if (insertError) throw insertError;

      // Lưu tags vào DB
      // Loại bỏ các tag trùng lặp và làm sạch
      const uniqueTags = [...new Set(userTags.map(t => t.trim().toLowerCase().replace("#", "")))];


      // Gọi hàm xử lý AI (embedding và chunking)
      const shouldKeepReviewStatus = Boolean(workspaceId);
      let aiResult = { status };
      if (isBackgroundUpload) {
        // The document is already stored as PENDING. Continue extraction,
        // chunking and embeddings without holding the upload
        // response open. processDocumentWithAI records controlled failure
        // states, including PENDING_RETRY.
        void processWorkspaceDocumentInBackground(
          file,
          document.id,
          storagePath,
          userTags,
          {
            userId: userID,
            documentTitle: file.originalname,
            libraryId,
            workspaceId,
            libraryName: targetLibrary?.name || null,
          },
        ).catch((processingError) => {
          console.error(
            "Background workspace document processing failed:",
            processingError,
          );
        });
      } else {
        aiResult = await processDocumentWithAI(
          file,
          document.id,
          extractedText,
          shouldKeepReviewStatus ? status : null,
          shouldKeepReviewStatus ? aiRejectReason : null,
          {
            userId: userID,
            documentTitle: file.originalname,
            libraryId,
            workspaceId,
            libraryName: targetLibrary?.name || null,
          },
          processedData.tagValidationResult.hierarchicalTags || null,
        );
      }

      // Call notification service to persist document upload notification log
      await notifyDocumentUploaded({
        userId: userID,
        documentId: document.id,
        documentTitle: file.originalname,
        libraryId,
        workspaceId,
        libraryName: targetLibrary?.name || null,
      });

        const replacedDocumentIds =
          duplicateDecision.replacementTargetIds[fileIndex] || [];

        if (
          replacedDocumentIds.length > 0 &&
          (isBackgroundUpload || aiResult.status === "APPROVED")
        ) {
          const replacementTimestamp = new Date().toISOString();
          let replacementDeleteQuery = supabase
            .from("documents")
            .update({ deleted_at: replacementTimestamp })
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
              .update({ deleted_at: replacementTimestamp })
              .eq("id", document.id);
            throw replacementDeleteError;
          }
        }

        return {
          ...document,
          status: aiResult.status,
          replaced_document_ids: replacedDocumentIds,
        };
      },
    );

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
        message: "Vui lòng chọn ít nhất một tệp để AI gợi ý tag.",
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

exports.retryDocumentTags = async (req, res) => {
  try {
    const userID = req.user.id;
    const { documentId } = req.params;
    const { data: document, error } = await supabase
      .from("documents")
      .select(
        "id, uploader_id, library_id, workspace_id, title, file_url, file_size_bytes, status",
      )
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }
    if (String(document.uploader_id) !== String(userID)) {
      return res.status(403).json({
        status: "error",
        message: "You can only retry tags for documents you uploaded.",
      });
    }

    await updateDocumentTaggingState(documentId, "PENDING");
    const file = await loadDocumentFileForProcessing(document);
    const result = await processDocumentWithAI(
      file,
      document.id,
      null,
      ["APPROVED", "FLAGGED"].includes(
        String(document.status || "").toUpperCase(),
      )
        ? document.status
        : null,
      null,
      {
        userId: userID,
        documentTitle: document.title,
        libraryId: document.library_id,
        workspaceId: document.workspace_id,
      },
    );

    const taggingCompleted = result.tagging_status === "COMPLETED";
    return res.status(taggingCompleted ? 200 : 503).json({
      status: taggingCompleted ? "success" : "error",
      code: taggingCompleted ? undefined : "TAGGING_RETRY_FAILED",
      message: taggingCompleted
        ? "AI tags and document content were regenerated successfully."
        : result.error || "AI tag regeneration did not complete.",
      data: {
        documentId,
        tagging_status: result.tagging_status,
        ai_ready: Number(result.chunkCount || 0) > 0,
      },
    });
  } catch (error) {
    console.error("Retry document tags error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not retry AI tag generation.",
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
        message: "Không tìm thấy tài liệu.",
      });
    }

    if (!(await canAccessDocument(document, userID))) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền truy cập tài liệu này.",
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
    console.error("Lỗi downloadDocument:", error);

    return res.status(500).json({
      status: "error",
      message: "Không thể tải tài liệu.",
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
        workspaceRoles: ["Admin", "Editor"],
        allowWorkspaceUploader: false,
      }))
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this document.",
      });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(document.file_url, 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError;

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
        message: "Không tìm thấy tài liệu.",
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
        message: "Bạn không có quyền xóa tài liệu này.",
      });
    }

    // Xóa file vật lý khỏi Supabase Storage.
    if (document.file_url) {
      try {
        await supabase.storage.from(BUCKET).remove([document.file_url]);
      } catch (storageErr) {
        console.warn("[deleteDocument] Warning removing file from storage:", storageErr);
      }
    }

    // Xóa dữ liệu vector chunks của tệp tin trong DB
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      throw updateError;
    }

    const { error: deleteTagsError } = await supabase
      .from("document_tags")
      .delete()
      .eq("document_id", documentId);

    if (deleteTagsError) {
      console.warn("deleteDocument tags cleanup warning:", deleteTagsError.message);
    }

    try {
      await notifyDocumentDeleted({
        userId: userID,
        documentId: document.id,
        documentTitle: document.title,
        libraryId: document.library_id,
        workspaceId: document.workspace_id,
      });
    } catch (notifErr) {
      console.warn("Could not record document deletion notification:", notifErr.message);
    }

    return res.status(200).json({
      status: "success",
      message: "Xóa tài liệu thành công.",
    });
  } catch (error) {
    console.error("Lỗi deleteDocument:", error);

    return res.status(500).json({
      status: "error",
      message: "Không thể xóa tài liệu.",
      error: error.message,
    });
  }
};

// Hàm API cập nhật trạng thái của thư viện
exports.createLibrary = async (req, res) => {
  try {
    const userID = req.user.id;
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const isPublic = req.body?.is_public === true;

    if (
      userID === "guest" ||
      userID === "00000000-0000-0000-0000-000000000000" ||
      req.user.role === "GUEST"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot create libraries.",
      });
    }

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Library name is required.",
      });
    }

    if (name.length > 100 || description.length > 500) {
      return res.status(400).json({
        status: "error",
        message: "Library names can contain up to 100 characters and descriptions up to 500 characters.",
      });
    }

    const { data: existingLibrary, error: searchError } = await supabase
      .from("libraries")
      .select("id")
      .eq("user_id", userID)
      .ilike("name", name)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingLibrary) {
      return res.status(409).json({
        status: "error",
        message: `A library named "${name}" already exists.`,
      });
    }

    const { data, error } = await supabase
      .from("libraries")
      .insert({
        user_id: userID,
        name,
        description: description || null,
        is_public: isPublic,
        share_on_profile: false,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: { ...data, documents: 0 },
    });
  } catch (error) {
    console.error("createLibrary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not create the library.",
      error: error.message,
    });
  }
};

exports.updateLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_public, share_on_profile } = req.body;
    const userID = req.user.id;

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot update libraries.",
      });
    }

    const { data: targetLib, error: getLibErr } = await supabase
      .from("libraries")
      .select("id, user_id, is_public")
      .eq("id", id)
      .maybeSingle();

    if (getLibErr || !targetLib) {
      return res.status(404).json({
        status: "error",
        message: "Library not found.",
      });
    }

    if (String(targetLib.user_id) !== String(userID)) {
      return res.status(403).json({
        status: "error",
        message: "You can only update your own library.",
      });
    }

    if (name && name.trim() !== "") {
      const { data: existingLib, error: searchError } = await supabase
        .from("libraries")
        .select("id")
        .eq("user_id", userID)
        .ilike("name", name.trim())
        .neq("id", id)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existingLib) {
        return res.status(400).json({
          status: "error",
          message: "Tên thư viện \"" + name.trim() + "\" đã được sử dụng ở một thư viện khác của bạn.",
        });
      }
    }

    const { data, error } = await supabase
      .from("libraries")
      .update({
        name: name ? name.trim() : undefined,
        description,
        is_public,
        share_on_profile
      })
      .eq("id", id)
      .eq("user_id", userID)
      .select().single();

    if (error) throw error;

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// Hàm API lấy danh sách thư viện của người dùng đăng nhập
exports.listMyLibraries = async (req, res) => {
  try {
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const { data: libraries, error } = await supabase
      .from("libraries")
      .select("*")
      .eq("user_id", userID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const libraryIds = (libraries || []).map(lib => lib.id);
    const docCountsMap = {};

    if (libraryIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("library_id")
        .in("library_id", libraryIds)
        .is("deleted_at", null);

      if (!docsError && docs) {
        docs.forEach(doc => {
          if (doc.library_id) {
            docCountsMap[doc.library_id] = (docCountsMap[doc.library_id] || 0) + 1;
          }
        });
      }
    }

    const mapped = (libraries || []).map(lib => ({
      ...lib,
      documents: docCountsMap[lib.id] || 0
    }));

    return res.status(200).json({
      status: "success",
      data: mapped,
    });
  } catch (error) {
    console.error("Lỗi listMyLibraries:", error);
    return res.status(500).json({
      status: "error",
      message: "Không thể tải danh sách thư viện cá nhân.",
      error: error.message,
    });
  }
};

// Hàm API lấy thông tin một thư viện cụ thể
exports.getLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    const { data, error } = await supabase
      .from("libraries")
      .select("*")
      .eq("id", libraryId)
      .eq("user_id", userID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy thư viện.",
      });
    }

    const [{ count: docCount, error: docCountError }, { count: downloadCount, error: downloadCountError }] =
      await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("library_id", libraryId).is("deleted_at", null),
        supabase.from("library_downloads").select("id", { count: "exact", head: true }).eq("library_id", libraryId),
      ]);

    if (docCountError) throw docCountError;
    if (downloadCountError) throw downloadCountError;

    const mapped = {
      ...data,
      documents: docCount || 0,
      downloads: downloadCount || 0,
    };

    return res.status(200).json({
      status: "success",
      data: mapped,
    });
  } catch (error) {
    console.error("Lỗi getLibrary:", error);
    return res.status(500).json({
      status: "error",
      message: "Không thể tải thông tin thư viện.",
      error: error.message,
    });
  }
};


// Hàm API xóa thư viện
exports.deleteLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot delete libraries.",
      });
    }

    const { data: targetLib, error: findLibErr } = await supabase
      .from("libraries")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (findLibErr) throw findLibErr;

    if (!targetLib) {
      return res.status(404).json({
        status: "error",
        message: "Library not found.",
      });
    }

    if (String(targetLib.user_id) !== String(userID)) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own library.",
      });
    }

    // Attempt RPC call first
    let rpcSuccess = false;
    try {
      const { error: rpcError } = await supabase.rpc("delete_owned_library", {
        p_library_id: id,
        p_user_id: userID,
      });

      if (rpcError) {
        if (String(rpcError.message).includes("LIBRARY_NOT_FOUND")) {
          return res.status(404).json({
            status: "error",
            message: "Library not found.",
          });
        }
        if (String(rpcError.message).includes("LIBRARY_OWNER_REQUIRED")) {
          return res.status(403).json({
            status: "error",
            message: "You can only delete your own library.",
          });
        }
        if (
          !String(rpcError.message).includes("schema cache") &&
          !String(rpcError.message).includes("Could not find the function")
        ) {
          console.warn("RPC delete_owned_library failed, falling back to direct queries:", rpcError.message);
        }
      } else {
        rpcSuccess = true;
      }
    } catch (rpcErr) {
      if (
        !String(rpcErr?.message).includes("schema cache") &&
        !String(rpcErr?.message).includes("Could not find the function")
      ) {
        console.warn("RPC delete_owned_library threw exception, falling back to direct queries:", rpcErr.message);
      }
    }

    // Fallback if RPC fails or is missing on backend database
    if (!rpcSuccess) {
      await supabase.from("library_downloads").delete().eq("library_id", id);
      await supabase
        .from("documents")
        .update({ library_id: null, is_public: false })
        .eq("library_id", id);

      const { error: deleteLibError } = await supabase
        .from("libraries")
        .delete()
        .eq("id", id)
        .eq("user_id", userID);

      if (deleteLibError) throw deleteLibError;
    }

    return res.status(200).json({
      status: "success",
      message: "Xóa thư viện thành công.",
    });
  } catch (error) {
    console.error("Lỗi deleteLibrary:", error);
    return res.status(500).json({
      status: "error",
      message: "Không thể xóa thư viện.",
      error: error.message,
    });
  }
};
