const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const workspaceController = require("../controllers/workspaceController");

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

router.get("/", workspaceController.listMyWorkspaces);
router.post("/", workspaceController.createWorkspace);
router.get("/notifications/me", workspaceController.listMyWorkspaceNotifications);
router.post("/notifications/mark-read", workspaceController.markAllNotificationsAsRead);
router.get("/:workspaceId", workspaceController.getWorkspace);
router.put("/:workspaceId", workspaceController.updateWorkspace);
router.delete("/:workspaceId", workspaceController.deleteWorkspace);
router.get("/:workspaceId/members", workspaceController.listMembers);
router.get("/:workspaceId/users/search", workspaceController.searchUsers);
router.post("/:workspaceId/leave", workspaceController.leaveWorkspace);
router.post("/:workspaceId/transfer-admin", workspaceController.transferAdminOwnership);
router.post("/invitations/:invitationId/respond", workspaceController.respondToInvitation);
router.post("/:workspaceId/members", workspaceController.addMember);
router.patch(
  "/:workspaceId/members/:userId",
  workspaceController.updateMemberRole
);
router.delete(
  "/:workspaceId/members/:userId",
  workspaceController.removeMember
);
router.get("/:workspaceId/messages", workspaceController.listMessages);
router.post("/:workspaceId/messages", workspaceController.createMessage);
router.get("/:workspaceId/flashcards", workspaceController.listFlashcards);
router.get("/:workspaceId/discussion/topics", workspaceController.listDiscussionTopics);
router.post("/:workspaceId/discussion/topics", workspaceController.createDiscussionTopic);
router.patch("/:workspaceId/discussion/topics/:topicId", workspaceController.updateDiscussionTopic);
router.delete("/:workspaceId/discussion/topics/:topicId", workspaceController.deleteDiscussionTopic);
router.post("/:workspaceId/discussion/topics/:topicId/comments", workspaceController.addDiscussionComment);
router.patch("/:workspaceId/discussion/topics/:topicId/comments/:commentId", workspaceController.updateDiscussionComment);
router.post("/:workspaceId/discussion/topics/:topicId/subtasks", workspaceController.addDiscussionSubtask);
router.patch("/:workspaceId/discussion/topics/:topicId/subtasks/:subtaskId", workspaceController.updateDiscussionSubtask);
router.delete("/:workspaceId/discussion/topics/:topicId/subtasks/:subtaskId", workspaceController.deleteDiscussionSubtask);
router.post("/:workspaceId/discussion/topics/:topicId/attachments", workspaceController.addDiscussionAttachment);
router.post(
  "/:workspaceId/discussion/topics/:topicId/attachments/upload",
  discussionUpload.array("files", 10),
  workspaceController.uploadDiscussionAttachments,
);
router.get(
  "/:workspaceId/discussion/topics/:topicId/attachments/:attachmentId/view",
  workspaceController.viewDiscussionAttachment,
);
router.delete("/:workspaceId/discussion/topics/:topicId/attachments/:attachmentId", workspaceController.deleteDiscussionAttachment);
router.get("/:workspaceId/documents", workspaceController.listDocuments);
router.patch(
  "/:workspaceId/documents/:documentId/review",
  workspaceController.reviewDocument
);

module.exports = router;
