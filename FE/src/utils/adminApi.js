import api from "./api";

export async function getAdminDashboard() {
  const response = await api.get("/admin/dashboard");
  return response.data.data;
}

export async function getModerationDocuments() {
  const response = await api.get("/admin/moderation");
  return response.data.data;
}

export async function reviewDocument(documentId, decision, reason) {
  const response = await api.patch(`/admin/moderation/${documentId}`, {
    decision,
    reason,
  });

  return response.data.data;
}

export async function getAdminUsers(search = "") {
  const response = await api.get("/admin/users", {
    params: search ? { search } : {},
  });

  return response.data.data;
}

export async function updateUserStatus(userId, status, reason = "") {
  const response = await api.patch(`/admin/users/${userId}/status`, {
    status,
    reason,
  });

  return response.data.data;
}

export async function getActivityLogs() {
  const response = await api.get("/admin/logs");
  return response.data.data;
}

export async function getUsageStats() {
  const response = await api.get("/admin/usage");
  return response.data.data;
}