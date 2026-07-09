const supabase = require("../config/supabase");

async function createActivityLog({
    actorUserId,
    actionType,
    entityType,
    entityId,
    oldData = null,
    newData = null,
    request = null,
    riskLevel = "INFO",
    details = null,
}) {
    if (!actorUserId || !actionType || !entityType || !entityId) {
        throw new Error("Missing required activity log fields.");
    }

    const forwardedFor = request?.headers?.["x-forwarded-for"];
    const ipAddress = String(
        Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor?.split(",")[0] || request?.ip || "",
    ).trim() || null;
    const userAgent = request?.get?.("user-agent") || null;

    const { error } = await supabase.from("activity_logs").insert({
        user_id: actorUserId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        ip_address: ipAddress,
        user_agent: userAgent,
        device: userAgent,
        risk_level: riskLevel,
        details,
    });

    if (error) {
        throw new Error(`Failed to write activity log: ${error.message}`);
    }
}

module.exports = {
    createActivityLog,
};
