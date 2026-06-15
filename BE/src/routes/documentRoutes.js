const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const {
    listMyDocuments,
    uploadDocuments,
    downloadDocument,
    deleteDocument,
} = require("../controllers/documentController");

const router = express.Router();

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return cb(new Error("Only PDF, DOCX, and TXT files are allowed."));
        }

        cb(null, true);
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

router.delete("/:documentId", authMiddleware, deleteDocument);

module.exports = router;