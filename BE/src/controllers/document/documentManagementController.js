const documentCoreController = require("./documentCoreController");

module.exports = {
  listMyDocuments: documentCoreController.listMyDocuments,
  getMyLibraryStorageUsage: documentCoreController.getMyLibraryStorageUsage,
  uploadDocuments: documentCoreController.uploadDocuments,
  suggestDocumentTags: documentCoreController.suggestDocumentTags,
  retryDocumentTags: documentCoreController.retryDocumentTags,
  downloadDocument: documentCoreController.downloadDocument,
  viewDocument: documentCoreController.viewDocument,
  deleteDocument: documentCoreController.deleteDocument,
};
