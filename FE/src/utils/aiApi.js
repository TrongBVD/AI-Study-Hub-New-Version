import api from "./api";

/**
 * Sends a question to AI chat service with document/library context
 * Supports both object payload ({ documentId, question, selectedDocIds }) and positional args
 */
export async function chatWithDocument(payloadOrId, questionText, requestConfig = {}) {
  const payload = typeof payloadOrId === "object" && payloadOrId !== null
    ? payloadOrId
    : { documentId: payloadOrId, question: questionText };

  const response = await api.post("/ai/chat", payload, requestConfig);
  return response.data.data;
}

export async function getChatHistory() {
  const response = await api.get("/ai/chat-history");
  return response.data.data || [];
}

export async function deleteChatHistory(conversationId) {
  await api.delete(`/ai/chat-history/${conversationId}`);
}

export async function clearChatHistory() {
  await api.delete("/ai/chat-history");
}

export async function getAiSummary() {
  const response = await api.get("/ai/summary");
  return response.data.data;
}

