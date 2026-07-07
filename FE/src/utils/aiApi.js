import api from "./api";

export async function chatWithDocument(documentId, question) {
  const response = await api.post("/ai/chat", {
    documentId,
    question,
  });

  return response.data.data;
}

export async function getAiSummary() {
  const response = await api.get("/ai/summary");
  return response.data.data;
}
