const supabase = require("../config/supabase");

async function createActivityLog({
    actorUserId,
    actionType,
    entityType,
    entityId,
    oldData = null,
    newData = null,
}) {
    if (!actorUserId || !actionType || !entityType || !entityId) {
        console.error("Missing required activity log fields.");
        return;
    }
    
    const { error } = await supabase.from("activity_logs").insert({
        user_id: actorUserId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
    });

    if (error) {
        console.error("failed to write activity log:", error);
    }
}

module.exports = {
    createActivityLog,
};