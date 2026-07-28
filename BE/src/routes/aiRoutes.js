const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  chatWithDocument,
  generateFlashcards,
  getDocumentFlashcards,
  getAiSummary,
} = require("../controllers/aiController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.get("/summary", authMiddleware, getAiSummary);
router.get("/documents/:documentId/flashcards", authMiddleware, getDocumentFlashcards);
router.post("/documents/:documentId/flashcards", authMiddleware, generateFlashcards);

module.exports = router;
