const express = require("express");
const publicLibraryController = require("../controllers/public/publicLibraryController");
const publicDocumentController = require("../controllers/public/publicDocumentController");

const router = express.Router();

router.get("/tags", publicLibraryController.listPublicTags);
router.get("/libraries", publicLibraryController.listPublicLibraries);
router.get("/libraries/:libraryId", publicLibraryController.getPublicLibrary);
router.post("/libraries/:libraryId/download", publicLibraryController.recordPublicLibraryDownload);
router.get("/documents/:documentId/view", publicDocumentController.viewPublicDocument);
router.get("/documents/:documentId/download", publicDocumentController.downloadPublicDocument);

module.exports = router;
