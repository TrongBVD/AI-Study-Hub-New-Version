const supabase = require("../../config/supabase");
const {
  notifyWorkspaceMembers,
  formatRelativeTime,
  getWorkspaceRoleLabel,
} = require("./workspaceHelpers");

exports.notifyWorkspaceMembers = notifyWorkspaceMembers;

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const readTimestamp = new Date().toISOString();

    try {
      await supabase
        .from("profiles")
        .update({ notifications_read_at: readTimestamp })
        .eq("id", userId);
    } catch (profileErr) {
      console.warn("Could not update notifications_read_at on profile:", profileErr);
    }

    const { data: logs } = await supabase
      .from("activity_logs")
      .select("id, new_data")
      .eq("user_id", userId);

    if (logs && logs.length > 0) {
      for (const logItem of logs) {
        if (!logItem.new_data?.is_read) {
          await supabase
            .from("activity_logs")
            .update({
              new_data: {
                ...(logItem.new_data || {}),
                is_read: true,
              },
            })
            .eq("id", logItem.id);
        }
      }
    }

    return res.status(200).json({
      status: "success",
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("markAllNotificationsAsRead error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not mark notifications as read.",
      error: error.message,
    });
  }
};

exports.listMyWorkspaceNotifications = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("notifications_read_at")
      .eq("id", req.user.id)
      .maybeSingle();

    const lastReadAtMs = profile?.notifications_read_at
      ? new Date(profile.notifications_read_at).getTime()
      : 0;

    const { data, error } = await supabase
      .from("activity_logs")
      .select("id, entity_id, action_type, old_data, new_data, details, created_at")
      .eq("user_id", req.user.id)
      .in("action_type", [
        "WORKSPACE_ROLE_CHANGED",
        "WORKSPACE_RENAMED",
        "WORKSPACE_DELETED",
        "DOCUMENT_APPROVED",
        "DOCUMENT_REJECTED",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_DELETED",
        "WORKSPACE_INVITATION_PENDING",
        "WORKSPACE_MEMBER_LEFT",
      ])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const invitationWorkspaceIds = Array.from(
      new Set(
        (data || [])
          .filter(
            (item) =>
              (item.new_data?.notificationType || "roleChanged") ===
              "workspaceInvitation"
          )
          .map((item) => item.entity_id)
          .filter(Boolean)
      )
    );

    const memberCountMap = {};
    if (invitationWorkspaceIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", invitationWorkspaceIds);

      if (memberRows) {
        for (const row of memberRows) {
          const wsId = row.workspace_id;
          memberCountMap[wsId] = (memberCountMap[wsId] || 0) + 1;
        }
      }
    }

    return res.status(200).json({
      status: "success",
      data: (data || []).map((item) => {
        const createdAtMs = new Date(item.created_at).getTime();
        const isRead = Boolean(
          item.new_data?.is_read || (lastReadAtMs > 0 && createdAtMs <= lastReadAtMs)
        );
        const actionType = item.new_data?.notificationType || "roleChanged";
        if (actionType === "workspaceInvitation") {
          const invStatus = item.new_data?.status || item.old_data?.status || "PENDING";
          return {
            id: `invitation-${item.id}`,
            logId: item.id,
            category: "invitation",
            action: "workspaceInvitation",
            title: "Workspace invitation",
            message: item.details,
            workspaceId: item.entity_id,
            workspaceName: item.new_data?.workspaceName || "Workspace",
            workspaceDescription: item.new_data?.workspaceDescription || "No description provided.",
            inviterName: item.new_data?.inviterName || "Workspace Admin",
            role: item.new_data?.role || "Contributor",
            memberCount: memberCountMap[item.entity_id] || 1,
            status: invStatus,
            isInvitation: true,
            isRead,
            icon: "ti-email",
            link: `/dashboard/workspaces/${item.entity_id}`,
            createdAt: formatRelativeTime(item.created_at),
            createdAtMs,
          };
        }

        if (actionType === "memberLeft") {
          return {
            id: `member-left-${item.id}`,
            category: "member",
            action: "memberLeft",
            title: "Member left workspace",
            message: item.details,
            isRead,
            icon: "ti-user",
            link: `/dashboard/workspaces/${item.entity_id}`,
            createdAt: formatRelativeTime(item.created_at),
            createdAtMs,
          };
        }

        if (actionType === "documentUploaded" || item.action_type === "DOCUMENT_UPLOADED") {
          const documentTitle = item.new_data?.documentTitle || "Your document";
          const isWorkspaceUpload = Boolean(item.new_data?.workspaceId);
          const containerName = item.new_data?.containerName
            ? `${isWorkspaceUpload ? "workspace" : "library"} "${item.new_data.containerName}"`
            : isWorkspaceUpload ? "workspace" : "library";
          const libraryLink = isWorkspaceUpload
            ? `/dashboard/workspaces/${item.new_data.workspaceId}`
            : item.new_data?.libraryId
              ? `/dashboard/libraries/${item.new_data.libraryId}`
              : "/dashboard/libraries";
          return {
            id: `doc-uploaded-${item.id}`,
            category: "file",
            action: "uploaded",
            title: "Document uploaded",
            message: item.details || `File "${documentTitle}" has been uploaded to ${containerName} successfully.`,
            isRead,
            icon: "ti-file",
            link: libraryLink,
            createdAt: formatRelativeTime(item.created_at),
            createdAtMs,
          };
        }

        if (actionType === "documentDeleted" || item.action_type === "DOCUMENT_DELETED") {
          const documentTitle = item.new_data?.documentTitle || "Your document";
          const containerName = item.new_data?.containerName ? `library "${item.new_data.containerName}"` : "library";
          const libraryLink = item.new_data?.libraryId
            ? `/dashboard/libraries/${item.new_data.libraryId}`
            : "/dashboard/libraries";
          return {
            id: `doc-deleted-${item.id}`,
            category: "file",
            action: "deleted",
            title: "Document deleted",
            message: item.details || `File "${documentTitle}" has been deleted from ${containerName}.`,
            isRead,
            icon: "ti-trash",
            link: libraryLink,
            createdAt: formatRelativeTime(item.created_at),
            createdAtMs,
          };
        }

        const isDeleted = actionType === "deleted";
        return {
          id: `workspace-event-${item.id}`,
          category: actionType === "roleChanged"
              ? "member"
              : "workspace",
          action: actionType,
          title:
            actionType === "renamed"
              ? "Workspace renamed"
              : isDeleted
                ? "Workspace deleted"
                : "Workspace role changed",
          message: (
            item.details ||
            `Your workspace role changed from ${getWorkspaceRoleLabel(item.old_data?.role || "member")} to ${getWorkspaceRoleLabel(item.new_data?.role || "a new role")}.`
          ).replace(/\bViewer\b/gi, "Contributor"),
          isRead,
          icon: isDeleted
              ? "ti-trash"
              : actionType === "renamed"
                ? "ti-pencil"
                : "ti-user",
          link: isDeleted
              ? "/dashboard/workspaces"
              : `/dashboard/workspaces/${item.entity_id}`,
          createdAt: formatRelativeTime(item.created_at),
          createdAtMs,
        };
      }),
    });
  } catch (error) {
    console.error("listMyWorkspaceNotifications error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace notifications.",
    });
  }
};
