const documentCoreController = require("./documentCoreController");

module.exports = {
  createLibrary: documentCoreController.createLibrary,
  updateLibrary: documentCoreController.updateLibrary,
  listMyLibraries: documentCoreController.listMyLibraries,
  getLibrary: documentCoreController.getLibrary,
  toggleLibraryStar: documentCoreController.toggleLibraryStar,
  getLibraryEngagement: documentCoreController.getLibraryEngagement,
  deleteLibrary: documentCoreController.deleteLibrary,
  toggleStarLibrary: documentCoreController.toggleStarLibrary,
};
