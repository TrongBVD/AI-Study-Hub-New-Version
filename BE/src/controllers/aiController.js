const aiChatController = require("./ai/aiChatController");
const aiSummaryController = require("./ai/aiSummaryController");
const aiFlashcardController = require("./ai/aiFlashcardController");
const aiHelpers = require("./ai/aiHelpers");

module.exports = {
  ...aiHelpers,
  ...aiChatController,
  ...aiSummaryController,
  ...aiFlashcardController,
};
