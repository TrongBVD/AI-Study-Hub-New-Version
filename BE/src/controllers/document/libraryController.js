const documentCoreController = require("./documentCoreController");

module.exports = {
  createLibrary: documentCoreController.createLibrary,
  updateLibrary: documentCoreController.updateLibrary,
  listMyLibraries: documentCoreController.listMyLibraries,
  getLibrary: documentCoreController.getLibrary,
  deleteLibrary: documentCoreController.deleteLibrary,
};
