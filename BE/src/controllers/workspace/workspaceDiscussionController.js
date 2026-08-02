const supabase = require("../../config/supabase");
const crypto = require("crypto");
const path = require("path");
const {
  DISCUSSION_TOPIC_SELECT,
  DOCUMENT_BUCKET,
  findDuplicateDiscussionTopic,
  getWorkspaceDiscussionAccess,
  getDiscussionTopicInWorkspace,
  normalizeUploadedFileName,
  mapDiscussionTopic,
  mapDiscussionComment,
  mapDiscussionSubtask,
  mapDiscussionAttachment,
} = require("./workspaceHelpers");

exports.listDiscussionTopics = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canReadDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace discussion.",
      });
    }

    const { data, error } = await supabase
      .from("workspace_discussion_topics")
      .select(DISCUSSION_TOPIC_SELECT)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      data: (data || []).map(mapDiscussionTopic),
    });
  } catch (error) {
    console.error("listDiscussionTopics error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load discussion topics.",
      error: error.message,
    });
  }
};

exports.createDiscussionTopic = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can create discussion topics.",
      });
    }

    const title = String(req.body.title || "").trim().replace(/\s+/g, " ");
    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Topic title is required.",
      });
    }

    const duplicateTopic = await findDuplicateDiscussionTopic(
      workspaceId,
      title,
    );
    if (duplicateTopic) {
      return res.status(409).json({
        status: "error",
        code: "DUPLICATE_TOPIC_TITLE",
        message: "A topic with this title already exists in the workspace.",
      });
    }

    const payload = {
      workspace_id: workspaceId,
      created_by: req.user.id,
      title,
      content: String(req.body.content || "").trim() || null,
      topic_type: req.body.topicType || "Question",
      status: req.body.status || "In progress",
      priority: req.body.priority || "Normal",
      date_mode: req.body.dateMode || "none",
      start_date: req.body.startDate || null,
      end_date: req.body.endDate || null,
      is_pinned: req.body.isPinned === true,
    };

    const { data, error } = await supabase
      .from("workspace_discussion_topics")
      .insert(payload)
      .select(DISCUSSION_TOPIC_SELECT)
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: mapDiscussionTopic(data),
    });
  } catch (error) {
    console.error("createDiscussionTopic error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not create discussion topic.",
      error: error.message,
    });
  }
};

exports.updateDiscussionTopic = async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can update discussion topics.",
      });
    }

    const existingTopic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!existingTopic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const updatePayload = {};
    const fields = {
      title: "title",
      content: "content",
      topicType: "topic_type",
      status: "status",
      priority: "priority",
      dateMode: "date_mode",
      startDate: "start_date",
      endDate: "end_date",
      isPinned: "is_pinned",
    };

    Object.entries(fields).forEach(([bodyKey, column]) => {
      if (req.body[bodyKey] !== undefined) {
        updatePayload[column] = req.body[bodyKey];
      }
    });

    if (typeof updatePayload.title === "string") {
      updatePayload.title = updatePayload.title.trim().replace(/\s+/g, " ");
      if (!updatePayload.title) {
        return res.status(400).json({
          status: "error",
          message: "Topic title is required.",
        });
      }

      const duplicateTopic = await findDuplicateDiscussionTopic(
        workspaceId,
        updatePayload.title,
        topicId,
      );
      if (duplicateTopic) {
        return res.status(409).json({
          status: "error",
          code: "DUPLICATE_TOPIC_TITLE",
          message: "A topic with this title already exists in the workspace.",
        });
      }
    }

    if (typeof updatePayload.content === "string") {
      updatePayload.content = updatePayload.content.trim();
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("workspace_discussion_topics")
      .update(updatePayload)
      .eq("workspace_id", workspaceId)
      .eq("id", topicId)
      .is("deleted_at", null)
      .select(DISCUSSION_TOPIC_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mapDiscussionTopic(data),
    });
  } catch (error) {
    console.error("updateDiscussionTopic error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update discussion topic.",
      error: error.message,
    });
  }
};

exports.deleteDiscussionTopic = async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can delete discussion topics.",
      });
    }

    const existingTopic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!existingTopic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const { error } = await supabase
      .from("workspace_discussion_topics")
      .update({ deleted_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", topicId);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      message: "Discussion topic deleted.",
    });
  } catch (error) {
    console.error("deleteDiscussionTopic error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not delete discussion topic.",
      error: error.message,
    });
  }
};

