const crypto = require("crypto");
const path = require("path");
const supabase = require("../../config/supabase");

const {
  extractTextFromFile,
  splitTextIntoChunks,
} = require("../../services/textExtractService");
const {
  moderateDocument,
  createBatchEmbeddings,
  toVectorLiteral,
  validateTagsAndContent,
} = require("../../services/aiService");

const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";
const WAITING_BUCKET = process.env.SUPABASE_DOCUMENT_WAITING_ADMIN_APPROVED || "document_waiting_admin";
const LIBRARY_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const MAX_LIBRARIES_PER_USER = 5;

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
    canUpload: isAdmin || normalizedRole === "editor",
    canReplaceAny: isAdmin,
  };
}

function isSensitiveClassification(classification) {
  const normalizedClassification = String(classification || "")
    .trim()
    .toUpperCase();

  return normalizedClassification === "SEVERE" || normalizedClassification === "MILD";
}

async function processDocumentWithAI(
  file,
  documentId,
  preExtractedText = null,
  overrideStatus = null,
  overrideRejectReason = null,
) {
  try {
    const extractedText = preExtractedText || await extractTextFromFile(file);

    if (!extractedText || extractedText.trim().length < 20) {
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: { reason: "Could not extract enough readable text from this file." },
        })
        .eq("id", documentId);
      return { status: "REJECTED", reason: "Could not extract enough readable text", chunkCount: 0 };
    }

    let status = overrideStatus || "APPROVED";
    let aiRejectReason = overrideRejectReason || null;

    if (!overrideStatus) {
      const moderation = await moderateDocument(extractedText);

      if (moderation.status === "REJECTED") {
        await supabase
          .from("documents")
          .update({ status: "REJECTED", ai_reject_reason: moderation })
          .eq("id", documentId);

        return { status: "REJECTED", reason: moderation.reason, chunkCount: 0 };
      }
    }

    const chunks = splitTextIntoChunks(extractedText);

    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: { reason: "No readable text chunks could be created." },
        })
        .eq("id", documentId);

      return { status: "REJECTED", reason: "No readable text chunks could be created.", chunkCount: 0 };
    }

    const embeddings = await createBatchEmbeddings(chunks, "document");
    const chunkRows = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk,
      embedding: toVectorLiteral(embeddings[index]),
    }));

    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    const { error: chunkInsertError } = await supabase.from("document_chunks").insert(chunkRows);

    if (chunkInsertError) {
      throw chunkInsertError;
    }

    const updatePayload = {
      status: status,
      ai_reject_reason: aiRejectReason,
    };

    await supabase.from("documents").update(updatePayload).eq("id", documentId);

    return {
      status: status,
      reason: "Document processed.",
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error("AI processing failed:", error);

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

    return {
      status: "PENDING_RETRY",
      reason: "AI processing failed. Manual review may be needed.",
      error: error.message,
      chunkCount: 0,
    };
  }
}

async function processWorkspaceDocumentInBackground(
  file,
  documentId,
  storagePath,
  userTags,
) {
  try {
    const extractedText = await extractTextFromFile(file);
    const [moderation, tagValidation] = await Promise.all([
      moderateDocument(extractedText),
      validateTagsAndContent(extractedText, file.originalname, userTags),
    ]);

    if (!tagValidation.isValid) {
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

    const isFlagged = moderation.status === "REJECTED";
    if (isFlagged) {
      const { error: waitingUploadError } = await supabase.storage
        .from(WAITING_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || "application/octet-stream",
          upsert: true,
        });
      if (waitingUploadError) throw waitingUploadError;

      const { error: sourceRemoveError } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
      if (sourceRemoveError) throw sourceRemoveError;
    }

    await processDocumentWithAI(
      file,
      documentId,
      extractedText,
      isFlagged ? "FLAGGED" : "PENDING",
      isFlagged ? moderation : null,
    );
  } catch (error) {
    console.error("Background workspace document validation failed:", error);
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

module.exports = {
  BUCKET,
  WAITING_BUCKET,
  LIBRARY_STORAGE_LIMIT_BYTES,
  MAX_LIBRARIES_PER_USER,
  normalizeUploadedFileName,
  sanitizeFileName,
  getWorkspaceDocumentUploadAccess,
  isSensitiveClassification,
  processDocumentWithAI,
  processWorkspaceDocumentInBackground,
};
