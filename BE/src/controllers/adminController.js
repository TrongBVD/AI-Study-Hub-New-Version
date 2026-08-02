const adminDashboardController = require("./admin/adminDashboardController");
const adminDocumentController = require("./admin/adminDocumentController");
const adminUserController = require("./admin/adminUserController");
const adminWorkspaceController = require("./admin/adminWorkspaceController");
const adminHelpers = require("./admin/adminHelpers");

module.exports = {
  ...adminHelpers,
  ...adminDashboardController,
  ...adminDocumentController,
  ...adminUserController,
  ...adminWorkspaceController,
};