exports.addDiscussionComment = async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);
    const isSolution = req.body.kind === "solution";
    const isSolutionReply = req.body.kind === "solutionReply";

    if (
      !access.workspace ||
      (isSolution || isSolutionReply
        ? !access.canSubmitSolutions
        : !access.canReadDiscussion)
    ) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace discussion.",
      });
    }

    const rawContent = String(req.body.content || "").trim();
    const solutionId = String(req.body.solutionId || "").trim();
    if (isSolutionReply) {
      const { data: targetSolution, error: solutionError } = await supabase
        .from("workspace_discussion_comments")
        .select("id, content")
        .eq("id", solutionId)
        .eq("topic_id", topicId)
        .maybeSingle();
      if (solutionError) throw solutionError;
      if (
        !targetSolution ||
        !String(targetSolution.content || "").startsWith("[[SOLUTION]]")
      ) {
        return res.status(404).json({
          status: "error",
          message: "Solution not found.",
        });
      }
    }
    const content = isSolution
      ? `[[SOLUTION]]${rawContent}`
      : isSolutionReply
        ? `[[SOLUTION_REPLY:${solutionId}]]${rawContent}`
        : rawContent;
    if (!rawContent) {
      return res.status(400).json({
        status: "error",
        message: isSolution
          ? "Solution content is required."
          : isSolutionReply
            ? "Comment content is required."
          : "Comment content is required.",
      });
    }

    const { data: topic, error: topicError } = await supabase
      .from("workspace_discussion_topics")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", topicId)
      .is("deleted_at", null)
      .maybeSingle();

    if (topicError) throw topicError;
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    if (isSolution) {
      const { data: existingSolution, error: existingSolutionError } =
        await supabase
          .from("workspace_discussion_comments")
          .select("id")
          .eq("topic_id", topicId)
          .eq("user_id", req.user.id)
          .like("content", "[[SOLUTION]]%")
          .limit(1)
          .maybeSingle();

      if (existingSolutionError) throw existingSolutionError;
      if (existingSolution) {
        return res.status(409).json({
          status: "error",
          code: "SOLUTION_LIMIT_REACHED",
          message:
            "You have already submitted a solution for this topic. Edit your existing solution instead.",
        });
      }
    }

    const { data, error } = await supabase
      .from("workspace_discussion_comments")
      .insert({
        topic_id: topicId,
        user_id: req.user.id,
        content,
      })
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: mapDiscussionComment(data),
    });
  } catch (error) {
    console.error("addDiscussionComment error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not add comment.",
      error: error.message,
    });
  }
};

exports.updateDiscussionComment = async (req, res) => {
  try {
    const { workspaceId, topicId, commentId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);
    if (!access.workspace || !access.canSubmitSolutions) {
      return res.status(403).json({ status: "error", message: "You cannot access this workspace discussion." });
    }

    const content = String(req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ status: "error", message: "Solution content is required." });
    }

    const { data: existing, error: findError } = await supabase
      .from("workspace_discussion_comments")
      .select("id, user_id, content")
      .eq("id", commentId)
      .eq("topic_id", topicId)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) return res.status(404).json({ status: "error", message: "Solution not found." });
    if (existing.user_id !== req.user.id || !String(existing.content || "").startsWith("[[SOLUTION]]")) {
      return res.status(403).json({ status: "error", message: "You can only edit your own solution." });
    }

    const { data, error } = await supabase
      .from("workspace_discussion_comments")
      .update({
        content: `[[SOLUTION]]${content}`,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .eq("topic_id", topicId)
      .select(`id, topic_id, user_id, content, is_edited, created_at, updated_at,
        author:profiles!workspace_discussion_comments_user_id_fkey (id, email, username, full_name, avatar_url)`)
      .single();
    if (error) throw error;
    return res.status(200).json({ status: "success", data: mapDiscussionComment(data) });
  } catch (error) {
    console.error("updateDiscussionComment error:", error);
    return res.status(500).json({ status: "error", message: "Could not update solution.", error: error.message });
  }
};

