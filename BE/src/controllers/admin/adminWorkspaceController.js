const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const { MAX_OWNED_WORKSPACES, countActiveOwnedWorkspaces } = require("../../services/workspaceLimitService");
const { notifyWorkspaceMembers } = require("../workspaceController");
const {
  getWorkspaceForPurge,
  getWorkspaceDocuments,
  countRows,
  removeWorkspaceStorageFiles,
} = require("./adminHelpers");

exports.getDeletedWorkspaces = async (req, res) => {
  try {
    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, name, description, created_by, created_at, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw error;

    const rows = await Promise.all((workspaces || []).map(async (workspace) => {
      const documents = await getWorkspaceDocuments(workspace.id);
      const reclaimable = documents.filter((document) => !document.library_id);
      return {
        ...workspace,
        documentCount: documents.length,
        preservedDocumentCount: documents.length - reclaimable.length,
        reclaimableBytes: reclaimable.reduce((total, document) => total + Number(document.file_size_bytes || 0), 0),
      };
    }));

    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    console.error("Admin deleted workspaces error:", error);
    return res.status(500).json({ status: "error", message: "Could not load deleted workspaces.", error: error.message });
  }
};

exports.restoreWorkspace = async (req, res) => {
  try {
    const workspace = await getWorkspaceForPurge(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ status: "error", code: "WORKSPACE_NOT_FOUND", message: "Workspace does not exist. It may already have been permanently deleted." });
    if (!workspace.deleted_at) return res.status(409).json({ status: "error", code: "WORKSPACE_NOT_SOFT_DELETED", message: "Only soft-deleted workspaces can be restored." });
    const activeOwned = await countActiveOwnedWorkspaces(workspace.created_by);
    if (activeOwned >= MAX_OWNED_WORKSPACES) return res.status(409).json({ status: "error", code: "WORKSPACE_LIMIT_REACHED", message: "The workspace owner already has the maximum number of active workspaces." });
    const { data: restored, error } = await supabase.from("workspaces").update({ deleted_at: null }).eq("id", workspace.id).select("id, name, description, created_by, created_at, deleted_at").single();
    if (error) throw error;
    await createActivityLog({ actorUserId: req.user.id, adminId: req.user.id, actionType: "ADMIN_RESTORE_WORKSPACE", entityType: "workspaces", entityId: workspace.id, oldData: workspace, newData: restored, request: req, riskLevel: "INFO", details: `System Admin restored workspace "${workspace.name}".` });
    await notifyWorkspaceMembers({ workspaceId: workspace.id, actionType: "WORKSPACE_RESTORED", oldData: workspace, newData: { name: workspace.name, notificationType: "restored", restoredBy: req.user.id }, request: req, details: `Workspace "${workspace.name}" has been restored by the System Administrator.` });
    return res.status(200).json({ status: "success", message: "Workspace restored successfully.", data: restored });
  } catch (error) {
    console.error("Admin restore workspace error:", error);
    return res.status(500).json({ status: "error", message: "Could not restore workspace." });
  }
};

