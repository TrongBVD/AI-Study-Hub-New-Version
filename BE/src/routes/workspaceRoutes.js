const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const workspaceController = require("../controllers/workspaceController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", workspaceController.listMyWorkspaces);
router.post("/", workspaceController.createWorkspace);
router.get("/notifications/me", workspaceController.listMyWorkspaceNotifications);
router.get("/:workspaceId", workspaceController.getWorkspace);
router.put("/:workspaceId", workspaceController.updateWorkspace);
router.delete("/:workspaceId", workspaceController.deleteWorkspace);
router.get("/:workspaceId/members", workspaceController.listMembers);
router.get("/:workspaceId/users/search", workspaceController.searchUsers);
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
router.delete("/:workspaceId/discussion/topics/:topicId/attachments/:attachmentId", workspaceController.deleteDiscussionAttachment);
router.get("/:workspaceId/documents", workspaceController.listDocuments);
router.patch(
  "/:workspaceId/documents/:documentId/review",
  workspaceController.reviewDocument
);

module.exports = router;