exports.addDiscussionSubtask = async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can add subtasks.",
      });
    }

    const topic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const title = String(req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Subtask title is required.",
      });
    }

    const { data, error } = await supabase
      .from("workspace_discussion_subtasks")
      .insert({
        topic_id: topicId,
        created_by: req.user.id,
        title,
        is_done: false,
        sort_order: Number(req.body.sortOrder || 0),
      })
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: mapDiscussionSubtask(data),
    });
  } catch (error) {
    console.error("addDiscussionSubtask error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not add subtask.",
      error: error.message,
    });
  }
};

exports.updateDiscussionSubtask = async (req, res) => {
  try {
    const { workspaceId, topicId, subtaskId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can update subtasks.",
      });
    }

    const topic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const updatePayload = {};
    if (req.body.title !== undefined) updatePayload.title = String(req.body.title || "").trim();
    if (req.body.isDone !== undefined) updatePayload.is_done = req.body.isDone === true || req.body.isDone === "true";
    if (req.body.sortOrder !== undefined) updatePayload.sort_order = Number(req.body.sortOrder || 0);
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("workspace_discussion_subtasks")
      .update(updatePayload)
      .eq("id", subtaskId)
      .eq("topic_id", topicId)
      .select(
        `
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
      `,
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Subtask not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mapDiscussionSubtask(data),
    });
  } catch (error) {
    console.error("updateDiscussionSubtask error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update subtask.",
      error: error.message,
    });
  }
};

exports.deleteDiscussionSubtask = async (req, res) => {
  try {
    const { workspaceId, topicId, subtaskId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canWriteDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "Only workspace editors and admins can delete subtasks.",
      });
    }

    const topic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const { error } = await supabase
      .from("workspace_discussion_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("topic_id", topicId);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      message: "Subtask deleted.",
    });
  } catch (error) {
    console.error("deleteDiscussionSubtask error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not delete subtask.",
      error: error.message,
    });
  }
};

exports.addDiscussionAttachment = async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);
    const attachmentKind = req.body.kind === "solution" ? "solution" : "attachment";
    const isMemberUpload = req.body.source === "chat" || attachmentKind === "solution";
    const canAddAttachment = isMemberUpload
      ? access.canSubmitSolutions
      : access.canWriteDiscussion;

    if (!access.workspace || !canAddAttachment) {
      return res.status(403).json({
        status: "error",
        message: isMemberUpload
          ? "You cannot upload files to this topic."
          : "Only workspace editors and admins can add discussion attachments.",
      });
    }

    const topic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const fileName = String(req.body.fileName || "").trim();
    const fileUrl = String(req.body.fileUrl || "").trim();
    if (!fileName || !fileUrl) {
      return res.status(400).json({
        status: "error",
        message: "fileName and fileUrl are required.",
      });
    }

    const { data, error } = await supabase
      .from("workspace_discussion_attachments")
      .insert({
        topic_id: topicId,
        uploaded_by: req.user.id,
        file_name: fileName,
        file_url: fileUrl,
        file_size_bytes: Number(req.body.fileSizeBytes || 0),
        mime_type: attachmentKind === "solution"
          ? `solution:${String(req.body.solutionId || "").trim()}|${String(req.body.mimeType || "").trim()}`
          : String(req.body.mimeType || "").trim() || null,
      })
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: "success",
      data: mapDiscussionAttachment(data),
    });
  } catch (error) {
    console.error("addDiscussionAttachment error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not add discussion attachment.",
      error: error.message,
    });
  }
};

