const supabase = require("../../config/supabase");
const { createMailTransporter } = require("../../utils/mailerService");
const { createActivityLog } = require("../../services/activityLogService");

const MEMBER_ROLES = ["Viewer"];
const ASSIGNABLE_MEMBER_ROLES = ["Viewer"];
const DOCUMENT_BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";
const WAITING_BUCKET =
  process.env.SUPABASE_DOCUMENT_WAITING_ADMIN_APPROVED ||
  "document_waiting_admin";

function normalizeUploadedFileName(fileName) {
  const value = String(fileName || "");
  if (!value || [...value].some((character) => character.charCodeAt(0) > 255)) {
    return value.normalize("NFC");
  }

  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD")
    ? value.normalize("NFC")
    : decoded.normalize("NFC");
}

async function moveWorkspaceDocumentToBucket(document, targetBucket) {
  if (!document?.file_url) {
    return { moved: false, sourceBucket: null, targetBucket };
  }

  const candidateBuckets =
    targetBucket === DOCUMENT_BUCKET
      ? [WAITING_BUCKET, DOCUMENT_BUCKET]
      : [DOCUMENT_BUCKET, WAITING_BUCKET];

  let sourceBucket = null;
  let fileBlob = null;
  let lastDownloadError = null;

  for (const bucket of candidateBuckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(document.file_url);
    if (!error && data) {
      sourceBucket = bucket;
      fileBlob = data;
      break;
    }
    lastDownloadError = error;
  }

  if (!sourceBucket || !fileBlob) {
    throw lastDownloadError || new Error("Workspace document file is missing.");
  }
  if (sourceBucket === targetBucket) {
    return { moved: false, sourceBucket, targetBucket };
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(targetBucket)
    .upload(document.file_url, buffer, {
      contentType: "application/octet-stream",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: removeError } = await supabase.storage
    .from(sourceBucket)
    .remove([document.file_url]);
  if (removeError) {
    await supabase.storage.from(targetBucket).remove([document.file_url]);
    throw removeError;
  }

  return { moved: true, sourceBucket, targetBucket };
}

function getWorkspaceRoleLabel(role) {
  return ["viewer", "editor"].includes(String(role || "").toLowerCase())
    ? "Contributor"
    : role;
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return "Just now";
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  file_url,
  file_size_bytes,
  is_public,
  status,
  ai_reject_reason,
  reviewed_by_admin_id,
  reviewed_at,
  admin_review_reason,
  replacement_document_ids,
  created_at,
  uploader:profiles!documents_uploader_id_fkey (
    id,
    email,
    username
  )
`;

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}

async function notifyWorkspaceMembers({
  workspaceId,
  actionType,
  oldData,
  newData,
  details,
  request,
}) {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  const results = await Promise.allSettled(
    (members || []).map((member) =>
      createActivityLog({
        actorUserId: member.user_id,
        actionType,
        entityType: "workspace",
        entityId: workspaceId,
        oldData,
        newData,
        request,
        details,
      }),
    ),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Workspace notification log failed:", result.reason);
    }
  });
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
  const uploader = Array.isArray(row.uploader)
    ? row.uploader[0] || {}
    : row.uploader || {};

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
    replacementDocumentIds: Array.isArray(row.replacement_document_ids)
      ? row.replacement_document_ids
      : [],
    createdAt: row.created_at,
    created_at: row.created_at,
    uploaderName:
      uploader.full_name || uploader.username || uploader.email || "Unknown user",
    uploaderEmail: uploader.email || "",
  };
}

module.exports = {
  MEMBER_ROLES,
  ASSIGNABLE_MEMBER_ROLES,
  DOCUMENT_BUCKET,
  WAITING_BUCKET,
  MESSAGE_SELECT,
  FLASHCARD_SELECT,
  WORKSPACE_DOCUMENT_SELECT,
  normalizeUploadedFileName,
  moveWorkspaceDocumentToBucket,
  getWorkspaceRoleLabel,
  formatRelativeTime,
  getFrontendUrl,
  notifyWorkspaceMembers,
  sendWorkspaceInviteEmail,
  getWorkspaceAccess,
  countWorkspaceAdmins,
  mapWorkspaceMessage,
  mapWorkspaceFlashcard,
  mapWorkspaceDocument,
};