exports.getWorkspacePurgePreview = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await getWorkspaceForPurge(workspaceId);
    if (!workspace) {
      return res.status(404).json({ status: "error", code: "WORKSPACE_NOT_FOUND", message: "Workspace does not exist. It may already have been permanently deleted." });
    }
    if (!workspace.deleted_at) {
      return res.status(409).json({ status: "error", code: "WORKSPACE_NOT_SOFT_DELETED", message: "Active workspaces cannot be permanently deleted. Soft-delete the workspace first." });
    }

    const documents = await getWorkspaceDocuments(workspaceId);
    const deletedDocuments = documents.filter((document) => !document.library_id);
    const preservedDocuments = documents.filter((document) => document.library_id);
    const deletedDocumentIds = deletedDocuments.map((document) => document.id);
    const documentFilter = (query) => deletedDocumentIds.length ? query.in("document_id", deletedDocumentIds) : query.eq("document_id", "00000000-0000-0000-0000-000000000000");
    const workspaceFilter = (query) => query.eq("workspace_id", workspaceId);
    const topicIdsResult = await supabase.from("workspace_discussion_topics").select("id").eq("workspace_id", workspaceId);
    if (topicIdsResult.error && !["42P01", "PGRST205"].includes(topicIdsResult.error.code)) throw topicIdsResult.error;
    const topicIds = (topicIdsResult.data || []).map((topic) => topic.id);
    const topicFilter = (query) => topicIds.length ? query.in("topic_id", topicIds) : query.eq("topic_id", "00000000-0000-0000-0000-000000000000");

    const [members, messages, aiSummaries, documentChunks, discussionComments, discussionSubtasks, discussionAttachments] = await Promise.all([
      countRows("workspace_members", workspaceFilter), countRows("workspace_messages", workspaceFilter),
      countRows("ai_summaries", documentFilter), countRows("document_chunks", documentFilter),
      countRows("workspace_discussion_comments", topicFilter), countRows("workspace_discussion_subtasks", topicFilter), countRows("workspace_discussion_attachments", topicFilter),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        workspace,
        deletion: { members, messages, documents: deletedDocuments.length, aiSummaries, documentChunks, discussionTopics: topicIds.length, discussionComments, discussionSubtasks, discussionAttachments, reclaimableBytes: deletedDocuments.reduce((total, document) => total + Number(document.file_size_bytes || 0), 0) },
        preservation: { documents: preservedDocuments.length, documentList: preservedDocuments.map(({ id, title, library_id: libraryId, file_size_bytes: fileSizeBytes }) => ({ id, title, libraryId, fileSizeBytes })) },
      },
    });
  } catch (error) {
    console.error("Admin workspace purge preview error:", error);
    return res.status(500).json({ status: "error", message: "Could not load workspace purge preview.", error: error.message });
  }
};

exports.permanentlyDeleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await getWorkspaceForPurge(workspaceId);
    if (!workspace) return res.status(404).json({ status: "error", code: "WORKSPACE_NOT_FOUND", message: "Workspace does not exist. It may already have been permanently deleted." });
    if (!workspace.deleted_at) return res.status(409).json({ status: "error", code: "WORKSPACE_NOT_SOFT_DELETED", message: "Active workspaces cannot be permanently deleted. Soft-delete the workspace first." });
    if (String(req.body.confirmation || "") !== workspace.name) return res.status(400).json({ status: "error", code: "INVALID_DELETE_CONFIRMATION", message: "Type the workspace name exactly to confirm permanent deletion." });

    const documents = await getWorkspaceDocuments(workspaceId);
    const workspaceOnlyDocuments = documents.filter((document) => !document.library_id);
    const bytesFreed = workspaceOnlyDocuments.reduce((total, document) => total + Number(document.file_size_bytes || 0), 0);

    await removeWorkspaceStorageFiles(workspaceOnlyDocuments);

    const { data, error } = await supabase.rpc("admin_hard_delete_workspace", { p_workspace_id: workspaceId });
    if (error) {
      if (String(error.message).includes("WORKSPACE_NOT_FOUND")) return res.status(404).json({ status: "error", code: "WORKSPACE_NOT_FOUND", message: "Workspace does not exist. It may already have been permanently deleted." });
      if (String(error.message).includes("WORKSPACE_NOT_SOFT_DELETED")) return res.status(409).json({ status: "error", code: "WORKSPACE_NOT_SOFT_DELETED", message: "Active workspaces cannot be permanently deleted. Soft-delete the workspace first." });
      throw error;
    }

    await createActivityLog({ actorUserId: req.user.id, adminId: req.user.id, actionType: "ADMIN_PERMANENTLY_DELETE_WORKSPACE", entityType: "workspaces", entityId: workspaceId, oldData: workspace, newData: { ...data, bytesFreed }, request: req, riskLevel: "HIGH", details: `System Admin permanently deleted soft-deleted workspace "${workspace.name}".` });
    return res.status(200).json({ status: "success", message: "Workspace permanently deleted.", data: { ...data, bytesFreed } });
  } catch (error) {
    console.error("Admin permanent workspace deletion error:", error);
    return res.status(500).json({ status: "error", message: "Could not permanently delete workspace. Storage cleanup must succeed before the database is purged.", error: error.message });
  }
};