exports.uploadDiscussionAttachments = async (req, res) => {
  const uploadedPaths = [];
  try {
    const { workspaceId, topicId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);
    const attachmentKind = req.body.kind === "solution" ? "solution" : "attachment";
    const canUpload = attachmentKind === "solution"
      ? access.canSubmitSolutions
      : access.canWriteDiscussion;

    if (!access.workspace || !canUpload) {
      return res.status(403).json({ status: "error", message: "You cannot upload files to this topic." });
    }
    if (!(await getDiscussionTopicInWorkspace(workspaceId, topicId))) {
      return res.status(404).json({ status: "error", message: "Discussion topic not found." });
    }
    if (!req.files?.length) {
      return res.status(400).json({ status: "error", message: "Please select at least one file." });
    }

    req.files.forEach((file) => {
      file.originalname = normalizeUploadedFileName(file.originalname);
    });

    const rows = [];
    for (const file of req.files) {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${req.user.id}/workspace-discussions/${workspaceId}/${topicId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(storagePath, file.buffer, { contentType: file.mimetype || "application/octet-stream" });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      rows.push({
        topic_id: topicId,
        uploaded_by: req.user.id,
        file_name: file.originalname,
        file_url: storagePath,
        file_size_bytes: file.size,
        mime_type: attachmentKind === "solution"
          ? `solution:${String(req.body.solutionId || "").trim()}|${file.mimetype || ""}`
          : file.mimetype || null,
      });
    }

    const { data, error } = await supabase
      .from("workspace_discussion_attachments")
      .insert(rows)
      .select(`id, topic_id, uploaded_by, file_name, file_url, file_size_bytes, mime_type, created_at,
        uploader:profiles!workspace_discussion_attachments_uploaded_by_fkey (id, email, username, full_name, avatar_url)`);
    if (error) throw error;

    return res.status(201).json({ status: "success", data: (data || []).map(mapDiscussionAttachment) });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
    }
    console.error("uploadDiscussionAttachments error:", error);
    return res.status(500).json({ status: "error", message: "Could not upload discussion attachments.", error: error.message });
  }
};

exports.viewDiscussionAttachment = async (req, res) => {
  try {
    const { workspaceId, topicId, attachmentId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canReadDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "You cannot view files in this workspace.",
      });
    }

    if (!(await getDiscussionTopicInWorkspace(workspaceId, topicId))) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("workspace_discussion_attachments")
      .select("id, topic_id, file_name, file_url, file_size_bytes, mime_type")
      .eq("id", attachmentId)
      .eq("topic_id", topicId)
      .maybeSingle();

    if (attachmentError) throw attachmentError;
    if (!attachment) {
      return res.status(404).json({
        status: "error",
        message: "Attachment not found.",
      });
    }

    const shouldDownload = req.query.download === "true";
    const normalizedFileName = normalizeUploadedFileName(attachment.file_name);
    let viewUrl = attachment.file_url;
    if (!/^https?:\/\//i.test(viewUrl || "")) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(
          attachment.file_url,
          60 * 60,
          shouldDownload ? { download: normalizedFileName } : undefined,
        );
      if (signedUrlError) throw signedUrlError;
      viewUrl = signedUrlData?.signedUrl;
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId: attachment.id,
        fileName: normalizedFileName,
        fileSizeBytes: attachment.file_size_bytes || 0,
        mimeType: attachment.mime_type,
        viewUrl,
        expiresIn: 60 * 60,
      },
    });
  } catch (error) {
    console.error("viewDiscussionAttachment error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not open this attachment.",
      error: error.message,
    });
  }
};

exports.deleteDiscussionAttachment = async (req, res) => {
  try {
    const { workspaceId, topicId, attachmentId } = req.params;
    const access = await getWorkspaceDiscussionAccess(workspaceId, req.user.id);

    if (!access.workspace || !access.canReadDiscussion) {
      return res.status(403).json({
        status: "error",
        message: "You cannot access this workspace discussion.",
      });
    }

    const topic = await getDiscussionTopicInWorkspace(workspaceId, topicId);
    if (!topic) {
      return res.status(404).json({
        status: "error",
        message: "Discussion topic not found.",
      });
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("workspace_discussion_attachments")
      .select("id, uploaded_by")
      .eq("id", attachmentId)
      .eq("topic_id", topicId)
      .maybeSingle();
    if (attachmentError) throw attachmentError;
    if (!attachment) return res.status(404).json({ status: "error", message: "Attachment not found." });
    if (!access.canWriteDiscussion && attachment.uploaded_by !== req.user.id) {
      return res.status(403).json({ status: "error", message: "You can only delete your own attachments." });
    }

    const { error } = await supabase
      .from("workspace_discussion_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("topic_id", topicId);

    if (error) throw error;

    return res.status(200).json({
      status: "success",
      message: "Discussion attachment deleted.",
    });
  } catch (error) {
    console.error("deleteDiscussionAttachment error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not delete discussion attachment.",
      error: error.message,
    });
  }
};
