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

export async function generateFlashcards(documentId) {
  const response = await api.post(`/ai/documents/${documentId}/flashcards`);
  return response.data;
}

export async function getDocumentFlashcards(documentId) {
  const response = await api.get(`/ai/documents/${documentId}/flashcards`);
  return response.data.data;
}
