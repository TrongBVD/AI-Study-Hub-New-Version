const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const workspaceCrudController = require("../controllers/workspace/workspaceCrudController");
const workspaceMemberController = require("../controllers/workspace/workspaceMemberController");
const workspaceChatController = require("../controllers/workspace/workspaceChatController");
const workspaceNotificationController = require("../controllers/workspace/workspaceNotificationController");
const workspaceResourceController = require("../controllers/workspace/workspaceResourceController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", workspaceCrudController.listMyWorkspaces);
router.post("/", workspaceCrudController.createWorkspace);
router.get("/notifications/me", workspaceNotificationController.listMyWorkspaceNotifications);
router.post("/notifications/mark-read", workspaceNotificationController.markAllNotificationsAsRead);
router.get("/:workspaceId", workspaceCrudController.getWorkspace);
router.put("/:workspaceId", workspaceCrudController.updateWorkspace);
router.delete("/:workspaceId", workspaceCrudController.deleteWorkspace);
router.get("/:workspaceId/members", workspaceMemberController.listMembers);
router.get("/:workspaceId/users/search", workspaceMemberController.searchUsers);
router.post("/:workspaceId/leave", workspaceMemberController.leaveWorkspace);
router.post("/:workspaceId/transfer-admin", workspaceMemberController.transferAdminOwnership);
router.post("/invitations/:invitationId/respond", workspaceMemberController.respondToInvitation);
router.post("/:workspaceId/members", workspaceMemberController.addMember);
router.patch(
  "/:workspaceId/members/:userId",
  workspaceMemberController.updateMemberRole
);
router.delete(
  "/:workspaceId/members/:userId",
  workspaceMemberController.removeMember
);
router.get("/:workspaceId/messages", workspaceChatController.listMessages);
router.post("/:workspaceId/messages", workspaceChatController.createMessage);
router.get("/:workspaceId/flashcards", workspaceResourceController.listFlashcards);
router.get("/:workspaceId/documents", workspaceResourceController.listDocuments);
router.patch(
  "/:workspaceId/documents/:documentId/review",
  workspaceResourceController.reviewDocument
);

module.exports = router;
