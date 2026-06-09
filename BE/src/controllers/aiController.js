const supabase = require("../config/supabase");

const {
  createEmbedding,
  toVectorLiteral,
  answerWithContext,
  generateFlashcardsFromChunks,
} = require("../services/aiService");

async function getAllowedDocument(documentId, userId) {
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!document) return null;

  const isOwner = String(document.uploader_id) === String(userId);

  if (!isOwner && document.is_public !== true) {
    return "FORBIDDEN";
  }

  return document;
}

async function increaseChatUsage(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing, error: selectError } = await supabase
    .from("ai_usage_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing && existing.chat_count >= 50) {
    const error = new Error("Daily AI chatbot quota exceeded.");
    error.statusCode = 429;
    throw error;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("ai_usage_logs")
      .update({ chat_count: existing.chat_count + 1 })
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    usage_date: today,
    chat_count: 1,
    tokens_consumed: 0,
  });

  if (insertError) throw insertError;
}

exports.chatWithDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId, question } = req.body;

    if (!documentId || !question || !question.trim()) {
      return res.status(400).json({
        status: "error",
        message: "documentId and question are required.",
      });
    }

    const document = await getAllowedDocument(documentId, userId);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    if (document === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this document.",
      });
    }

    if (document.status !== "APPROVED") {
      return res.status(400).json({
        status: "error",
        message: "This document is not approved or not ready for AI chat yet.",
      });
    }

    await increaseChatUsage(userId);

    const questionEmbedding = await createEmbedding(question, "query");

    const { data: chunks, error: matchError } = await supabase.rpc(
      "match_document_chunks",
      {
        match_document_id: documentId,
        query_embedding: toVectorLiteral(questionEmbedding),
        match_count: 5,
      }
    );

    if (matchError) throw matchError;

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No AI chunks found for this document. Re-upload or re-process it.",
      });
    }

    const answer = await answerWithContext(question, chunks);

    return res.status(200).json({
      status: "success",
      data: {
        documentId,
        question,
        answer,
        sources: chunks.map((chunk) => ({
          chunk_index: chunk.chunk_index,
          similarity: chunk.similarity,
        })),
      },
    });
  } catch (error) {
    console.error("chatWithDocument error:", error);

    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Could not chat with document.",
    });
  }
};

exports.generateFlashcards = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const document = await getAllowedDocument(documentId, userId);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    if (document === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this document.",
      });
    }

    if (document.status !== "APPROVED") {
      return res.status(400).json({
        status: "error",
        message: "This document is not approved or not ready for flashcard generation yet.",
      });
    }

    const { data: chunks, error: chunkError } = await supabase
      .from("document_chunks")
      .select("chunk_index, content")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })
      .limit(10);

    if (chunkError) throw chunkError;

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No chunks found for this document. Re-upload or re-process it.",
      });
    }

    const cards = await generateFlashcardsFromChunks(chunks);

    await supabase.from("flashcards").delete().eq("document_id", documentId);

    const rows = cards.map((card) => ({
      document_id: documentId,
      question: card.question,
      answer: card.answer,
    }));

    const { data: insertedCards, error: insertError } = await supabase
      .from("flashcards")
      .insert(rows)
      .select("*");

    if (insertError) throw insertError;

    return res.status(201).json({
      status: "success",
      data: insertedCards,
    });
  } catch (error) {
    console.error("generateFlashcards error:", error);

    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate flashcards.",
    });
  }
};