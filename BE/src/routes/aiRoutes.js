const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  chatWithDocument,
  getChatHistory,
  deleteChatHistoryItem,
  clearChatHistory,
} = require("../controllers/ai/aiChatController");
const { getAiSummary } = require("../controllers/ai/aiSummaryController");
const {
  generateFlashcards,
  getDocumentFlashcards,
  listFlashcardSets,
  getFlashcardSet,
  deleteFlashcardSet,
} = require("../controllers/ai/aiFlashcardController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.get("/chat-history", authMiddleware, getChatHistory);
router.delete("/chat-history", authMiddleware, clearChatHistory);
router.delete("/chat-history/:conversationId", authMiddleware, deleteChatHistoryItem);
router.get("/summary", authMiddleware, getAiSummary);
router.get("/flashcard-sets", authMiddleware, listFlashcardSets);
router.get("/flashcard-sets/:setId", authMiddleware, getFlashcardSet);
router.delete("/flashcard-sets/:setId", authMiddleware, deleteFlashcardSet);
router.post("/flashcards", authMiddleware, generateFlashcards);
router.get("/documents/:documentId/flashcards", authMiddleware, getDocumentFlashcards);
router.post("/documents/:documentId/flashcards", authMiddleware, generateFlashcards);

module.exports = router;
