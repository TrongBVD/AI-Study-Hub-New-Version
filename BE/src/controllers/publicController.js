const publicLibraryController = require("./public/publicLibraryController");
const publicDocumentController = require("./public/publicDocumentController");

module.exports = {
  ...publicLibraryController,
  ...publicDocumentController,
};
