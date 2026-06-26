import api from "./api";

export async function getMyDocuments(libraryId = null) {
  const params = {};
  if (libraryId) {
    params.libraryId = libraryId;
  }
  const response = await api.get("/documents", { params });
   return response.data.data;
 }

// Đã bổ sung thêm tham số libraryId
export async function uploadDocuments(files, workspaceId = null, libraryId = null) {
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