const authService = require('../../services/authService');
const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    buildPublicUser,
} = require("../../utils/authHelpers");

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function getRefreshCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/api/auth",
    };
}

function getCookie(req, name) {
    const cookies = String(req.headers.cookie || "").split(";");
    const prefix = `${name}=`;
    const cookie = cookies.map((value) => value.trim()).find((value) => value.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function setRefreshCookie(res, refreshToken, rememberMe = true) {
    const options = getRefreshCookieOptions();
    if (rememberMe) options.maxAge = REFRESH_COOKIE_MAX_AGE;
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, options);
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

exports.googleLogin = async (req, res) => {
    try {
        const { token, rememberMe = false } = req.body;
        const result = await authService.verifyAndLoginGoogle(token);
        if (result.refreshToken) {
            const user = verifyRefreshToken(result.refreshToken);
            setRefreshCookie(
                res,
                signRefreshToken({ id: user.userId, session_id: user.session_id }, rememberMe),
                rememberMe,
            );
            delete result.refreshToken;
        }
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        console.error("🔴 GOOGLE LOGIN BACKEND ERROR:", error);
        const errMsg = String(error?.message || "").toLowerCase();
        const isTokenError =
            errMsg.includes("token") ||
            errMsg.includes("invalid") ||
            errMsg.includes("jwt") ||
            errMsg.includes("audience") ||
            errMsg.includes("signature") ||
            errMsg.includes("segment") ||
            errMsg.includes("oauth");

        return res.status(isTokenError ? 401 : 400).json({
            status: 'error',
            message: isTokenError ? 'Invalid Google token.' : (error.message || 'Google authentication failed.')
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password, rememberMe = false } = req.body;

        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.eq.${username},email.eq.${username}`)
            .maybeSingle();

        if (error) throw error;

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Account does not exist.' });
        }

        if (user.password_hash === 'GOOGLE_SSO_NO_PASSWORD') {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Password setup for this account is incomplete. Please sign in with Google.' });
        }
        if (user.status === "DISABLED") {
            return res.status(403).json({
                status: "error",
                message: "Your account has been disabled. Please contact an administrator."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                code: 'WRONG_PASSWORD',
                message: 'Incorrect password. Please check your password or choose Forgot Password to reset.'
            });
        }

        const currentSessionId = crypto.randomUUID();
        user.session_id = currentSessionId;

        const accessToken = signAccessToken(user);

        const { error: sessionError } = await supabase
            .from("profiles")
            .update({
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                session_id: currentSessionId
            })
            .eq("id", user.id);

        if (sessionError) throw sessionError;

        setRefreshCookie(res, signRefreshToken(user, rememberMe), rememberMe);
            
        res.status(200).json({
            status: "success",
            data:{
                accessToken,
                user: buildPublicUser(user),
            },
        });
    } catch (error) {
        console.error("🔴 Lỗi hệ thống Login:", error);
        res.status(500).json({ status: 'error', message: 'Internal server error. Please try again.' });
    }
};

exports.refresh = async (req, res) => {
  try {
    const token = getCookie(req, REFRESH_COOKIE_NAME);
    if (!token) {
      return res.status(401).json({
        status: "error",
        code: "REFRESH_TOKEN_MISSING",
        message: "Refresh session is missing.",
      });
    }

    const payload = verifyRefreshToken(token);
    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, status, session_id")
      .eq("id", payload.userId)
      .maybeSingle();

    if (error) throw error;

    if (
      !user ||
      user.status === "DISABLED" ||
      !user.session_id ||
      user.session_id !== payload.session_id
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({
        status: "error",
        code: "SESSION_EXPIRED",
        message: "The refresh session is no longer valid.",
      });
    }

    const accessToken = signAccessToken(user);
    setRefreshCookie(
      res,
      signRefreshToken(user, payload.rememberMe),
      payload.rememberMe,
    );

    return res.status(200).json({
      status: "success",
      data: {
        accessToken,
        user: buildPublicUser(user),
      },
    });
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({
      status: "error",
      code: "REFRESH_TOKEN_INVALID",
      message: "Refresh session has expired or is invalid.",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const token = getCookie(req, REFRESH_COOKIE_NAME);

    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await supabase
          .from("profiles")
          .update({ session_id: null, updated_at: new Date().toISOString() })
          .eq("id", payload.userId)
          .eq("session_id", payload.session_id);
      } catch {
        // An invalid/expired cookie still needs to be removed.
      }
    }
  } finally {
    clearRefreshCookie(res);
  }

  return res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
};

exports.getRefreshCookieOptions = getRefreshCookieOptions;
exports.getCookie = getCookie;
exports.setRefreshCookie = setRefreshCookie;
exports.clearRefreshCookie = clearRefreshCookie;
