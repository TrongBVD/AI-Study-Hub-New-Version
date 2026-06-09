const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const {
    listMyDocuments,
    uploadDocuments,
    downloadDocument,
} = require("../controllers/documentController");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 10,
    },
});

router.get("/", authMiddleware, listMyDocuments);

router.post(
    "/upload",
    authMiddleware,
    upload.array("files", 10),
    uploadDocuments
);

router.get("/:documentId/download", authMiddleware, downloadDocument);

module.exports = router;