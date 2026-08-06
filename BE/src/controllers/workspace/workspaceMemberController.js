const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const {
  MEMBER_ROLES,
  ASSIGNABLE_MEMBER_ROLES,
  getWorkspaceAccess,
  countWorkspaceAdmins,
  getWorkspaceRoleLabel,
} = require("./workspaceHelpers");

function isSystemAdmin(user) {
  const role = String(user?.role || "")
    .trim()
    .toUpperCase();

  return role === "ADMIN" || role === "SYSTEM_ADMIN";
}

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
      .replace(/^@+/, "")
      .replace(/[,%]/g, "")
      .trim();

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
      .select("id, username, full_name, email, status, role")
      .neq("status", "DISABLED")
      .or(
        `username.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`,
      )
      .limit(20);

    if (userError) throw userError;

    return res.status(200).json({
      status: "success",
      data: (users || [])
        .filter((user) => !isSystemAdmin(user))
        .map((user) => ({
          ...user,
          isWorkspaceMember: existingIds.has(String(user.id)),
        })),
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

    const { data: invitedUser, error: invitedUserError } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, status, role")
      .eq("id", userId)
      .maybeSingle();

    if (invitedUserError) throw invitedUserError;

    if (!invitedUser || invitedUser.status === "DISABLED") {
      return res
        .status(404)
        .json({
          status: "error",
          message: "The invited user was not found or is disabled.",
        });
    }

    if (isSystemAdmin(invitedUser)) {
      return res.status(403).json({
        status: "error",
        message: "System administrators cannot be added to workspaces.",
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

    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", req.params.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember) {
      return res.status(409).json({
        status: "error",
        message: "This user is already a member of the workspace.",
      });
    }

    const { data: inviter } = await supabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("id", req.user.id)
      .maybeSingle();

    const inviterName = inviter?.full_name || inviter?.username || inviter?.email || "Workspace Admin";
    const workspaceName = access.workspace.name || "Workspace";
    const workspaceDescription = access.workspace.description || "";

    const { data: logData, error: logError } = await supabase
      .from("activity_logs")
      .insert({
        user_id: userId,
        admin_id: req.user.id,
        action_type: "WORKSPACE_INVITATION_PENDING",
        entity_type: "workspace",
        entity_id: req.params.workspaceId,
        old_data: { status: "PENDING", role },
        new_data: {
          workspaceId: req.params.workspaceId,
          workspaceName,
          workspaceDescription,
          inviterId: req.user.id,
          inviterName,
          role,
          status: "PENDING",
          notificationType: "workspaceInvitation",
        },
        details: `${inviterName} invited you to join workspace "${workspaceName}" as ${role === "Viewer" ? "Contributor" : role}.`,
      })
      .select("id, created_at")
      .single();

    if (logError) throw logError;

    return res.status(201).json({
      status: "success",
      message: "Thư mời tham gia nhóm đã được gửi tới người dùng.",
      data: {
        invitationId: logData.id,
        workspaceId: req.params.workspaceId,
        invitedUser: {
          id: invitedUser.id,
          email: invitedUser.email,
          username: invitedUser.username,
          full_name: invitedUser.full_name,
        },
        role,
        status: "PENDING",
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Could not send workspace invitation.",
      error: error.message,
    });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;

    if (!ASSIGNABLE_MEMBER_ROLES.includes(role)) {
      return res.status(400).json({
        status: "error",
        message: "Role must be Contributor.",
      });
    }

    const access = await getWorkspaceAccess(workspaceId, req.user.id);
    if (!access.workspace || !access.isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace admins can update member roles.",
      });
    }

    const { data: currentMember, error: currentMemberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (currentMemberError) throw currentMemberError;

    if (!currentMember) {
      return res.status(404).json({
        status: "error",
        message: "Workspace member not found.",
      });
    }

    if (
      currentMember.role === "Admin" &&
      role !== "Admin" &&
      (await countWorkspaceAdmins(workspaceId)) <= 1
    ) {
      return res.status(400).json({
        status: "error",
        message: "A workspace must have at least one admin.",
      });
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
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
      .single();

    if (error) throw error;

    if (currentMember.role !== role) {
      await createActivityLog({
        actorUserId: userId,
        actionType: "WORKSPACE_ROLE_CHANGED",
        entityType: "workspace",
        entityId: workspaceId,
        oldData: { role: currentMember.role },
        newData: {
          role,
          workspaceName: access.workspace.name,
          changedBy: req.user.id,
        },
        request: req,
        details: `Your role in ${access.workspace.name || "a workspace"} changed from ${getWorkspaceRoleLabel(currentMember.role)} to ${getWorkspaceRoleLabel(role)}.`,
      });
    }

    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("updateMemberRole error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update member role.",
      error: error.message,
    });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    const access = await getWorkspaceAccess(workspaceId, req.user.id);
    if (!access.workspace || !access.isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace admins can remove members.",
      });
    }

    if (String(access.workspace.created_by) === String(userId)) {
      return res.status(400).json({
        status: "error",
        message: "The workspace creator cannot be removed.",
      });
    }

    const { data: currentMember, error: currentMemberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (currentMemberError) throw currentMemberError;

    if (!currentMember) {
      return res.status(404).json({
        status: "error",
        message: "Workspace member not found.",
      });
    }

    if (
      currentMember.role === "Admin" &&
      (await countWorkspaceAdmins(workspaceId)) <= 1
    ) {
      return res.status(400).json({
        status: "error",
        message: "A workspace must have at least one admin.",
      });
    }

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      message: "Member removed from workspace.",
    });
  } catch (error) {
    console.error("removeMember error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not remove member.",
      error: error.message,
    });
  }
};

