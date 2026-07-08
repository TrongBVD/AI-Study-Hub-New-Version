import api from "./api";

export const getWorkspaces = () =>
  api.get("/workspaces").then((res) => res.data.data);

export const createWorkspace = (payload) =>
  api.post("/workspaces", payload).then((res) => res.data.data);

export const getWorkspace = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}`).then((res) => res.data.data);

export const getWorkspaceMembers = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/members`).then((res) => res.data.data);

export const searchWorkspaceUsers = (workspaceId, q) =>
  api.get(`/workspaces/${workspaceId}/users/search`, {
    params: { q: String(q || "").trim().replace(/^@+/, "") },
  })
    .then((res) => res.data.data);

export const addWorkspaceMember = (workspaceId, payload) =>
  api.post(`/workspaces/${workspaceId}/members`, payload)
    .then((res) => res.data.data);

export const updateWorkspaceMemberRole = (workspaceId, userId, payload) =>
  api.patch(`/workspaces/${workspaceId}/members/${userId}`, payload)
    .then((res) => res.data.data);

export const removeWorkspaceMember = (workspaceId, userId) =>
  api.delete(`/workspaces/${workspaceId}/members/${userId}`)
    .then((res) => res.data);

export const updateWorkspace = (workspaceId, payload) =>
  api.put(`/workspaces/${workspaceId}`, payload).then((res) => res.data.data);

export const deleteWorkspace = (workspaceId) =>
  api.delete(`/workspaces/${workspaceId}`).then((res) => res.data);

export const getWorkspaceMessages = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/messages`).then((res) => res.data.data);

export const createWorkspaceMessage = (workspaceId, payload) =>
  api.post(`/workspaces/${workspaceId}/messages`, payload)
    .then((res) => res.data.data);

export const getWorkspaceFlashcards = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/flashcards`).then((res) => res.data.data);

export const getWorkspaceDocuments = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/documents`).then((res) => res.data.data);

export const reviewWorkspaceDocument = (workspaceId, documentId, payload) =>
  api.patch(`/workspaces/${workspaceId}/documents/${documentId}/review`, payload)
    .then((res) => res.data.data);

export const generateWorkspaceDocumentFlashcards = (documentId) =>
  api.post(`/ai/documents/${documentId}/flashcards`).then((res) => res.data.data);
