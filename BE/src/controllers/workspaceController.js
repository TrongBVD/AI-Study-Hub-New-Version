const workspaceCrudController = require("./workspace/workspaceCrudController");
const workspaceMemberController = require("./workspace/workspaceMemberController");
const workspaceChatController = require("./workspace/workspaceChatController");
const workspaceNotificationController = require("./workspace/workspaceNotificationController");
const workspaceResourceController = require("./workspace/workspaceResourceController");
const workspaceDiscussionController = require("./workspace/workspaceDiscussionController");
const workspaceHelpers = require("./workspace/workspaceHelpers");

module.exports = {
  ...workspaceHelpers,
  ...workspaceCrudController,
  ...workspaceMemberController,
  ...workspaceChatController,
  ...workspaceNotificationController,
  ...workspaceResourceController,
  ...workspaceDiscussionController,
};
