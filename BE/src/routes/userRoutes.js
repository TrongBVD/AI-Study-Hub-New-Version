const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const userController = require("../controllers/user/userController");

const router = express.Router();

router.use(authMiddleware);
router.get("/search", userController.searchUsers);
router.patch("/profile-bio", userController.updateProfileBio);

module.exports = router;
