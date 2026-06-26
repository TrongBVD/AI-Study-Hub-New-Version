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
