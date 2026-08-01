const nodemailer = require("nodemailer");

/**
 * Returns a Nodemailer transporter configured from environment variables.
 * Shared by authService, authController (forgotPassword), and workspaceController.
 */
function createMailTransporter() {
  const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
  const emailPort = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isGmail =
    emailHost.includes("gmail") ||
    String(process.env.EMAIL_USER || "").endsWith("@gmail.com");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
}

module.exports = { createMailTransporter };
