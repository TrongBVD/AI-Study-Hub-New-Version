const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {
    signAccessToken,
    signRefreshToken,
    buildPublicUser,
} = require("../../utils/authHelpers");

const { setRefreshCookie } = require("./loginController");

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email.toLowerCase().trim();
        const cleanOtp = String(otp || "").trim();

        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('id, email, password_hash')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (userError) {
            throw userError;
        }

        if (!user || user.password_hash !== 'GOOGLE_SSO_NO_PASSWORD') {
            return res.status(400).json({
                status: 'error',
                message: 'Account is not pending profile completion.'
            });
        }

        const { data: otpRecord, error } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('email', cleanEmail)
            .eq('otp_code', cleanOtp)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("🔴 Supabase query error:", error);
            throw error;
        }

        if (!otpRecord) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid or expired OTP code.'
            });
        }

        await supabase
            .from('otp_tokens')
            .delete()
            .eq('id', otpRecord.id);

        const setupToken = jwt.sign(
            {
                email: cleanEmail,
                type: 'complete_setup'
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '15m'
            }
        );

        res.status(200).json({
            status: 'success',
            data: {
                email: cleanEmail,
                requiresSetup: true,
                setupToken: setupToken
            }
        });
    } catch (error) {
        console.error("🔴 Lỗi hệ thống verifyOTP:", error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error. Please try again.'
        });
    }
};

exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ error: 'Missing username' });

        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        return res.status(200).json({ exists: !!existingUser });
    } catch (error) {
        res.status(500).json({ error: 'Database check failed' });
    }
};

exports.completeSetup = async (req, res) => {
    try {
        const { email, username, password, setupToken } = req.body;

        const cleanEmail = email.toLowerCase().trim();
        const cleanUsername = username.trim();

        let payload;
        try {
            payload = jwt.verify(setupToken, process.env.JWT_SECRET);
        } catch (tokenError) {
            return res.status(401).json({
                status: "error",
                message: "OTP verification session is invalid or has expired."
            });
        }

        if (payload.type !== "complete_setup" || payload.email !== cleanEmail) {
            return res.status(401).json({
                status: "error",
                message: "OTP verification session is invalid or has expired."
            });
        }

        if (!cleanUsername || cleanUsername.length < 3) {
            return res.status(400).json({
                status: "error",
                message: "Username must be at least 3 characters long."
            });
        }

        const { data: existingUser, error: existingError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', cleanUsername)
            .neq('email', cleanEmail)
            .maybeSingle();

        if (existingError) {
            throw existingError;
        }

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Username is already taken.'
            });
        }

        if (!password || password.trim() === "") {
            return res.status(400).json({
                status: 'error',
                message: 'Password is required.'
            });
        }

        const regex = /^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

        if (!regex.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'Password does not meet security requirements.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const { data: updatedUser, error: updateError } = await supabase
            .from('profiles')
            .update({
                username: cleanUsername,
                password_hash: passwordHash
            })
            .eq('email', cleanEmail)
            .eq('password_hash', 'GOOGLE_SSO_NO_PASSWORD')
            .select('id, email, username, full_name, role, status')
            .maybeSingle();

        if (updateError) {
            throw updateError;
        }

        if (!updatedUser) {
            return res.status(400).json({
                status: "error",
                message: "Unable to complete profile setup. Account may have already been configured."
            });
        }

        const currentSessionId = crypto.randomUUID();
        updatedUser.session_id = currentSessionId;

        const { error: sessionError } = await supabase
            .from("profiles")
            .update({
                session_id: currentSessionId,
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", updatedUser.id);

        if (sessionError) throw sessionError;

        const accessToken = signAccessToken(updatedUser);
        setRefreshCookie(res, signRefreshToken(updatedUser));

        res.status(200).json({
            status: 'success',
            message: 'Update successful',
            data: {
                accessToken,
                user: buildPublicUser(updatedUser),
            }
        });
    } catch (error) {
        console.error("🔴 Lỗi completeSetup:", error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};
