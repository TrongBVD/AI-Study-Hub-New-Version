const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/google', authController.googleLogin);
router.post('/verify-otp', authController.verifyOTP);
router.get('/check-username', authController.checkUsername);
router.post('/complete-setup', authController.completeSetup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;