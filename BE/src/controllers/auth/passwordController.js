const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const { createMailTransporter } = require('../../utils/mailerService');

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.toLowerCase().trim();

        const { data: user } = await supabase
            .from('profiles')
            .select('id, email, password_hash')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'This email is not registered in our system.' });
        }
        if (user.password_hash === 'GOOGLE_SSO_NO_PASSWORD') {
            return res.status(400).json({ status: 'error', message: 'This account signs in with Google. Password cannot be changed.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        await supabase.from('otp_tokens').insert([{
            email: cleanEmail,
            otp_code: otpCode,
            expires_at: expiresAt.toISOString()
        }]);

        const transporter = createMailTransporter();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: cleanEmail,
            subject: 'AI StudyHub - Password Reset Code',
            text: `Your password reset code is: ${otpCode}. The code expires in 10 minutes.`
        });

        res.status(200).json({
            status: 'success',
            code: 'OTP_SENT',
            message: 'OTP code has been sent to your email. Valid for 10 minutes.'
        });
    } catch (error) {
        console.error("🔴 Lỗi forgotPassword:", error);
        res.status(500).json({ status: 'error', message: 'Internal server error. Please try again.' });
    }
};

exports.verifyResetPasswordOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email.toLowerCase().trim();
        const cleanOtp = String(otp || "").trim();

        const { data: user, error: userError } = await supabase
            .from("profiles")
            .select("id, email, password_hash")
            .eq("email", cleanEmail)
            .maybeSingle();

        if (userError) throw userError;

        if (!user || user.password_hash === "GOOGLE_SSO_NO_PASSWORD") {
            return res.status(400).json({
                status: "error",
                message: "Invalid recovery information or account does not support password reset."
            });
        }

        const { data: otpRecord, error: otpError } = await supabase
            .from("otp_tokens")
            .select("*")
            .eq("email", cleanEmail)
            .eq("otp_code", cleanOtp)
            .gte("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (otpError) throw otpError;

        if (!otpRecord) {
            return res.status(400).json({
                status: "error",
                message: "Invalid or expired OTP code."
            });
        }

        await supabase
            .from("otp_tokens")
            .delete()
            .eq("id", otpRecord.id);

        const { signPasswordResetToken } = require("../../utils/authHelpers");
        const resetToken = signPasswordResetToken(cleanEmail);

        return res.status(200).json({
            status: "success",
            message: "OTP verification successful.",
            data: {
                email: cleanEmail,
                resetToken
            }
        });
    } catch (error) {
        console.error("🔴 Lỗi verifyResetPasswordOTP:", error);
        return res.status(500).json({
            status: "error",
            message: 'Internal server error. Please try again.'
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        const cleanEmail = email.toLowerCase().trim();

        const { verifyPasswordResetToken } = require("../../utils/authHelpers");

        try {
            verifyPasswordResetToken(resetToken, cleanEmail);
        } catch {
            return res.status(401).json({
                status: "error",
                message: "Password reset session is invalid or has expired."
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                status: "error",
                message: "Password must be >= 8 characters, contain at least 1 lowercase letter, 1 number, 1 special character, and no spaces."
            });
        }

        const { data: user, error: userError } = await supabase
            .from("profiles")
            .select("id, email, password_hash")
            .eq("email", cleanEmail)
            .maybeSingle();

        if (userError) throw userError;

        if (!user || user.password_hash === "GOOGLE_SSO_NO_PASSWORD") {
            return res.status(400).json({
                status: "error",
                message: "Invalid recovery information or account does not support password reset."
            });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ password_hash: passwordHash })
            .eq("id", user.id);

        if (updateError) throw updateError;

        res.status(200).json({
            status: "success",
            message: "Password reset successful. Please sign in again."
        });
    } catch (error) {
        console.error("🔴 Lỗi resetPassword:", error);
        res.status(500).json({
            status: "error",
            message: 'Internal server error. Please try again.'
        });
    }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Current password and new password are required.",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        status: "error",
        message: "New password must contain at least 8 characters, one lowercase letter, one number, and one special character.",
      });
    }

    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, password_hash")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!user || user.password_hash === "GOOGLE_SSO_NO_PASSWORD") {
      return res.status(400).json({
        status: "error",
        message: "This account does not have a password to change.",
      });
    }

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!currentPasswordMatches) {
      return res.status(400).json({
        status: "error",
        code: "WRONG_PASSWORD",
        message: "Current password is incorrect.",
      });
    }

    const reusesCurrentPassword = await bcrypt.compare(
      newPassword,
      user.password_hash,
    );
    if (reusesCurrentPassword) {
      return res.status(400).json({
        status: "error",
        message: "New password must be different from the current password.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", req.user.id);

    if (updateError) throw updateError;

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to change password. Please try again.",
    });
  }
};
