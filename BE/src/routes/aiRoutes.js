const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireAuthenticatedUser = require("../middleware/requireAuthenticatedUser");

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

router.use(authMiddleware, requireAuthenticatedUser);

router.post("/chat", chatWithDocument);
router.get("/chat-history", getChatHistory);
router.delete("/chat-history", clearChatHistory);
router.delete("/chat-history/:conversationId", deleteChatHistoryItem);
router.get("/summary", getAiSummary);
router.get("/flashcard-sets", listFlashcardSets);
router.get("/flashcard-sets/:setId", getFlashcardSet);
router.delete("/flashcard-sets/:setId", deleteFlashcardSet);
router.post("/flashcards", generateFlashcards);
router.get("/documents/:documentId/flashcards", getDocumentFlashcards);
router.post("/documents/:documentId/flashcards", generateFlashcards);

module.exports = router;
