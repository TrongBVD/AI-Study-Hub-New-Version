const supabase = require("../config/supabase");

const MEMBER_ROLES = ["Editor", "Viewer"];

async function getWorkspaceAccess(workspaceId, userId) {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name, description, created_by, created_at")
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workspaceError) throw workspaceError;
  if (!workspace) return { workspace: null, member: null, isAdmin: false };

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) throw memberError;

  const isCreator = String(workspace.created_by) === String(userId);
  const isAdmin = isCreator || member?.role === "Admin";

  return { workspace, member, isAdmin };
}

exports.createWorkspace = async (req, res) => {
  try {
    const userId = req.user.id;
    const name = req.body.name?.trim();
    const description = req.body.description?.trim() || null;

    if (!name) {
      return res
        .status(400)
        .json({ status: "error", message: "Workspace name is required." });
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({ name, description, created_by: userId })
      .select("id, name, description, created_by, created_at")
      .single();

    if (workspaceError) throw workspaceError;

    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: workspace.id, user_id: userId, role: "Admin" });

    if (memberError) throw memberError;

    return res.status(201).json({ status: "success", data: workspace });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not create workspace.",
        error: error.message,
      });
  }
};

exports.listMyWorkspaces = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        `
        role,
        joined_at,
        workspace:workspaces!workspace_members_workspace_id_fkey (
          id,
          name,
          description,
          created_by,
          created_at,
          deleted_at
        )
      `,
      )
      .eq("user_id", req.user.id)
      .is("workspace.deleted_at", null)
      .order("joined_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map((row) => ({
        ...row.workspace,
        myRole: row.role,
        joinedAt: row.joined_at,
      })),
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not load workspaces.",
        error: error.message,
      });
  }
};

exports.getWorkspace = async (req, res) => {
  try {
    const { workspace, member } = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );

    if (!workspace || !member) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    return res.status(200).json({
      status: "success",
      data: { ...workspace, myRole: member.role },
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not load workspace.",
        error: error.message,
      });
  }
};

exports.listMembers = async (req, res) => {
  try {
    const { workspace, member } = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );

    if (!workspace || !member) {
      return res
        .status(403)
        .json({
          status: "error",
          message: "You cannot access this workspace.",
        });
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        `
        role,
        joined_at,
        user:profiles!workspace_members_user_id_fkey (
          id,
          email,
          username,
          full_name,
          status
        )
      `,
      )
      .eq("workspace_id", req.params.workspaceId)
      .order("joined_at", { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not load members.",
        error: error.message,
      });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "")
      .trim()
      .replace(/[,%]/g, "");

    if (q.length < 2) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Search text must be at least 2 characters.",
        });
    }

    const access = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );
    if (!access.workspace || !access.isAdmin) {
      return res
        .status(403)
        .json({
          status: "error",
          message: "Only workspace admins can add members.",
        });
    }

    const { data: existingMembers, error: memberError } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", req.params.workspaceId);

    if (memberError) throw memberError;

    const existingIds = new Set(
      (existingMembers || []).map((m) => String(m.user_id)),
    );

    const { data: users, error: userError } = await supabase
      .from("profiles")
      .select("id, username, full_name, status")
      .neq("status", "DISABLED")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(20);

    if (userError) throw userError;

    return res.status(200).json({
      status: "success",
      data: (users || []).filter((user) => !existingIds.has(String(user.id))),
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not search users.",
        error: error.message,
      });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { userId, role = "Viewer" } = req.body;

    if (!userId || !MEMBER_ROLES.includes(role)) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Valid userId and role are required.",
        });
    }

    const access = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );
    if (!access.workspace || !access.isAdmin) {
      return res
        .status(403)
        .json({
          status: "error",
          message: "Only workspace admins can add members.",
        });
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: req.params.workspaceId,
        user_id: userId,
        role,
      })
      .select("workspace_id, user_id, role, joined_at")
      .single();

    if (error) throw error;

    return res.status(201).json({ status: "success", data });
  } catch (error) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not add member.",
        error: error.message,
      });
  }
};

