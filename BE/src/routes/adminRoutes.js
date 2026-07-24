const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const adminController = require("../controllers/adminController");
const issueReportController = require("../controllers/issueReportController");

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get("/dashboard", adminController.getDashboardStats);
router.get("/moderation", adminController.getModerationDocuments);
router.get("/moderation/:documentId/view", adminController.viewModerationDocument);
router.patch("/moderation/:documentId", adminController.reviewDocument);

router.get("/users", adminController.getUsers);
router.patch("/users/:userId/status", adminController.updateUserStatus);
router.patch("/users/:userId/role", adminController.updateUserRole);

router.get("/logs", adminController.getActivityLogs);
router.get("/usage", adminController.getUsage);

router.get("/workspaces/deleted", adminController.getDeletedWorkspaces);
router.patch("/workspaces/:workspaceId/restore", adminController.restoreWorkspace);
router.get("/workspaces/:workspaceId/purge-preview", adminController.getWorkspacePurgePreview);
router.delete("/workspaces/:workspaceId/permanent", adminController.permanentlyDeleteWorkspace);
router.get("/issues", issueReportController.getAdminIssues);
router.get("/issues/:issueId", issueReportController.getAdminIssue);
router.patch("/issues/:issueId", issueReportController.updateAdminIssue);

module.exports = router;
