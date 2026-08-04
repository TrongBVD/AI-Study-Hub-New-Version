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

    if (workspaceId) {
      const [{ data: members, error: membersError }, { data: workspace, error: workspaceError }] =
        await Promise.all([
          supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", workspaceId),
          supabase
            .from("workspaces")
            .select("created_by")
            .eq("id", workspaceId)
            .maybeSingle(),
        ]);

      if (membersError) throw membersError;
      if (workspaceError) throw workspaceError;

      const recipientIds = new Set([
        userId,
        workspace?.created_by,
        ...(members || []).map((member) => member.user_id),
      ].filter(Boolean).map(String));

      const rows = [...recipientIds].map((recipientId) => {
        const isUploader = String(recipientId) === String(userId);
        return {
          user_id: recipientId,
          action_type: "DOCUMENT_UPLOADED",
          entity_type: "DOCUMENT",
          entity_id: documentId,
          new_data: {
            notificationType: "documentUploaded",
            documentTitle: documentTitle || "Document",
            workspaceId,
            containerName: container.name,
            isUploader,
          },
          details: isUploader
            ? `Your file "${documentTitle || "Document"}" was uploaded successfully to workspace "${container.name}".`
            : `File "${documentTitle || "Document"}" was uploaded successfully to workspace "${container.name}".`,
          risk_level: "INFO",
        };
      });

      const { error } = await supabase.from("activity_logs").insert(rows);
      if (error) throw error;

      console.log(
        `[Notification] Recorded workspace upload for ${rows.length} recipient(s): ${documentTitle}`,
      );
      return;
    }

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
 * Notify the uploader when hierarchical AI tagging could not be completed.
 */
async function notifyDocumentTaggingFailed({
  userId,
  documentId,
  documentTitle,
  libraryId = null,
  workspaceId = null,
  libraryName = null,
  workspaceName = null,
  errorMessage = "The AI tagging service is temporarily unavailable.",
}) {
  if (!userId || !documentId) return;

  try {
    const container = await resolveContainerName({
      libraryId,
      workspaceId,
      libraryName,
      workspaceName,
    });
    const link = workspaceId
      ? `/dashboard/workspaces/${workspaceId}`
      : libraryId
        ? `/dashboard/libraries/${libraryId}`
        : "/dashboard/libraries";
    const details = `AI tagging failed for "${documentTitle || "Document"}": ${errorMessage} Open the file card and retry.`;

    const { error } = await supabase.from("activity_logs").insert({
      user_id: userId,
      action_type: "DOCUMENT_TAGGING_FAILED",
      entity_type: "DOCUMENT",
      entity_id: documentId,
      new_data: {
        notificationType: "documentTaggingFailed",
        documentTitle: documentTitle || "Document",
        libraryId,
        workspaceId,
        containerName: container.name,
        taggingError: errorMessage,
        link,
      },
      details,
      risk_level: "MEDIUM",
    });

    if (error) throw error;
  } catch (error) {
    console.error("Failed to record document tagging failure notification:", error);
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
  notifyDocumentTaggingFailed,
  notifyDocumentDeleted,
};
