const express = require("express");
const multer = require("multer");
const path = require("path");

const authMiddleware = require("../middleware/authMiddleware");

const {
    listMyDocuments,
    uploadDocuments,
    downloadDocument,
    deleteDocument,
    createLibrary,
} = require("../controllers/documentController");

const router = express.Router();

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]);
const allowedExtensions = new Set([".pdf", ".docx", ".txt"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();

        if (
            !allowedMimeTypes.has(file.mimetype) ||
            !allowedExtensions.has(extension)
        ) {
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

router.post("/libraries", authMiddleware, createLibrary);

router.get("/:documentId/download", authMiddleware, downloadDocument);

router.delete("/:documentId", authMiddleware, deleteDocument);

module.exports = router;
