const supabase = require("../config/supabase");
const { createActivityLog } = require("../services/activityLogService");

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

exports.getDashboardStats = async (req, res) => {
  try {
    const today = getTodayDate();

    const { count: totalUsers, error: userError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (userError) throw userError;

    const { count: totalDocuments, error: documentError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);

    if (documentError) throw documentError;

    const { count: pendingModeration, error: moderationError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("status", ["REJECTED", "FLAGGED", "PENDING_RETRY"])
      .is("deleted_at", null);

    if (moderationError) throw moderationError;

    const { data: quotaRows, error: quotaError } = await supabase
      .from("daily_quota_usage")
      .select("bytes_uploaded, bytes_downloaded")
      .eq("usage_date", today);

    if (quotaError) throw quotaError;

    const totalBytesUploadedToday = (quotaRows || []).reduce(
      (sum, row) => sum + Number(row.bytes_uploaded || 0),
      0
    );

    const totalBytesDownloadedToday = (quotaRows || []).reduce(
      (sum, row) => sum + Number(row.bytes_downloaded || 0),
      0
    );

    const { data: aiRows, error: aiError } = await supabase
      .from("ai_usage_logs")
      .select("tokens_consumed, chat_count")
      .eq("usage_date", today);

    if (aiError) throw aiError;

    const totalAiChatsToday = (aiRows || []).reduce(
      (sum, row) => sum + Number(row.chat_count || 0),
      0
    );

    const totalTokensToday = (aiRows || []).reduce(
      (sum, row) => sum + Number(row.tokens_consumed || 0),
      0
    );

    return res.status(200).json({
      status: "success",
      data: {
        totalUsers: totalUsers || 0,
        totalDocuments: totalDocuments || 0,
        pendingModeration: pendingModeration || 0,
        totalBytesUploadedToday,
        totalBytesDownloadedToday,
        totalAiChatsToday,
        totalTokensToday,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load admin dashboard.",
      error: error.message,
    });
  }
};

exports.getModerationDocuments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select(`
        id,
        uploader_id,
        title,
        file_url,
        file_size_bytes,
        is_public,
        status,
        ai_reject_reason,
        reviewed_by_admin_id,
        reviewed_at,
        admin_review_reason,
        created_at,
        uploader:profiles!documents_uploader_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `)
      .in("status", ["REJECTED", "FLAGGED", "PENDING_RETRY"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Admin moderation list error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load moderation documents.",
      error: error.message,
    });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { decision, reason } = req.body;

    if (!["APPROVE", "KEEP_REJECTED"].includes(decision)) {
      return res.status(400).json({
        status: "error",
        message: "decision must be APPROVE or KEEP_REJECTED.",
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        status: "error",
        message: "Admin review reason is required.",
      });
    }

    const { data: oldDocument, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!oldDocument) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

    const { data: updatedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        status: newStatus,
        reviewed_by_admin_id: req.user.id,
        reviewed_at: new Date().toISOString(),
        admin_review_reason: String(reason).trim(),
      })
      .eq("id", documentId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    await createActivityLog({
      actorUserId: req.user.id,
      actionType: "ADMIN_REVIEW_DOCUMENT",
      entityType: "documents",
      entityId: documentId,
      oldData: oldDocument,
      newData: updatedDocument,
    });

    return res.status(200).json({
      status: "success",
      message: "Document moderation decision saved.",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Admin review document error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not review document.",
      error: error.message,
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    let query = supabase
      .from("profiles")
      .select(`
        id,
        email,
        username,
        full_name,
        role,
        status,
        created_at,
        updated_at,
        last_login_at
      `)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load users.",
      error: error.message,
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!["ACTIVE", "DISABLED"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "status must be ACTIVE or DISABLED.",
      });
    }

    if (String(userId) === String(req.user.id) && status === "DISABLED") {
      return res.status(400).json({
        status: "error",
        message: "Admin cannot disable their own account.",
      });
    }

    const { data: oldUser, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, status, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!oldUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("profiles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, email, username, full_name, role, status, created_at, updated_at")
      .single();

    if (updateError) throw updateError;

    await createActivityLog({
      actorUserId: req.user.id,
      actionType: "ADMIN_UPDATE_USER_STATUS",
      entityType: "profiles",
      entityId: userId,
      oldData: oldUser,
      newData: {
        ...updatedUser,
        admin_reason: reason || null,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "User status updated.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Admin update user status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update user status.",
      error: error.message,
    });
  }
};

exports.getActivityLogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select(`
        id,
        user_id,
        action_type,
        entity_type,
        entity_id,
        old_data,
        new_data,
        created_at,
        actor:profiles!activity_logs_user_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Admin activity logs error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load activity logs.",
      error: error.message,
    });
  }
};

exports.getUsage = async (req, res) => {
  try {
    const { data: quotaUsage, error: quotaError } = await supabase
      .from("daily_quota_usage")
      .select(`
        id,
        user_id,
        usage_date,
        bytes_uploaded,
        bytes_downloaded,
        user:profiles!daily_quota_usage_user_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `)
      .order("usage_date", { ascending: false })
      .limit(100);

    if (quotaError) throw quotaError;

    const { data: aiUsage, error: aiError } = await supabase
      .from("ai_usage_logs")
      .select(`
        id,
        user_id,
        usage_date,
        tokens_consumed,
        chat_count,
        user:profiles!ai_usage_logs_user_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `)
      .order("usage_date", { ascending: false })
      .limit(100);

    if (aiError) throw aiError;

    return res.status(200).json({
      status: "success",
      data: {
        quotaUsage: quotaUsage || [],
        aiUsage: aiUsage || [],
      },
    });
  } catch (error) {
    console.error("Admin usage error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load usage data.",
      error: error.message,
    });
  }
};