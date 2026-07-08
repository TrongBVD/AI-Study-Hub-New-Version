const nodemailer = require("nodemailer");

/**
 * Returns a Nodemailer transporter configured from environment variables.
 * Shared by authService, authController (forgotPassword), and workspaceController.
 */
function createMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 2525,
    secure: String(process.env.EMAIL_PORT) === "465",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

module.exports = { createMailTransporter };
