const supabase = require("../../config/supabase");
const {
  FLASHCARD_SELECT,
  WORKSPACE_DOCUMENT_SELECT,
  DOCUMENT_BUCKET,
  WAITING_BUCKET,
  getWorkspaceAccess,
  mapWorkspaceFlashcard,
  mapWorkspaceDocument,
  moveWorkspaceDocumentToBucket,
} = require("./workspaceHelpers");

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

    const { data: topicRows, error: topicRowsError } = await supabase
      .from("workspace_discussion_topics")
      .select("id")
      .eq("workspace_id", workspaceId);
    if (topicRowsError) throw topicRowsError;

    const topicIds = (topicRows || []).map((topic) => topic.id);
    let attachmentPaths = new Set();
    if (topicIds.length > 0) {
      const { data: attachmentRows, error: attachmentRowsError } = await supabase
        .from("workspace_discussion_attachments")
        .select("file_url")
        .in("topic_id", topicIds);
      if (attachmentRowsError) throw attachmentRowsError;
      attachmentPaths = new Set(
        (attachmentRows || []).map((attachment) => attachment.file_url),
      );
    }

    return res.status(200).json({
      status: "success",
      data: (data || [])
        .filter((document) => !attachmentPaths.has(document.file_url))
        .map(mapWorkspaceDocument),
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
    const storageMove = await moveWorkspaceDocumentToBucket(
      document,
      decision === "APPROVE" ? DOCUMENT_BUCKET : WAITING_BUCKET,
    );

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

    if (updateError) {
      if (storageMove.moved && storageMove.sourceBucket) {
        try {
          await moveWorkspaceDocumentToBucket(
            document,
            storageMove.sourceBucket,
          );
        } catch (rollbackError) {
          console.error(
            "Could not roll back workspace document storage move:",
            rollbackError,
          );
        }
      }
      throw updateError;
    }

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
