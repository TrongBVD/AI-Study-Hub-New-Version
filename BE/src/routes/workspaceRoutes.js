const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");

const workspaceCrudController = require("../controllers/workspace/workspaceCrudController");
const workspaceMemberController = require("../controllers/workspace/workspaceMemberController");
const workspaceChatController = require("../controllers/workspace/workspaceChatController");
const workspaceNotificationController = require("../controllers/workspace/workspaceNotificationController");
const workspaceResourceController = require("../controllers/workspace/workspaceResourceController");
const workspaceDiscussionController = require("../controllers/workspace/workspaceDiscussionController");

const router = express.Router();

const discussionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = new Set([".pdf", ".docx", ".txt"]);
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(
      allowedExtensions.has(extension)
        ? null
        : new Error("Only PDF, DOCX, and TXT files are allowed."),
      allowedExtensions.has(extension),
    );
  },
});

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
router.get("/:workspaceId/discussion/topics", workspaceDiscussionController.listDiscussionTopics);
router.post("/:workspaceId/discussion/topics", workspaceDiscussionController.createDiscussionTopic);
router.patch("/:workspaceId/discussion/topics/:topicId", workspaceDiscussionController.updateDiscussionTopic);
router.delete("/:workspaceId/discussion/topics/:topicId", workspaceDiscussionController.deleteDiscussionTopic);
router.post("/:workspaceId/discussion/topics/:topicId/comments", workspaceDiscussionController.addDiscussionComment);
router.patch("/:workspaceId/discussion/topics/:topicId/comments/:commentId", workspaceDiscussionController.updateDiscussionComment);
router.post("/:workspaceId/discussion/topics/:topicId/subtasks", workspaceDiscussionController.addDiscussionSubtask);
router.patch("/:workspaceId/discussion/topics/:topicId/subtasks/:subtaskId", workspaceDiscussionController.updateDiscussionSubtask);
router.delete("/:workspaceId/discussion/topics/:topicId/subtasks/:subtaskId", workspaceDiscussionController.deleteDiscussionSubtask);
router.post("/:workspaceId/discussion/topics/:topicId/attachments", workspaceDiscussionController.addDiscussionAttachment);
router.post(
  "/:workspaceId/discussion/topics/:topicId/attachments/upload",
  discussionUpload.array("files", 10),
  workspaceDiscussionController.uploadDiscussionAttachments,
);
router.get(
  "/:workspaceId/discussion/topics/:topicId/attachments/:attachmentId/view",
  workspaceDiscussionController.viewDiscussionAttachment,
);
router.delete("/:workspaceId/discussion/topics/:topicId/attachments/:attachmentId", workspaceDiscussionController.deleteDiscussionAttachment);
router.get("/:workspaceId/documents", workspaceResourceController.listDocuments);
router.patch(
  "/:workspaceId/documents/:documentId/review",
  workspaceResourceController.reviewDocument
);

module.exports = router;
