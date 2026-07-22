const supabase = require("../config/supabase");

async function createActivityLog({
    actorUserId,
    adminId = null,
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

    const payload = {
        user_id: actorUserId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        risk_level: riskLevel,
        details,
    };

    if (adminId) {
        payload.admin_id = adminId;
    }

    const { error } = await supabase.from("activity_logs").insert(payload);

    if (error) {
        throw new Error(`Failed to write activity log: ${error.message}`);
    }
}

module.exports = {
    createActivityLog,
};
