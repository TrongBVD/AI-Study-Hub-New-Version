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

export async function getDocumentView(documentId) {
  const response = await api.get(`/documents/${documentId}/view`);
  return response.data.data;
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`);
  return response.data;
}

export async function getMyLibraries() {
  const response = await api.get("/documents/libraries");
  return response.data.data;
}

export async function createLibrary(payload) {
  const response = await api.post("/documents/libraries", payload);
  return response.data.data;
}

export async function updateLibrary(libraryId, payload) {
  const response = await api.put(`/documents/libraries/${libraryId}`, payload);
  return response.data.data;
}

export async function getLibrary(libraryId) {
  const response = await api.get(`/documents/libraries/${libraryId}`);
  return response.data.data;
}

export async function deleteLibrary(libraryId) {
  const response = await api.delete(`/documents/libraries/${libraryId}`);
  return response.data;
}
