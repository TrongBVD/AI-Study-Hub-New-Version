const supabase = require("../../config/supabase");
const { MAX_OWNED_WORKSPACES, countActiveOwnedWorkspaces } = require("../../services/workspaceLimitService");
const { getWorkspaceAccess, notifyWorkspaceMembers } = require("./workspaceHelpers");

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

    if (userId === "guest" || userId === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot create workspaces.",
      });
    }

    const ownedWorkspaceCount = await countActiveOwnedWorkspaces(userId);

    if ((ownedWorkspaceCount || 0) >= MAX_OWNED_WORKSPACES) {
      return res.status(409).json({
        status: "error",
        code: "WORKSPACE_LIMIT_REACHED",
        message: `You can create up to ${MAX_OWNED_WORKSPACES} workspaces. Delete an existing workspace before creating another one.`,
      });
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

    if (memberError) {
      await supabase.from("workspaces").delete().eq("id", workspace.id);
      throw memberError;
    }

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
    if (req.user.id === "guest") {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        `
        role,
        joined_at,
        workspace:workspaces!workspace_members_workspace_id_fkey!inner (
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
      data: (data || [])
        .filter((row) => row.workspace?.id)
        .map((row) => ({
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
    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );

    if (!workspace || (!member && !isAdmin)) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    return res.status(200).json({
      status: "success",
      data: { ...workspace, myRole: member?.role || "Admin" },
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

exports.updateWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const { name, description } = req.body;

    const { workspace, isAdmin } = await getWorkspaceAccess(workspaceId, userId);
    if (!workspace) {
      return res.status(404).json({ status: "error", message: "Workspace not found." });
    }
    if (!isAdmin) {
      return res.status(403).json({ status: "error", message: "Only administrators can update this workspace." });
    }

    const updatePayload = {};
    if (typeof name === "string") {
      const cleanName = name.trim();
      if (!cleanName) {
        return res.status(400).json({
          status: "error",
          message: "Workspace name is required.",
        });
      }
      updatePayload.name = cleanName;
    }

    if (typeof description === "string") {
      updatePayload.description = description.trim() || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No workspace fields were provided.",
      });
    }

    const { data, error } = await supabase
      .from("workspaces")
      .update(updatePayload)
      .eq("id", workspaceId)
      .select()
      .single();

    if (error) throw error;

    if (typeof updatePayload.name === "string" && updatePayload.name !== workspace.name) {
      await notifyWorkspaceMembers({
        workspaceId,
        actionType: "WORKSPACE_RENAMED",
        oldData: { name: workspace.name },
        newData: {
          name: updatePayload.name,
          notificationType: "renamed",
          changedBy: userId,
        },
        request: req,
        details: `Workspace "${workspace.name}" was renamed to "${updatePayload.name}".`,
      });
    }

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    console.error("Lỗi updateWorkspace:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { workspace, isAdmin } = await getWorkspaceAccess(workspaceId, userId);
    if (!workspace) {
      return res.status(404).json({ status: "error", message: "Workspace not found." });
    }
    if (!isAdmin) {
      return res.status(403).json({ status: "error", message: "Only administrators can delete this workspace." });
    }

    const { error } = await supabase
      .from("workspaces")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workspaceId);

    if (error) throw error;

    await notifyWorkspaceMembers({
      workspaceId,
      actionType: "WORKSPACE_DELETED",
      oldData: { name: workspace.name },
      newData: {
        name: workspace.name,
        notificationType: "deleted",
        changedBy: userId,
      },
      request: req,
      details: `Workspace "${workspace.name}" was deleted.`,
    });

    return res.status(200).json({ status: "success", message: "Xóa workspace thành công." });
  } catch (error) {
    console.error("Lỗi deleteWorkspace:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