exports.respondToInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid action. Must be 'accept' or 'reject'.",
      });
    }

    const { data: inviteLog, error: logError } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("id", invitationId)
      .eq("user_id", userId)
      .eq("action_type", "WORKSPACE_INVITATION_PENDING")
      .maybeSingle();

    if (logError) throw logError;

    if (!inviteLog) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy thư mời hoặc bạn không có quyền phản hồi thư mời này.",
      });
    }

    const currentStatus = inviteLog.new_data?.status || "PENDING";
    if (currentStatus !== "PENDING") {
      return res.status(400).json({
        status: "error",
        message: `Thư mời này đã được ${currentStatus === "ACCEPTED" ? "chấp nhận" : "từ chối"} trước đó.`,
      });
    }

    const workspaceId = inviteLog.entity_id;
    const role = inviteLog.new_data?.role || "Viewer";
    const workspaceName = inviteLog.new_data?.workspaceName || "Workspace";

    const { data: targetWs } = await supabase
      .from("workspaces")
      .select("id, deleted_at")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!targetWs || targetWs.deleted_at) {
      return res.status(400).json({
        status: "error",
        message: "This workspace has been deleted and is no longer available.",
      });
    }

    if (action === "accept") {
      const { error: insertError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role,
        });

      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }

      await supabase
        .from("activity_logs")
        .update({
          new_data: {
            ...inviteLog.new_data,
            status: "ACCEPTED",
          },
        })
        .eq("id", invitationId);

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .maybeSingle();

      const userDisplayName = userProfile?.full_name || userProfile?.username || "A new member";

      await supabase.from("activity_logs").insert({
        user_id: userId,
        admin_id: userId,
        action_type: "WORKSPACE_MEMBER_JOINED",
        entity_type: "workspace",
        entity_id: workspaceId,
        new_data: {
          notificationType: "joined",
          role,
          workspaceName,
        },
        details: `You have successfully joined workspace "${workspaceName}" as ${getWorkspaceRoleLabel(role)}.`,
      });

      const { data: adminsAndEditors } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", ["Admin", "Editor"])
        .neq("user_id", userId);

      if (adminsAndEditors && adminsAndEditors.length > 0) {
        const notifyRows = adminsAndEditors.map((m) => ({
          user_id: m.user_id,
          admin_id: userId,
          action_type: "WORKSPACE_MEMBER_JOINED",
          entity_type: "workspace",
          entity_id: workspaceId,
          new_data: {
            notificationType: "joined",
            role,
            workspaceName,
          },
          details: `${userDisplayName} accepted the invitation and joined workspace "${workspaceName}" as ${getWorkspaceRoleLabel(role)}.`,
        }));

        await supabase.from("activity_logs").insert(notifyRows);
      }

      return res.status(200).json({
        status: "success",
        message: `Successfully joined workspace "${workspaceName}"!`,
        action: "ACCEPTED",
      });
    } else {
      await supabase
        .from("activity_logs")
        .update({
          new_data: {
            ...inviteLog.new_data,
            status: "REJECTED",
          },
        })
        .eq("id", invitationId);

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .maybeSingle();

      const userDisplayName = userProfile?.full_name || userProfile?.username || "A user";

      const { data: adminsAndEditors } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", ["Admin", "Editor"])
        .neq("user_id", userId);

      const inviterId = inviteLog.new_data?.inviterId || inviteLog.admin_id;
      const targetAdminUserIds = new Set([
        ...(adminsAndEditors || []).map((m) => m.user_id),
        inviterId,
      ].filter((id) => id && id !== userId));

      if (targetAdminUserIds.size > 0) {
        const notifyRows = Array.from(targetAdminUserIds).map((targetId) => ({
          user_id: targetId,
          admin_id: userId,
          action_type: "WORKSPACE_ROLE_CHANGED",
          entity_type: "workspace",
          entity_id: workspaceId,
          new_data: {
            notificationType: "roleChanged",
            status: "REJECTED",
            workspaceName,
          },
          details: `${userDisplayName} declined the invitation to join workspace "${workspaceName}".`,
        }));

        await supabase.from("activity_logs").insert(notifyRows);
      }

      return res.status(200).json({
        status: "success",
        message: `Declined invitation to join workspace "${workspaceName}".`,
        action: "REJECTED",
      });
    }
  } catch (error) {
    console.error("respondToInvitation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not process invitation response.",
      error: error.message,
    });
  }
};

