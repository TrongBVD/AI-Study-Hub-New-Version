const publicLibraryController = require("../public/publicLibraryController");

/**
 * Guest Controller: Handles guest user restrictions and public library access
 * Blocks guest users from creating libraries or performing protected actions.
 */

exports.getGuestPublicLibraries = async (req, res) => {
  return publicLibraryController.listPublicLibraries(req, res);
};

exports.getGuestPublicLibraryDetail = async (req, res) => {
  return publicLibraryController.getPublicLibrary(req, res);
};

exports.blockGuestAction = (actionName = "perform this action") => {
  return (req, res) => {
    return res.status(403).json({
      status: "error",
      code: "GUEST_FORBIDDEN",
      message: `Guest users are not allowed to ${actionName}. Please log in or create an account.`,
    });
  };
};
