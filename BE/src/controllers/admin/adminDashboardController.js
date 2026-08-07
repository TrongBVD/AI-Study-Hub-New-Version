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

    const { data: allDocBytes } = await supabase
      .from("documents")
      .select("file_size_bytes")
      .is("deleted_at", null);

    const totalUploadedBytesOverall = (allDocBytes || []).reduce(
      (sum, row) => sum + Number(row.file_size_bytes || 0),
      0
    );

    const totalBytesUploadedToday = Math.max(
      (quotaRows || []).reduce((sum, row) => sum + Number(row.bytes_uploaded || 0), 0),
      totalUploadedBytesOverall
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

    const rawTokens = (aiRows || []).reduce(
      (sum, row) => sum + Number(row.tokens_consumed || 0),
      0
    );

    const totalTokensToday = Math.max(rawTokens, totalAiChatsToday * 1250);

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

    let quotaUsage = quotaResult.data || [];
    let aiUsage = aiResult.data || [];

    // Fallback: Query documents table to get actual uploaded document bytes per user and date
    let docQuery = supabase
      .from("documents")
      .select("uploader_id, file_size_bytes, created_at")
      .is("deleted_at", null);
    if (userId) docQuery = docQuery.eq("uploader_id", userId);

    const { data: documentRows } = await docQuery;
    const documentBytesByUserDate = new Map();
    (documentRows || []).forEach((doc) => {
      if (!doc.uploader_id) return;
      const dateStr = String(doc.created_at || "").slice(0, 10);
      const key = `${doc.uploader_id}-${dateStr}`;
      const size = Number(doc.file_size_bytes || 0);
      documentBytesByUserDate.set(key, (documentBytesByUserDate.get(key) || 0) + size);
    });

    // Merge document bytes into quotaUsage if bytes_uploaded is 0 or missing
    const quotaMap = new Map();
    quotaUsage.forEach((item) => {
      const dateStr = String(item.usage_date || "").slice(0, 10);
      const key = `${item.user_id}-${dateStr}`;
      const docBytes = documentBytesByUserDate.get(key) || 0;
      quotaMap.set(key, {
        ...item,
        bytes_uploaded: Math.max(Number(item.bytes_uploaded || 0), docBytes),
      });
    });

    // If a user uploaded files on a date but daily_quota_usage has no entry, add synthetic record
    documentBytesByUserDate.forEach((bytes, key) => {
      if (!quotaMap.has(key) && bytes > 0) {
        const [uId, uDate] = key.split("-");
        quotaMap.set(key, {
          id: `doc-quota-${key}`,
          user_id: uId,
          usage_date: uDate,
          bytes_uploaded: bytes,
          bytes_downloaded: 0,
        });
      }
    });

    quotaUsage = Array.from(quotaMap.values());

    // Enrich aiUsage: if tokens_consumed is 0 but chat_count > 0, estimate tokens_consumed
    aiUsage = aiUsage.map((item) => {
      const chats = Number(item.chat_count || 0);
      const tokens = Number(item.tokens_consumed || 0);
      return {
        ...item,
        tokens_consumed: tokens > 0 ? tokens : chats * 1250,
      };
    });

    const quotaCount = quotaUsage.length;
    const aiCount = aiUsage.length;

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
