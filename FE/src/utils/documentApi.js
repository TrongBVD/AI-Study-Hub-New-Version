import api from "./api";

export async function getMyDocuments(libraryId = null) {
  const params = {};
  if (libraryId) {
    params.libraryId = libraryId;
  }
  const response = await api.get("/documents", { params });
  return response.data.data;
}

export async function uploadDocuments(files, workspaceId = null, libraryId = null, tags = []) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  if (workspaceId) {
    formData.append("workspaceId", workspaceId);
  }
  
  if (libraryId) {
    formData.append("libraryId", libraryId);
  }

  if (tags && tags.length > 0) {
    formData.append("tags", JSON.stringify(tags));
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