const express = require("express");
const publicController = require("../controllers/publicController");

const router = express.Router();

router.get("/libraries", publicController.listPublicLibraries);
router.get("/libraries/:libraryId", publicController.getPublicLibrary);
router.post("/libraries/:libraryId/download", publicController.recordPublicLibraryDownload);
router.get("/documents/:documentId/download", publicController.downloadPublicDocument);

module.exports = router;
