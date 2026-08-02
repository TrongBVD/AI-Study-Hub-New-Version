const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const adminDashboardController = require("../controllers/admin/adminDashboardController");
const adminDocumentController = require("../controllers/admin/adminDocumentController");
const adminUserController = require("../controllers/admin/adminUserController");
const adminWorkspaceController = require("../controllers/admin/adminWorkspaceController");
const issueReportController = require("../controllers/issueReportController");

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get("/dashboard", adminDashboardController.getDashboardStats);
router.get("/moderation", adminDocumentController.getModerationDocuments);
router.get("/moderation/:documentId/view", adminDocumentController.viewModerationDocument);
router.patch("/moderation/:documentId", adminDocumentController.reviewDocument);

router.get("/users", adminUserController.getUsers);
router.patch("/users/:userId/status", adminUserController.updateUserStatus);
router.patch("/users/:userId/role", adminUserController.updateUserRole);

router.get("/logs", adminDashboardController.getActivityLogs);
router.get("/usage", adminDashboardController.getUsage);

router.get("/workspaces/deleted", adminWorkspaceController.getDeletedWorkspaces);
router.patch("/workspaces/:workspaceId/restore", adminWorkspaceController.restoreWorkspace);
router.get("/workspaces/:workspaceId/purge-preview", adminWorkspaceController.getWorkspacePurgePreview);
router.delete("/workspaces/:workspaceId/permanent", adminWorkspaceController.permanentlyDeleteWorkspace);
router.get("/issues", issueReportController.getAdminIssues);
router.get("/issues/:issueId", issueReportController.getAdminIssue);
router.patch("/issues/:issueId", issueReportController.updateAdminIssue);

module.exports = router;
