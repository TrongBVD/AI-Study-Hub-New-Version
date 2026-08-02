const supabase = require("../../config/supabase");
const { createMailTransporter } = require("../../utils/mailerService");
const { createActivityLog } = require("../../services/activityLogService");

const MEMBER_ROLES = ["Editor", "Viewer"];
const ASSIGNABLE_MEMBER_ROLES = ["Editor", "Viewer"];
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

function normalizeDiscussionTopicTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

async function findDuplicateDiscussionTopic(
  workspaceId,
  title,
  excludedTopicId = null,
) {
  let query = supabase
    .from("workspace_discussion_topics")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (excludedTopicId) query = query.neq("id", excludedTopicId);

  const { data, error } = await query;
  if (error) throw error;

  const normalizedTitle = normalizeDiscussionTopicTitle(title);
  return (data || []).find(
    (topic) => normalizeDiscussionTopicTitle(topic.title) === normalizedTitle,
  );
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
  return String(role || "").toLowerCase() === "viewer" ? "Contributor" : role;
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
  created_at,
  uploader:profiles!documents_uploader_id_fkey (
    id,
    email,
    username,
    full_name
  )
`;
const DISCUSSION_TOPIC_SELECT = `
  id,
  workspace_id,
  created_by,
  title,
  content,
  topic_type,
  status,
  priority,
  date_mode,
  start_date,
  end_date,
  is_pinned,
  created_at,
  updated_at,
  creator:profiles!workspace_discussion_topics_created_by_fkey (
    id,
    email,
    username,
    full_name,
    avatar_url
  ),
  comments:workspace_discussion_comments (
    id,
    topic_id,
    user_id,
    content,
    is_edited,
    created_at,
    updated_at,
    author:profiles!workspace_discussion_comments_user_id_fkey (
      id,
      email,
      username,
      full_name,
      avatar_url
    )
  ),
  subtasks:workspace_discussion_subtasks (
    id,
    topic_id,
    created_by,
    title,
    is_done,
    sort_order,
    created_at,
    updated_at,
    creator:profiles!workspace_discussion_subtasks_created_by_fkey (
      id,
      email,
      username,
      full_name,
      avatar_url
    )
  ),
  attachments:workspace_discussion_attachments (
    id,
    topic_id,
    uploaded_by,
    file_name,
    file_url,
    file_size_bytes,
    mime_type,
    created_at,
    uploader:profiles!workspace_discussion_attachments_uploaded_by_fkey (
      id,
      email,
      username,
      full_name,
      avatar_url
    )
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

async function getWorkspaceDiscussionAccess(workspaceId, userId) {
  const access = await getWorkspaceAccess(workspaceId, userId);
  if (!access.workspace || !access.member) {
    return {
      ...access,
      canReadDiscussion: false,
      canWriteDiscussion: false,
      canSubmitSolutions: false,
    };
  }

  const canWriteDiscussion =
    access.isAdmin || ["Admin", "Editor"].includes(access.member?.role);

  return {
    ...access,
    canReadDiscussion: true,
    canWriteDiscussion,
    canSubmitSolutions: true,
  };
}

async function getDiscussionTopicInWorkspace(workspaceId, topicId) {
  const { data, error } = await supabase
    .from("workspace_discussion_topics")
    .select("id, created_by")
    .eq("workspace_id", workspaceId)
    .eq("id", topicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
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

function mapDiscussionUser(user, fallback = "Workspace member") {
  return {
    id: user?.id || null,
    email: user?.email || "",
    username: user?.username || "",
    fullName: user?.full_name || "",
    avatarUrl: user?.avatar_url || "",
    name: user?.full_name || user?.username || user?.email || fallback,
  };
}

function mapDiscussionComment(row) {
  const solutionPrefix = "[[SOLUTION]]";
  const solutionReplyMatch = String(row.content || "").match(
    /^\[\[SOLUTION_REPLY:([^\]]+)\]\]/,
  );
  const isSolution = String(row.content || "").startsWith(solutionPrefix);
  const isSolutionReply = Boolean(solutionReplyMatch);
  const storedPrefix = solutionReplyMatch?.[0] || "";

  return {
    id: row.id,
    topicId: row.topic_id,
    userId: row.user_id,
    content: isSolution
      ? row.content.slice(solutionPrefix.length)
      : isSolutionReply
        ? row.content.slice(storedPrefix.length)
        : row.content,
    kind: isSolution ? "solution" : isSolutionReply ? "solutionReply" : "comment",
    solutionId: solutionReplyMatch?.[1] || null,
    isEdited: row.is_edited === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: mapDiscussionUser(row.author),
  };
}

function mapDiscussionSubtask(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    createdBy: row.created_by,
    title: row.title,
    isDone: row.is_done === true,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: mapDiscussionUser(row.creator),
  };
}

function mapDiscussionAttachment(row) {
  const storedMimeType = row.mime_type || "";
  const isSolution = storedMimeType.startsWith("solution:");
  const solutionMetadata = isSolution
    ? storedMimeType.slice("solution:".length)
    : "";
  const solutionSeparatorIndex = solutionMetadata.indexOf("|");
  const solutionId = solutionSeparatorIndex >= 0
    ? solutionMetadata.slice(0, solutionSeparatorIndex) || null
    : null;
  const cleanMimeType = solutionSeparatorIndex >= 0
    ? solutionMetadata.slice(solutionSeparatorIndex + 1)
    : solutionMetadata;

  return {
    id: row.id,
    topicId: row.topic_id,
    uploadedBy: row.uploaded_by,
    fileName: normalizeUploadedFileName(row.file_name),
    fileUrl: row.file_url,
    fileSizeBytes: row.file_size_bytes || 0,
    mimeType: isSolution ? cleanMimeType : storedMimeType,
    kind: isSolution ? "solution" : "attachment",
    solutionId,
    createdAt: row.created_at,
    uploader: mapDiscussionUser(row.uploader),
  };
}

function mapDiscussionTopic(row) {
  const creator = row.creator || {};
  const mappedComments = (row.comments || []).map(mapDiscussionComment);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    creator: creator.full_name || creator.username || creator.email || "Workspace member",
    creatorDetails: mapDiscussionUser(creator),
    title: row.title,
    content: row.content || "",
    type: row.topic_type,
    status: row.status,
    priority: row.priority,
    dateMode: row.date_mode,
    startDate: row.start_date,
    endDate: row.end_date,
    isPinned: row.is_pinned === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: mappedComments
      .filter((comment) => comment.kind === "comment"),
    solutions: mappedComments
      .filter((comment) => comment.kind === "solution")
      .map((solution) => ({
        ...solution,
        replies: mappedComments.filter(
          (comment) =>
            comment.kind === "solutionReply" &&
            String(comment.solutionId) === String(solution.id),
        ),
      })),
    subtasks: (row.subtasks || []).map(mapDiscussionSubtask),
    files: (row.attachments || []).map(mapDiscussionAttachment),
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
  DISCUSSION_TOPIC_SELECT,
  normalizeUploadedFileName,
  normalizeDiscussionTopicTitle,
  findDuplicateDiscussionTopic,
  moveWorkspaceDocumentToBucket,
  getWorkspaceRoleLabel,
  formatRelativeTime,
  getFrontendUrl,
  notifyWorkspaceMembers,
  sendWorkspaceInviteEmail,
  getWorkspaceAccess,
  countWorkspaceAdmins,
  getWorkspaceDiscussionAccess,
  getDiscussionTopicInWorkspace,
  mapWorkspaceMessage,
  mapWorkspaceFlashcard,
  mapWorkspaceDocument,
  mapDiscussionUser,
  mapDiscussionComment,
  mapDiscussionSubtask,
  mapDiscussionAttachment,
  mapDiscussionTopic,
};
