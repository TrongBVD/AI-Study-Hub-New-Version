const aiCoreController = require("./aiCoreController");

module.exports = {
  generateFlashcards: aiCoreController.generateFlashcards,
  getDocumentFlashcards: aiCoreController.getDocumentFlashcards,
  listFlashcardSets: aiCoreController.listFlashcardSets,
  getFlashcardSet: aiCoreController.getFlashcardSet,
  deleteFlashcardSet: aiCoreController.deleteFlashcardSet,
};
