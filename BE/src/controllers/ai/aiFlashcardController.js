const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const { generateFlashcardsFromChunks } = require("../../services/aiService");
const {
  ensureDocumentChunks,
  getAllowedDocument,
  increaseChatUsage,
} = require("./aiHelpers");

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

    await increaseChatUsage(userId);

    let chunks = (await ensureDocumentChunks(document)) || [];
    if (!Array.isArray(chunks)) chunks = [];
    chunks = chunks.slice(0, 30);

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No chunks found for this document. Re-upload or re-process it.",
      });
    }

    const generatedCards = await generateFlashcardsFromChunks(chunks);
    const cards = generatedCards.slice(0, 20);

    await supabase.from("flashcards").delete().eq("document_id", documentId);

    const rows = cards.map((card) => ({
      document_id: documentId,
      workspace_id: document.workspace_id || null,
      creator_id: userId,
      question: card.question,
      answer: card.answer,
    }));

    const result = await supabase
      .from("flashcards")
      .insert(rows)
      .select("*");

    if (result.error) throw result.error;
    const cardsList = Array.isArray(result.data) ? result.data : rows;

    if (cardsList.length > 0) {
      await createActivityLog({
        actorUserId: userId,
        actionType: "FLASHCARDS_GENERATED",
        entityType: "document",
        entityId: documentId,
        newData: {
          cardCount: cardsList.length,
          dailyLimit: 20,
        },
        request: req,
        details: `Generated ${cardsList.length} flashcard(s).`,
      });
    }

    return res.status(201).json({
      status: "success",
      data: cardsList,
      quota: {
        dailyLimit: 20,
      },
    });
  } catch (error) {
    console.error("generateFlashcards error:", error);

    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Failed to generate flashcards.",
    });
  }
};

exports.getDocumentFlashcards = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    if (userId === "guest" || userId === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: flashcards, error } = await supabase
      .from("flashcards")
      .select("id, document_id, workspace_id, creator_id, question, answer, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.status(200).json({ status: "success", data: flashcards || [] });
  } catch (error) {
    console.error("getDocumentFlashcards error:", error);
    return res.status(500).json({ status: "error", message: "Could not load flashcards." });
  }
};
