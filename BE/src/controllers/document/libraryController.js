const documentCoreController = require("./documentCoreController");

module.exports = {
  updateLibrary: documentCoreController.updateLibrary,
  listMyLibraries: documentCoreController.listMyLibraries,
  getLibrary: documentCoreController.getLibrary,
  deleteLibrary: documentCoreController.deleteLibrary,
};
