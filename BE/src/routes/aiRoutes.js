const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  chatWithDocument,
  generateFlashcards,
} = require("../controllers/aiController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.post("/documents/:documentId/flashcards", authMiddleware, generateFlashcards);

module.exports = router;