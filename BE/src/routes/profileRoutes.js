const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getMyProfile,
  updateMyProfile,
  updateMyAvatar,
} = require("../controllers/profileController");

const router = express.Router();

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (
      !allowedMimeTypes.has(file.mimetype) ||
      !allowedExtensions.has(extension)
    ) {
      return cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }

    cb(null, true);
  },
});

router.use(authMiddleware);

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.put("/me/avatar", upload.single("avatar"), updateMyAvatar);

module.exports = router;
