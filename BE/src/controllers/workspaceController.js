const supabase = require("../config/supabase");
const { createMailTransporter } = require("../utils/mailerService");

const MEMBER_ROLES = ["Editor", "Viewer"];
const ALL_MEMBER_ROLES = ["Admin", "Editor", "Viewer"];
const MESSAGE_SELECT = `
  id,
  workspace_id,
  sender_id,
  content,
  is_edited,
  created_at,
  sender:profiles!workspace_messages_sender_id_fkey (
    id,
    email,
    username,
    full_name,
    avatar_url
  )
`;
const FLASHCARD_SELECT = `
  id,
  document_id,
  workspace_id,
  creator_id,
  question,
  answer,
  created_at,
  document:documents!flashcards_document_id_fkey (
    id,
    title,
    status
  )
`;
const WORKSPACE_DOCUMENT_SELECT = `
  id,
  uploader_id,
  workspace_id,
  library_id,
  title,
  file_size_bytes,
  is_public,
  status,
  ai_reject_reason,
  reviewed_by_admin_id,
  reviewed_at,
  admin_review_reason,
  created_at,
  uploader:profiles!documents_uploader_id_fkey (
    id,
    email,
    username,
    full_name
  )
`;

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWorkspaceInviteEmail({ to, workspace, inviter, role, inviteUrl }) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email service is not configured.");
  }

  const workspaceUrl = inviteUrl || `${getFrontendUrl()}/dashboard/workspaces/${workspace.id}`;
  const inviterName =
    inviter?.full_name || inviter?.username || inviter?.email || "A workspace admin";
  const workspaceName = workspace?.name || "AI StudyHub workspace";
  const safeInviterName = escapeHtml(inviterName);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeRole = escapeHtml(role);
  const safeWorkspaceUrl = escapeHtml(workspaceUrl);

  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `AI StudyHub - Workspace invitation: ${workspaceName}`,
    text: [
      `Hi,`,
      ``,
      `${inviterName} invited you to join the workspace "${workspaceName}" on AI StudyHub as ${role}.`,
      `Open workspace: ${workspaceUrl}`,
      ``,
      `If you were not expecting this invitation, you can ignore this email.`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.55;">
        <h2 style="margin: 0 0 12px;">You have been invited to a workspace</h2>
        <p><strong>${safeInviterName}</strong> invited you to join <strong>${safeWorkspaceName}</strong> on AI StudyHub as <strong>${safeRole}</strong>.</p>
        <p>
          <a href="${safeWorkspaceUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none;">
            Open workspace
          </a>
        </p>
        <p style="color: #64748b; font-size: 13px;">If you were not expecting this invitation, you can ignore this email.</p>
      </div>
    `,
  });
}

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

async function countWorkspaceAdmins(workspaceId) {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "Admin");

  if (error) throw error;

  return count || 0;
}

function mapWorkspaceMessage(row) {
  const sender = row.sender || {};
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    senderId: row.sender_id,
    senderName:
      sender.full_name || sender.username || sender.email || "Workspace member",
    senderEmail: sender.email || "",
    senderAvatar: sender.avatar_url || "",
    text: row.content,
    isEdited: row.is_edited === true,
    createdAt: row.created_at,
  };
}

function mapWorkspaceFlashcard(row) {
  return {
    id: row.id,
    documentId: row.document_id,
    workspaceId: row.workspace_id,
    creatorId: row.creator_id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
    documentTitle: row.document?.title || "Workspace flashcards",
    documentStatus: row.document?.status || "",
  };
}

function mapWorkspaceDocument(row) {
  const uploader = row.uploader || {};

  return {
    id: row.id,
    uploaderId: row.uploader_id,
    workspaceId: row.workspace_id,
    libraryId: row.library_id,
    title: row.title,
    fileSizeBytes: row.file_size_bytes,
    file_size_bytes: row.file_size_bytes,
    isPublic: row.is_public === true,
    status: row.status,
    aiRejectReason: row.ai_reject_reason,
    reviewedByAdminId: row.reviewed_by_admin_id,
    reviewedAt: row.reviewed_at,
    adminReviewReason: row.admin_review_reason,
    createdAt: row.created_at,
    created_at: row.created_at,
    uploaderName:
      uploader.full_name || uploader.username || uploader.email || "Unknown user",
    uploaderEmail: uploader.email || "",
  };
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

exports.listMessages = async (req, res) => {
  try {
    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );

    if (!workspace || (!member && !isAdmin)) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace.",
      });
    }

    const { data, error } = await supabase
      .from("workspace_messages")
      .select(MESSAGE_SELECT)
      .eq("workspace_id", req.params.workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map(mapWorkspaceMessage),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace messages.",
      error: error.message,
    });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      req.params.workspaceId,
      req.user.id,
    );

    if (!workspace || (!member && !isAdmin)) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace.",
      });
    }

    const content = String(req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "Message content is required.",
      });
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("workspace_messages")
      .insert({
        workspace_id: req.params.workspaceId,
        sender_id: req.user.id,
        content,
      })
      .select(MESSAGE_SELECT)
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      status: "success",
      data: mapWorkspaceMessage(insertedMessage),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Could not send workspace message.",
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
      .select("id, username, full_name, email, status")
      .select("id, username, full_name, email, status")
      .neq("status", "DISABLED")
      .or(
        `username.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`,
      )
      .limit(20);

    if (userError) throw userError;

    return res.status(200).json({
      status: "success",
      data: (users || []).map((user) => ({
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
      .select("id, email, username, full_name, status")
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

    const { data: inviter, error: inviterError } = await supabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("id", req.user.id)
      .maybeSingle();

    if (inviterError) throw inviterError;

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

    let emailSent = false;
    let emailError = null;

    try {
      await sendWorkspaceInviteEmail({
        to: invitedUser.email,
        workspace: access.workspace,
        inviter,
        role,
      });
      emailSent = true;
    } catch (mailError) {
      emailError = mailError.message;
      console.error("Could not send workspace invite email:", mailError);
    }

    return res.status(201).json({
      status: "success",
      data: {
        ...data,
        invitedUser: {
          id: invitedUser.id,
          email: invitedUser.email,
          username: invitedUser.username,
          full_name: invitedUser.full_name,
        },
        emailSent,
        emailError,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({
          status: "error",
          message: "This user is already a member of the workspace.",
        });
    }

    return res
      .status(500)
      .json({
        status: "error",
        message: "Could not add member.",
        error: error.message,
      });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;

    if (!ALL_MEMBER_ROLES.includes(role)) {
      return res.status(400).json({
        status: "error",
        message: "Role must be Admin, Editor or Viewer.",
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

exports.listFlashcards = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      workspaceId,
      userId,
    );

    if (!workspace) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    if (!member && !isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this workspace.",
      });
    }

    const { data, error } = await supabase
      .from("flashcards")
      .select(FLASHCARD_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map(mapWorkspaceFlashcard),
    });
  } catch (error) {
    console.error("listFlashcards error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace flashcards.",
    });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const { workspace, member, isAdmin } = await getWorkspaceAccess(
      workspaceId,
      userId,
    );

    if (!workspace || (!member && !isAdmin)) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace.",
      });
    }

    const { data, error } = await supabase
      .from("documents")
      .select(WORKSPACE_DOCUMENT_SELECT)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map(mapWorkspaceDocument),
    });
  } catch (error) {
    console.error("listWorkspaceDocuments error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load workspace documents.",
      error: error.message,
    });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const { workspaceId, documentId } = req.params;
    const { decision, reason } = req.body;
    const userId = req.user.id;

    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({
        status: "error",
        message: "decision must be APPROVE or REJECT.",
      });
    }

    const { workspace, isAdmin } = await getWorkspaceAccess(workspaceId, userId);

    if (!workspace) {
      return res
        .status(404)
        .json({ status: "error", message: "Workspace not found." });
    }

    if (!isAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace admins can review workspace documents.",
      });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) throw documentError;

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Workspace document not found.",
      });
    }

    const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

    const { data: updatedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        status: newStatus,
        reviewed_by_admin_id: userId,
        reviewed_at: new Date().toISOString(),
        admin_review_reason:
          String(reason || "").trim() ||
          `${newStatus.toLowerCase()} by workspace admin.`,
      })
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .select(WORKSPACE_DOCUMENT_SELECT)
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      status: "success",
      data: mapWorkspaceDocument(updatedDocument),
    });
  } catch (error) {
    console.error("reviewWorkspaceDocument error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not review workspace document.",
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

    return res.status(200).json({ status: "success", message: "Xóa workspace thành công." });
  } catch (error) {
    console.error("Lỗi deleteWorkspace:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

