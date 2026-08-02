const supabase = require("../../config/supabase");
const {
  createEmbedding,
  toVectorLiteral,
  answerWithContext,
} = require("../../services/aiService");
const {
  ensureDocumentChunks,
  getAllowedDocument,
  increaseChatUsage,
  isGuestUser,
  saveChatHistory,
} = require("./aiHelpers");

exports.getChatHistory = async (req, res) => {
  try {
    if (isGuestUser(req.user)) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from("chat_conversations")
      .select("id, document_id, title, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });
    if (conversationsError) throw conversationsError;

    const conversationIds = (conversations || []).map((conversation) => conversation.id);
    if (conversationIds.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });
    if (messagesError) throw messagesError;

    const messagesByConversation = (messages || []).reduce((result, message) => {
      (result[message.conversation_id] ||= []).push({
        id: message.id,
        conversationId: message.conversation_id,
        role: message.role,
        text: message.content,
        createdAt: message.created_at,
      });
      return result;
    }, {});

    return res.status(200).json({
      status: "success",
      data: (conversations || []).map((conversation) => ({
        id: conversation.id,
        documentId: conversation.document_id,
        title: conversation.title,
        createdAt: conversation.created_at,
        messages: messagesByConversation[conversation.id] || [],
      })),
    });
  } catch (error) {
    console.error("getChatHistory error:", error);
    return res.status(500).json({ status: "error", message: "Could not load chat history." });
  }
};

exports.deleteChatHistoryItem = async (req, res) => {
  try {
    if (isGuestUser(req.user)) return res.status(204).send();

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", req.params.conversationId)
      .eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (error) {
    console.error("deleteChatHistoryItem error:", error);
    return res.status(500).json({ status: "error", message: "Could not delete chat history." });
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    if (isGuestUser(req.user)) return res.status(204).send();

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (error) {
    console.error("clearChatHistory error:", error);
    return res.status(500).json({ status: "error", message: "Could not clear chat history." });
  }
};

exports.chatWithDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId, question } = req.body;

    if (!documentId || !question || !question.trim()) {
      return res.status(400).json({
        status: "error",
        message: "documentId and question are required.",
      });
    }

    const document = await getAllowedDocument(documentId, userId);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found.",
      });
    }

    if (document === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this document.",
      });
    }

    if (document.status !== "APPROVED") {
      return res.status(409).json({
        status: "error",
        code: "DOCUMENT_NOT_AI_READY",
        message: "This document is not approved or not ready for AI chat yet.",
      });
    }

    const questionEmbedding = await createEmbedding(question, "query");

    let matchedChunks = [];
    try {
      const { data: rpcChunks } = await supabase.rpc("match_document_chunks", {
        match_document_id: documentId,
        query_embedding: toVectorLiteral(questionEmbedding),
        match_count: 5,
      });
      if (Array.isArray(rpcChunks) && rpcChunks.length > 0) {
        matchedChunks = rpcChunks;
      }
    } catch (e) {
      console.warn("RPC match_document_chunks error or fallback:", e);
    }

    if (matchedChunks.length === 0) {
      const availableChunks = await ensureDocumentChunks(document);
      matchedChunks = availableChunks.slice(0, 5);
    }

    if (!matchedChunks) {
      matchedChunks = [];
    }

    const answer = await answerWithContext(question, matchedChunks);
    await increaseChatUsage(userId);
    let chatHistory = null;
    try {
      chatHistory = await saveChatHistory({ userId, documentId, question, answer });
    } catch (historyError) {
      console.error("Could not save chat history:", historyError);
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId,
        question,
        answer,
        sources: matchedChunks.map((chunk) => ({
          chunk_index: chunk.chunk_index,
          similarity: chunk.similarity || 1,
        })),
        chatHistory,
      },
    });
  } catch (error) {
    console.error("chatWithDocument error:", error);

    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Could not chat with document.",
    });
  }
};
