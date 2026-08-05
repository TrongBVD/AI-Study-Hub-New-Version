const supabase = require("../../config/supabase");
const {
  getTodayDate,
  getPagination,
  paginationPayload,
} = require("./adminHelpers");

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

exports.getActivityLogs = async (req, res) => {
  try {
    const { page, pageSize, from, to } = getPagination(req.query);
    const action = String(req.query.action || "").trim();
    const actorUserId = String(req.query.userId || "").trim();
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();
    let query = supabase
      .from("activity_logs")
      .select(`
        id,
        user_id,
        admin_id,
        action_type,
        entity_type,
        entity_id,
        old_data,
        new_data,
        risk_level,
        details,
        created_at,
        actor:profiles!activity_logs_user_id_fkey (
          id,
          email,
          username,
          full_name
        ),
        admin:profiles!activity_logs_admin_id_fkey (
          id,
          email,
          username,
          full_name
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (action) query = query.eq("action_type", action);
    if (actorUserId) query = query.eq("user_id", actorUserId);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
      pagination: paginationPayload(count, page, pageSize),
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
    const { page, pageSize, from, to } = getPagination(req.query);
    const userId = String(req.query.userId || "").trim();
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();
    let quotaQuery = supabase
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
      `, { count: "exact" })
      .order("usage_date", { ascending: false })
      .range(from, to);

    if (userId) quotaQuery = quotaQuery.eq("user_id", userId);
    if (startDate) quotaQuery = quotaQuery.gte("usage_date", startDate);
    if (endDate) quotaQuery = quotaQuery.lte("usage_date", endDate);

    let aiQuery = supabase
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
      `, { count: "exact" })
      .order("usage_date", { ascending: false })
      .range(from, to);

    if (userId) aiQuery = aiQuery.eq("user_id", userId);
    if (startDate) aiQuery = aiQuery.gte("usage_date", startDate);
    if (endDate) aiQuery = aiQuery.lte("usage_date", endDate);

    let quotaResult = await quotaQuery;
    if (quotaResult.error) {
      console.warn("getUsage quotaQuery warning, using basic select:", quotaResult.error.message);
      let basicQuotaQuery = supabase
        .from("daily_quota_usage")
        .select("id, user_id, usage_date, bytes_uploaded, bytes_downloaded", { count: "exact" })
        .order("usage_date", { ascending: false })
        .range(from, to);

      if (userId) basicQuotaQuery = basicQuotaQuery.eq("user_id", userId);
      if (startDate) basicQuotaQuery = basicQuotaQuery.gte("usage_date", startDate);
      if (endDate) basicQuotaQuery = basicQuotaQuery.lte("usage_date", endDate);

      const fallbackQuota = await basicQuotaQuery;
      if (fallbackQuota.error) {
        console.warn("daily_quota_usage table missing or empty:", fallbackQuota.error.message);
        quotaResult = { data: [], count: 0, error: null };
      } else {
        quotaResult = fallbackQuota;
      }
    }

    let aiResult = await aiQuery;
    if (aiResult.error) {
      console.warn("getUsage aiQuery warning, using basic select:", aiResult.error.message);
      let basicAiQuery = supabase
        .from("ai_usage_logs")
        .select("id, user_id, usage_date, tokens_consumed, chat_count", { count: "exact" })
        .order("usage_date", { ascending: false })
        .range(from, to);

      if (userId) basicAiQuery = basicAiQuery.eq("user_id", userId);
      if (startDate) basicAiQuery = basicAiQuery.gte("usage_date", startDate);
      if (endDate) basicAiQuery = basicAiQuery.lte("usage_date", endDate);

      const fallbackAi = await basicAiQuery;
      if (fallbackAi.error) {
        console.warn("ai_usage_logs table missing or empty:", fallbackAi.error.message);
        aiResult = { data: [], count: 0, error: null };
      } else {
        aiResult = fallbackAi;
      }
    }

    const quotaUsage = quotaResult.data || [];
    const aiUsage = aiResult.data || [];
    const quotaCount = quotaResult.count || 0;
    const aiCount = aiResult.count || 0;

    // Fetch user profiles for quota and ai usage if not populated by relationship
    const missingUserIds = [...new Set([
      ...quotaUsage.filter((item) => !item.user).map((item) => item.user_id),
      ...aiUsage.filter((item) => !item.user).map((item) => item.user_id),
    ].filter(Boolean))];

    const userProfileMap = new Map();
    if (missingUserIds.length > 0) {
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, email, username, full_name")
        .in("id", missingUserIds);

      (userProfiles || []).forEach((profile) => {
        userProfileMap.set(String(profile.id), profile);
      });
    }

    const mappedQuotaUsage = quotaUsage.map((item) => ({
      ...item,
      user: item.user || userProfileMap.get(String(item.user_id)) || null,
    }));

    const mappedAiUsage = aiUsage.map((item) => ({
      ...item,
      user: item.user || userProfileMap.get(String(item.user_id)) || null,
    }));

    return res.status(200).json({
      status: "success",
      data: {
        quotaUsage: mappedQuotaUsage,
        aiUsage: mappedAiUsage,
      },
      pagination: {
        page,
        pageSize,
        quotaItems: quotaCount,
        aiItems: aiCount,
        totalPages: Math.max(
          1,
          Math.ceil(Math.max(quotaCount, aiCount) / pageSize),
        ),
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
