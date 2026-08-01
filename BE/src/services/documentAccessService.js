const supabase = require("../config/supabase");

async function canAccessDocument(document, userId, options = {}) {
  if (!document || !userId) return false;

  const workspaceRoles = Array.isArray(options.workspaceRoles)
    ? options.workspaceRoles.map((role) => String(role).toLowerCase())
    : null;
  const allowWorkspaceUploader = options.allowWorkspaceUploader !== false;

  if (
    String(document.uploader_id) === String(userId) &&
    (!document.workspace_id || allowWorkspaceUploader)
  ) {
    return true;
  }

  if (document.workspace_id) {
    const [{ data: workspace, error: workspaceError }, { data: membership, error: membershipError }] =
      await Promise.all([
        supabase
          .from("workspaces")
          .select("id, created_by")
          .eq("id", document.workspace_id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", document.workspace_id)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    if (workspaceError) throw workspaceError;
    if (membershipError) throw membershipError;
    if (String(workspace?.created_by || "") === String(userId)) return true;
    if (
      workspace &&
      membership &&
      (!workspaceRoles ||
        workspaceRoles.includes(String(membership.role || "").toLowerCase()))
    ) {
      return true;
    }
  }

  if (document.library_id) {
    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id, is_public")
      .eq("id", document.library_id)
      .eq("is_public", true)
      .maybeSingle();

    if (libraryError) throw libraryError;

    return Boolean(
      library &&
      document.is_public === true &&
      document.status === "APPROVED",
    );
  }

  return false;
}

module.exports = { canAccessDocument };
