const supabase = require("../config/supabase");

/**
 * documentNotificationService.js
 * Dedicated service to handle document upload and deletion notification logs in activity_logs DB table
 */

/**
 * Helper to fetch library or workspace name if not provided
 */
async function resolveContainerName({ libraryId, workspaceId, libraryName, workspaceName }) {
  if (libraryName) return { type: "library", name: libraryName };
  if (workspaceName) return { type: "workspace", name: workspaceName };

  if (libraryId) {
    const { data } = await supabase.from("libraries").select("name").eq("id", libraryId).maybeSingle();
    if (data?.name) return { type: "library", name: data.name };
  }

  if (workspaceId) {
    const { data } = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
    if (data?.name) return { type: "workspace", name: data.name };
  }

  return { type: "library", name: "Library" };
}

/**
 * Record document upload notification
 */
async function notifyDocumentUploaded({ userId, documentId, documentTitle, libraryId = null, workspaceId = null, libraryName = null, workspaceName = null }) {
  if (!userId || !documentId) return;

  try {
    const container = await resolveContainerName({ libraryId, workspaceId, libraryName, workspaceName });
    const targetText = container.type === "workspace" ? `workspace "${container.name}"` : `library "${container.name}"`;

    const payload = {
      user_id: userId,
      action_type: "DOCUMENT_UPLOADED",
      entity_type: "DOCUMENT",
      entity_id: documentId,
      new_data: {
        notificationType: "documentUploaded",
        documentTitle: documentTitle || "Document",
        libraryId,
        workspaceId,
        containerName: container.name,
      },
      details: `File "${documentTitle || "Document"}" has been uploaded to ${targetText} successfully.`,
      risk_level: "INFO",
    };

    const { error } = await supabase.from("activity_logs").insert(payload);
    if (error) {
      console.error("Failed to record document upload notification DB insert error:", error);
    } else {
      console.log(`[Notification] Recorded document upload for doc: ${documentTitle} in ${targetText}`);
    }
  } catch (error) {
    console.error("Failed to record document upload notification exception:", error);
  }
}

/**
 * Record document deletion notification
 */
async function notifyDocumentDeleted({ userId, documentId, documentTitle, libraryId = null, workspaceId = null, libraryName = null, workspaceName = null }) {
  if (!userId || !documentId) return;

  try {
    const container = await resolveContainerName({ libraryId, workspaceId, libraryName, workspaceName });
    const targetText = container.type === "workspace" ? `workspace "${container.name}"` : `library "${container.name}"`;

    const payload = {
      user_id: userId,
      action_type: "DOCUMENT_DELETED",
      entity_type: "DOCUMENT",
      entity_id: documentId,
      new_data: {
        notificationType: "documentDeleted",
        documentTitle: documentTitle || "Document",
        libraryId,
        workspaceId,
        containerName: container.name,
      },
      details: `File "${documentTitle || "Document"}" has been deleted from ${targetText}.`,
      risk_level: "INFO",
    };

    const { error } = await supabase.from("activity_logs").insert(payload);
    if (error) {
      console.error("Failed to record document deletion notification DB insert error:", error);
    } else {
      console.log(`[Notification] Recorded document deletion for doc: ${documentTitle} from ${targetText}`);
    }
  } catch (error) {
    console.error("Failed to record document deletion notification exception:", error);
  }
}

module.exports = {
  notifyDocumentUploaded,
  notifyDocumentDeleted,
};