exports.leaveWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    if (userId === "guest" || userId === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot leave workspaces.",
      });
    }

    const access = await getWorkspaceAccess(workspaceId, userId);
    if (!access.workspace || !access.member) {
      return res.status(404).json({
        status: "error",
        message: "You are not a member of this workspace.",
      });
    }

    if (access.member.role === "Admin") {
      return res.status(400).json({
        status: "error",
        message: "You must transfer Admin ownership to another member before leaving this workspace.",
      });
    }

    const { error: deleteError } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();

    const userDisplayName = userProfile?.full_name || userProfile?.username || "A member";
    const workspaceName = access.workspace.name || "Workspace";

    const { data: adminsAndEditors } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["Admin", "Editor"])
      .neq("user_id", userId);

    if (adminsAndEditors && adminsAndEditors.length > 0) {
      const notifyRows = adminsAndEditors.map((m) => ({
        user_id: m.user_id,
        admin_id: userId,
        action_type: "WORKSPACE_MEMBER_LEFT",
        entity_type: "workspace",
        entity_id: workspaceId,
        new_data: {
          notificationType: "memberLeft",
          leftUserId: userId,
          workspaceName,
        },
        details: `${userDisplayName} has left workspace "${workspaceName}".`,
      }));

      await supabase.from("activity_logs").insert(notifyRows);
    }

    try {
      await supabase.from("workspace_messages").insert({
        workspace_id: workspaceId,
        sender_id: userId,
        content: `${userDisplayName} left the workspace.`,
      });
    } catch (msgErr) {
      console.warn("Could not insert left workspace message:", msgErr);
    }

    return res.status(200).json({
      status: "success",
      message: `Successfully left workspace "${workspaceName}".`,
    });
  } catch (error) {
    console.error("leaveWorkspace error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not leave workspace.",
      error: error.message,
    });
  }
};

exports.transferAdminOwnership = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { targetUserId } = req.body;
    const currentUserRole = "Viewer";
    const currentUserRolePhrase = "a Contributor";
    const currentUserId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "targetUserId is required.",
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "You are already an Admin of this workspace.",
      });
    }

    const access = await getWorkspaceAccess(workspaceId, currentUserId);
    if (!access.workspace || !access.isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace Admins can transfer ownership.",
      });
    }

    const { data: targetMember, error: targetError } = await supabase
      .from("workspace_members")
      .select("role, user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!targetMember) {
      return res.status(404).json({
        status: "error",
        message: "Target user is not a member of this workspace.",
      });
    }

    const { error: rpcError } = await supabase.rpc(
      "transfer_workspace_ownership",
      {
        p_workspace_id: workspaceId,
        p_current_owner_id: currentUserId,
        p_target_user_id: targetUserId,
      },
    );

    if (rpcError) {
      const isMissingRpc =
        rpcError.code === "PGRST202" ||
        String(rpcError.message).includes("does not exist") ||
        String(rpcError.message).includes("function");

      if (isMissingRpc) {
        const { data: wsData, error: wsError } = await supabase
          .from("workspaces")
          .select("created_by")
          .eq("id", workspaceId)
          .is("deleted_at", null)
          .maybeSingle();

        if (wsError || !wsData) {
          return res.status(404).json({
            status: "error",
            message: "Workspace not found.",
          });
        }

        if (String(wsData.created_by) !== String(currentUserId)) {
          return res.status(403).json({
            status: "error",
            message: "Only the current workspace owner can transfer ownership.",
          });
        }

        const { error: updateTargetError } = await supabase
          .from("workspace_members")
          .update({ role: "Admin" })
          .eq("workspace_id", workspaceId)
          .eq("user_id", targetUserId);

        if (updateTargetError) throw updateTargetError;

        const { error: updateOwnerError } = await supabase
          .from("workspace_members")
          .update({ role: currentUserRole })
          .eq("workspace_id", workspaceId)
          .eq("user_id", currentUserId);

        if (updateOwnerError) throw updateOwnerError;

        const { error: updateWsOwnerError } = await supabase
          .from("workspaces")
          .update({ created_by: targetUserId })
          .eq("id", workspaceId);

        if (updateWsOwnerError) throw updateWsOwnerError;
      } else {
        throw rpcError;
      }
    }

    return res.status(200).json({
      status: "success",
      message: `Ownership successfully transferred. You are now ${currentUserRolePhrase}.`,
    });
  } catch (error) {
    console.error("transferAdminOwnership error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not transfer Admin ownership.",
      error: error.message,
    });
  }
};
