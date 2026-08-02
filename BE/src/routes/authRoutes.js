const express = require('express');
const router = express.Router();
const loginController = require('../controllers/auth/loginController');
const registerController = require('../controllers/auth/registerController');
const passwordController = require('../controllers/auth/passwordController');
const accountController = require('../controllers/auth/accountController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/google', loginController.googleLogin);
router.post('/verify-otp', registerController.verifyOTP);
router.get('/check-username', registerController.checkUsername);
router.post('/complete-setup', registerController.completeSetup);
router.post('/login', loginController.login);
router.post('/refresh', loginController.refresh);
router.post('/logout', loginController.logout);
router.post('/forgot-password', passwordController.forgotPassword);
router.post('/verify-reset-otp', passwordController.verifyResetPasswordOTP);
router.post('/reset-password', passwordController.resetPassword);
router.post('/change-password', authMiddleware, passwordController.changePassword);
router.delete('/account', authMiddleware, accountController.deleteAccount);
router.get("/search", accountController.searchUsers);
router.get("/users/:id/profile", accountController.getUserProfileById);

module.exports = router;
