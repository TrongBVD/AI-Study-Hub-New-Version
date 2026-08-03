const aiCoreController = require("./aiCoreController");

module.exports = {
  chatWithDocument: aiCoreController.chatWithDocument,
  getChatHistory: aiCoreController.getChatHistory,
  deleteChatHistoryItem: aiCoreController.deleteChatHistoryItem,
  clearChatHistory: aiCoreController.clearChatHistory,
};
