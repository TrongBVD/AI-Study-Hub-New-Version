const crypto = require("crypto");
const path = require("path");
const supabase = require("../config/supabase");

const {
  extractTextFromFile,
  splitTextIntoChunks,
} = require("../services/textExtractService");

const {
  moderateDocument,
  createEmbedding,
  toVectorLiteral,
} = require("../services/aiService");

const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";

function sanitizeFileName(fileName) {
  const baseName = path.basename(fileName || "upload.bin");

  return baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 160);
}

async function processDocumentWithAI(file, documentId) {
  try {
    console.log("Starting AI processing for document:", documentId);

    const extractedText = await extractTextFromFile(file);

    if (!extractedText || extractedText.trim().length < 20) {
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: {
            reason: "Could not extract enough readable text from this file.",
            suspicious_text: [],
          },
        })
        .eq("id", documentId);

      return {
        status: "REJECTED",
        reason: "Could not extract enough readable text from this file.",
        chunkCount: 0,
      };
    }

    const moderation = await moderateDocument(extractedText);

    if (moderation.status === "REJECTED") {
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: moderation,
        })
        .eq("id", documentId);

      return {
        status: "REJECTED",
        reason: moderation.reason,
        chunkCount: 0,
      };
    }

    const chunks = splitTextIntoChunks(extractedText);

    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({
          status: "REJECTED",
          ai_reject_reason: {
            reason: "No readable text chunks could be created.",
            suspicious_text: [],
          },
        })
        .eq("id", documentId);

      return {
        status: "REJECTED",
        reason: "No readable text chunks could be created.",
        chunkCount: 0,
      };
    }

    const chunkRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await createEmbedding(chunks[i], "document");

      chunkRows.push({
        document_id: documentId,
        chunk_index: i,
        content: chunks[i],
        embedding: toVectorLiteral(embedding),
      });
    }

    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    const { error: chunkInsertError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (chunkInsertError) {
      throw chunkInsertError;
    }

    await supabase
      .from("documents")
      .update({
        status: "APPROVED",
        ai_reject_reason: null,
      })
      .eq("id", documentId);

    console.log("AI processing completed for document:", documentId);

    return {
      status: "APPROVED",
      reason: "Document approved by AI moderation.",
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error("AI processing failed:", error);

    await supabase
      .from("documents")
      .update({
        status: "PENDING",
        ai_reject_reason: {
          reason: "AI processing failed. Manual review may be needed.",
          error: error.message,
        },
      })
      .eq("id", documentId);

    return {
      status: "PENDING",
      reason: "AI processing failed. Manual review may be needed.",
      error: error.message,
      chunkCount: 0,
    };
  }
}

exports.listMyDocuments = async (req, res) => {
  try {
    const userID = req.user.id;

    const { data, error } = await supabase
      .from("documents")
      .select(
        `
        id,
        uploader_id,
        workspace_id,
        title,
        file_size_bytes,
        is_public,
        status,
        ai_reject_reason,
        created_at
      `
      )
      .eq("uploader_id", userID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      status: "success",
      data: data || [],
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

exports.uploadDocuments = async (req, res) => {
  try {
    const userID = req.user.id;
    const files = req.files || [];
    const workspaceId = req.body?.workspaceId || null;

    if (files.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Vui lòng chọn ít nhất một tệp để upload.",
      });
    }

    const uploadedDocuments = [];

    for (const file of files) {
      const safeFileName = sanitizeFileName(file.originalname);
      const storagePath = `${userID}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: document, error: insertError } = await supabase
        .from("documents")
        .insert({
          uploader_id: userID,
          workspace_id: workspaceId,
          title: file.originalname,
          file_url: storagePath,
          file_size_bytes: file.size,
          is_public: false,
          status: "PENDING",
          ai_reject_reason: null,
        })
        .select(
          `
          id,
          uploader_id,
          workspace_id,
          title,
          file_size_bytes,
          is_public,
          status,
          ai_reject_reason,
          created_at
        `
        )
        .single();

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }

      const aiResult = await processDocumentWithAI(file, document.id);

      uploadedDocuments.push({
        ...document,
        status: aiResult.status,
        ai_result: aiResult,
      });
    }

    return res.status(201).json({
      status: "success",
      message: "Upload thành công. AI processing completed.",
      data: uploadedDocuments,
    });
  } catch (error) {
    console.error("Lỗi uploadDocuments:", error);

    return res.status(500).json({
      status: "error",
      message: "Không thể upload tài liệu.",
      error: error.message,
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

    const isOwner = String(document.uploader_id) === String(userID);

    if (!isOwner && document.is_public !== true) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền truy cập tài liệu này.",
      });
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from(BUCKET).createSignedUrl(document.file_url, 60, {
        download: document.title,
      });

    if (signedUrlError) {
      throw signedUrlError;
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

    if (!isOwner) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền xóa tài liệu này.",
      });
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      throw updateError;
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