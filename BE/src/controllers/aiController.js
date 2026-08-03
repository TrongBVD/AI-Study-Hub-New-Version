const aiChatController = require("./ai/aiChatController");
const aiSummaryController = require("./ai/aiSummaryController");
const aiFlashcardController = require("./ai/aiFlashcardController");

module.exports = {
  ...aiChatController,
  ...aiSummaryController,
  ...aiFlashcardController,
};
