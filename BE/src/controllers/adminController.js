const adminDashboardController = require("./admin/adminDashboardController");
const adminUserController = require("./admin/adminUserController");
const adminWorkspaceController = require("./admin/adminWorkspaceController");
const adminHelpers = require("./admin/adminHelpers");

module.exports = {
  ...adminHelpers,
  ...adminDashboardController,
  ...adminUserController,
  ...adminWorkspaceController,
};
