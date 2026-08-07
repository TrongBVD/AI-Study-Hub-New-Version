const supabase = require("../config/supabase");

/**
 * Record or update bytes_uploaded for a user on a given date in daily_quota_usage.
 */
async function recordDailyQuotaUpload(userId, bytesUploaded) {
  if (
    !userId ||
    userId === "guest" ||
    userId === "00000000-0000-0000-0000-000000000000" ||
    Number(bytesUploaded) <= 0
  ) {
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const bytes = Number(bytesUploaded) || 0;

  try {
    const { data: existing } = await supabase
      .from("daily_quota_usage")
      .select("id, bytes_uploaded")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("daily_quota_usage")
        .update({ bytes_uploaded: Number(existing.bytes_uploaded || 0) + bytes })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_quota_usage")
        .insert({
          user_id: userId,
          usage_date: today,
          bytes_uploaded: bytes,
          bytes_downloaded: 0,
        });
    }
  } catch (err) {
    console.warn("Could not record daily quota upload:", err.message);
  }
}

/**
 * Record or update bytes_downloaded for a user on a given date in daily_quota_usage.
 */
async function recordDailyQuotaDownload(userId, bytesDownloaded) {
  if (
    !userId ||
    userId === "guest" ||
    userId === "00000000-0000-0000-0000-000000000000" ||
    Number(bytesDownloaded) <= 0
  ) {
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const bytes = Number(bytesDownloaded) || 0;

  try {
    const { data: existing } = await supabase
      .from("daily_quota_usage")
      .select("id, bytes_downloaded")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("daily_quota_usage")
        .update({ bytes_downloaded: Number(existing.bytes_downloaded || 0) + bytes })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_quota_usage")
        .insert({
          user_id: userId,
          usage_date: today,
          bytes_uploaded: 0,
          bytes_downloaded: bytes,
        });
    }
  } catch (err) {
    console.warn("Could not record daily quota download:", err.message);
  }
}

module.exports = {
  recordDailyQuotaUpload,
  recordDailyQuotaDownload,
};
