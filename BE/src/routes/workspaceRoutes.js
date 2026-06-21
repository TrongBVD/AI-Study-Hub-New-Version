const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const workspaceController = require("../controllers/workspaceController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", workspaceController.listMyWorkspaces);
router.post("/", workspaceController.createWorkspace);
router.get("/:workspaceId", workspaceController.getWorkspace);
router.get("/:workspaceId/members", workspaceController.listMembers);
router.get("/:workspaceId/users/search", workspaceController.searchUsers);
router.post("/:workspaceId/members", workspaceController.addMember);

module.exports = router;
