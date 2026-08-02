const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/issueReport/issueReportController");
const router = express.Router();
router.use(authMiddleware);
router.post("/", controller.submitIssue);
router.get("/me", controller.getMyIssues);
module.exports = router;
