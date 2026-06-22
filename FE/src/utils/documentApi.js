import api from "./api";

export async function getMyDocuments() {
  const response = await api.get("/documents");
  return response.data.data;
}

export async function uploadDocuments(files, workspaceId) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  if (workspaceId) {
    formData.append("workspaceId", workspaceId);
  }

  const response = await api.post("/documents/upload", formData);

  return response.data.data;
}

export async function downloadDocument(documentId) {
  const response = await api.get(`/documents/${documentId}/download`);
  return response.data.data;
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`);
  return response.data;
}
