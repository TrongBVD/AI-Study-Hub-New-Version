const path = require("path");
const supabase = require("../config/supabase");

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "avatars";

function mapProfile(profile) {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    full_name: profile.full_name,
    bio: profile.bio || "",
    last_name_change: profile.last_name_change,
    date_of_birth: profile.date_of_birth,
    is_dob_public: profile.is_dob_public,
    created_at: profile.created_at,
    role: profile.role,
    status: profile.status,
    updated_at: profile.updated_at,
    last_login_at: profile.last_login_at,
    avatar_url: profile.avatar_url || "",
  };
}

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, bio, last_name_change, date_of_birth, is_dob_public, created_at, role, status, updated_at, last_login_at, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Profile not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mapProfile(profile),
    });
  } catch (error) {
    console.error("Failed to load profile:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load profile.",
      error: error.message,
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const fullName = String(req.body?.full_name || "").trim();

    if (!fullName) {
      return res.status(400).json({
        status: "error",
        message: "Profile name is required.",
      });
    }

    if (fullName.length > 80) {
      return res.status(400).json({
        status: "error",
        message: "Profile name must be 80 characters or fewer.",
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId)
      .select("id, email, username, full_name, bio, last_name_change, date_of_birth, is_dob_public, created_at, role, status, updated_at, last_login_at, avatar_url")
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: mapProfile(profile),
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update profile.",
      error: error.message,
    });
  }
};

exports.updateMyAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: "error",
        message: "Avatar file is required.",
      });
    }

    // 1. Dọn dẹp avatar cũ trong storage nếu tồn tại
    try {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (currentProfile && currentProfile.avatar_url) {
        const oldUrl = currentProfile.avatar_url;
        const marker = `/${AVATAR_BUCKET}/`;
        const markerIndex = oldUrl.indexOf(marker);
        if (markerIndex !== -1) {
          const oldPath = oldUrl.substring(markerIndex + marker.length);
          await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
        }
      }
    } catch (delError) {
      console.warn("Failed to cleanup old avatar file:", delError);
    }

    // 2. Tạo đường dẫn file mới có timestamp để tránh browser cache và CDN cache
    const extension = path.extname(file.originalname || "").toLowerCase() || ".png";
    const avatarPath = `${userId}/avatar_${Date.now()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(avatarPath);

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq("id", userId)
      .select("id, email, username, full_name, last_name_change, date_of_birth, is_dob_public, created_at, role, status, updated_at, last_login_at, avatar_url")
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      status: "success",
      data: mapProfile(profile),
    });
  } catch (error) {
    console.error("Failed to update avatar:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update avatar.",
      error: error.message,
    });
  }
};
