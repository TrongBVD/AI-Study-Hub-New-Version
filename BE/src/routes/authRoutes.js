const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/google', authController.googleLogin);
router.post('/verify-otp', authController.verifyOTP);
router.get('/check-username', authController.checkUsername);
router.post('/complete-setup', authController.completeSetup);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetPasswordOTP);
router.post('/reset-password', authController.resetPassword);
router.get("/search", authController.searchUsers);
router.get("/users/:id/profile", authController.getUserProfileById);

module.exports = router;
