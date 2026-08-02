const supabase = require("../../config/supabase");
const {
  MESSAGE_SELECT,
  getWorkspaceAccess,
  mapWorkspaceMessage,
} = require("./workspaceHelpers");

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
