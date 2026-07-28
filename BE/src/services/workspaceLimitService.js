const supabase = require("../config/supabase");

const MAX_OWNED_WORKSPACES = 3;

async function countActiveOwnedWorkspaces(userId) {
  const { count, error } = await supabase
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .is("deleted_at", null);

  if (error) throw error;
  return count || 0;
}

module.exports = { MAX_OWNED_WORKSPACES, countActiveOwnedWorkspaces };
