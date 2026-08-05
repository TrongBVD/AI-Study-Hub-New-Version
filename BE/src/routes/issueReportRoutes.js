const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/issueReport/issueReportController");
const router = express.Router();
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".pdf", ".doc", ".docx", ".txt"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => allowedExtensions.has(path.extname(file.originalname || "").toLowerCase())
    ? cb(null, true)
    : cb(new Error("Only images, PDF, DOC, DOCX, and TXT files are allowed.")),
});
function enforceTotalAttachmentSize(req, res, next) {
  const totalSize = (req.files || []).reduce((sum, file) => sum + file.size, 0);
  if (totalSize > 50 * 1024 * 1024) {
    return res.status(400).json({
      status: "error",
      code: "ATTACHMENTS_TOO_LARGE",
      message: "The total attachment size must not exceed 50 MB.",
    });
  }
  return next();
}
router.use(authMiddleware);
router.post("/", upload.array("attachments", 5), enforceTotalAttachmentSize, controller.submitIssue);
router.get("/me", controller.getMyIssues);
router.get("/me/:issueId", controller.getMyIssue);
module.exports = router;
