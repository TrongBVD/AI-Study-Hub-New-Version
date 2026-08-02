const documentManagementController = require("./document/documentManagementController");
const libraryController = require("./document/libraryController");
const documentHelpers = require("./document/documentHelpers");

module.exports = {
  ...documentHelpers,
  ...documentManagementController,
  ...libraryController,
};
