import api from "./api";
export async function submitIssue(payload, attachments = []) {
  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => body.append(key, value));
  attachments.forEach((file) => body.append("attachments", file));
  const response = await api.post("/issues", body);
  return response.data.data;
}
export async function getMyIssues() { const response = await api.get("/issues/me"); return response.data.data; }
export async function getMyIssue(issueId) { const response = await api.get(`/issues/me/${issueId}`); return response.data.data; }
