const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const { clearRefreshCookie } = require('./loginController');

exports.deleteAccount = async (req, res) => {
  try {
    const { password, confirmation } = req.body || {};

    if (confirmation !== "DELETE") {
      return res.status(400).json({
        status: "error",
        message: 'Type "DELETE" to confirm account deletion.',
      });
    }

    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, password_hash")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ status: "error", message: "Account not found." });
    }

    if (user.password_hash !== "GOOGLE_SSO_NO_PASSWORD") {
      if (!password) {
        return res.status(400).json({
          status: "error",
          message: "Current password is required.",
        });
      }

      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        return res.status(400).json({
          status: "error",
          code: "WRONG_PASSWORD",
          message: "Current password is incorrect.",
        });
      }
    }

    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", req.user.id);

    if (deleteError) throw deleteError;

    clearRefreshCookie(res);
    return res.status(200).json({
      status: "success",
      message: "Account deleted successfully.",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to delete the account. Related data may need to be removed first.",
    });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.status(200).json({ status: "success", data: [] });
    }

    const keyword = `%${q.trim()}%`;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, date_of_birth, is_dob_public, email")
      .or(`username.ilike.${keyword},full_name.ilike.${keyword}`)
      .eq("status", "ACTIVE")
      .limit(20);

    if (error) throw error;

    return res.status(200).json({ status: "success", data: data || [] });
  } catch (error) {
    console.error("Lỗi searchUsers:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getUserProfileById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ status: "error", message: "Invalid user ID." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, bio, date_of_birth, is_dob_public, avatar_url")
      .eq("id", id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (profileError) throw profileError;
    
    if (!profile) {
      return res.status(404).json({ status: "error", message: "User not found in system." });
    }

    const { data: libraries, error: libError } = await supabase
      .from("libraries")
      .select("id, user_id, name, description, is_public, created_at")
      .eq("user_id", id)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (libError) {
      console.warn("Unable to load personal libraries, skipping:", libError);
    }

    return res.status(200).json({
      status: "success",
      data: {
        profile,
        libraries: (libraries || []).map((library) => ({
          ...library,
          visibility: "public",
        }))
      }
    });

  } catch (error) {
    console.error("System error in getUserProfileById:", error);
    return res.status(500).json({ status: "error", message: "Internal server error.", error: error.message });
  }
};
