const documentManagementController = require("./document/documentManagementController");
const libraryController = require("./document/libraryController");

module.exports = {
  ...documentManagementController,
  ...libraryController,
};
