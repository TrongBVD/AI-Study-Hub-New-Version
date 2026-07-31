const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  chatWithDocument,
  getChatHistory,
  deleteChatHistoryItem,
  clearChatHistory,
  generateFlashcards,
  getDocumentFlashcards,
  getAiSummary,
} = require("../controllers/aiController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.get("/chat-history", authMiddleware, getChatHistory);
router.delete("/chat-history", authMiddleware, clearChatHistory);
router.delete("/chat-history/:conversationId", authMiddleware, deleteChatHistoryItem);
router.get("/summary", authMiddleware, getAiSummary);
router.get("/documents/:documentId/flashcards", authMiddleware, getDocumentFlashcards);
router.post("/documents/:documentId/flashcards", authMiddleware, generateFlashcards);

module.exports = router;
