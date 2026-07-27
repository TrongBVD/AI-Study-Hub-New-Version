import api from "./api";
export async function submitIssue(payload) { const response = await api.post("/issues", payload); return response.data.data; }
export async function getMyIssues() { const response = await api.get("/issues/me"); return response.data.data; }
