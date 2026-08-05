const express = require("express");
const multer = require("multer");
const path = require("path");
const { rateLimit } = require("express-rate-limit");

const authMiddleware = require("../middleware/authMiddleware");
const {
    listMyDocuments,
    getMyLibraryStorageUsage,
    uploadDocuments,
    suggestDocumentTags,
    retryDocumentTags,
    downloadDocument,
    viewDocument,
    deleteDocument,
} = require("../controllers/document/documentManagementController");

const {
    createLibrary,
    listMyLibraries,
    updateLibrary,
    getLibrary,
    deleteLibrary,
} = require("../controllers/document/libraryController");

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
        fileSize: 50 * 1024 * 1024,
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

const suggestTagsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user.id),
    message: {
        status: "error",
        message: "Too many AI tag requests. Please wait a minute and try again.",
    },
});

router.get("/", authMiddleware, listMyDocuments);
router.get("/storage/usage", authMiddleware, getMyLibraryStorageUsage);

router.post(
    "/suggest-tags",
    authMiddleware,
    suggestTagsLimiter,
    upload.array("files", 10),
    suggestDocumentTags
);

router.post(
    "/upload",
    authMiddleware,
    upload.array("files", 10),
    uploadDocuments
);

router.get("/libraries", authMiddleware, listMyLibraries);
router.post("/libraries", authMiddleware, createLibrary);
router.get("/libraries/:libraryId", authMiddleware, getLibrary);
router.put("/libraries/:id", authMiddleware, updateLibrary);
router.delete("/libraries/:id", authMiddleware, deleteLibrary);

router.get("/:documentId/download", authMiddleware, downloadDocument);
router.get("/:documentId/view", authMiddleware, viewDocument);
router.post("/:documentId/tags/retry", authMiddleware, retryDocumentTags);

router.delete("/:documentId", authMiddleware, deleteDocument);

module.exports = router;
