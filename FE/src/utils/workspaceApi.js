import api from "./api";

export const getWorkspaces = () =>
  api.get("/workspaces").then((res) => res.data.data);

export const getMyWorkspaceNotifications = () =>
  api.get("/workspaces/notifications/me").then((res) => res.data.data);

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

export const getWorkspaceDiscussionTopics = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/discussion/topics`).then((res) => res.data.data);

export const createWorkspaceDiscussionTopic = (workspaceId, payload) =>
  api.post(`/workspaces/${workspaceId}/discussion/topics`, payload)
    .then((res) => res.data.data);

export const updateWorkspaceDiscussionTopic = (workspaceId, topicId, payload) =>
  api.patch(`/workspaces/${workspaceId}/discussion/topics/${topicId}`, payload)
    .then((res) => res.data.data);

export const deleteWorkspaceDiscussionTopic = (workspaceId, topicId) =>
  api.delete(`/workspaces/${workspaceId}/discussion/topics/${topicId}`)
    .then((res) => res.data);

export const addWorkspaceDiscussionComment = (workspaceId, topicId, payload) =>
  api.post(`/workspaces/${workspaceId}/discussion/topics/${topicId}/comments`, payload)
    .then((res) => res.data.data);

export const updateWorkspaceDiscussionComment = (workspaceId, topicId, commentId, payload) =>
  api.patch(`/workspaces/${workspaceId}/discussion/topics/${topicId}/comments/${commentId}`, payload)
    .then((res) => res.data.data);

export const addWorkspaceDiscussionAttachment = (workspaceId, topicId, payload) =>
  api.post(`/workspaces/${workspaceId}/discussion/topics/${topicId}/attachments`, payload)
    .then((res) => res.data.data);

export const deleteWorkspaceDiscussionAttachment = (workspaceId, topicId, attachmentId) =>
  api.delete(`/workspaces/${workspaceId}/discussion/topics/${topicId}/attachments/${attachmentId}`)
    .then((res) => res.data);

export const addWorkspaceDiscussionSubtask = (workspaceId, topicId, payload) =>
  api.post(`/workspaces/${workspaceId}/discussion/topics/${topicId}/subtasks`, payload)
    .then((res) => res.data.data);

export const updateWorkspaceDiscussionSubtask = (workspaceId, topicId, subtaskId, payload) =>
  api.patch(`/workspaces/${workspaceId}/discussion/topics/${topicId}/subtasks/${subtaskId}`, payload)
    .then((res) => res.data.data);

export const deleteWorkspaceDiscussionSubtask = (workspaceId, topicId, subtaskId) =>
  api.delete(`/workspaces/${workspaceId}/discussion/topics/${topicId}/subtasks/${subtaskId}`)
    .then((res) => res.data);

export const getWorkspaceDocuments = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/documents`).then((res) => res.data.data);

export const reviewWorkspaceDocument = (workspaceId, documentId, payload) =>
  api.patch(`/workspaces/${workspaceId}/documents/${documentId}/review`, payload)
    .then((res) => res.data.data);

export const generateWorkspaceDocumentFlashcards = (documentId) =>
  api.post(`/ai/documents/${documentId}/flashcards`).then((res) => res.data.data);

export const leaveWorkspace = (workspaceId) =>
  api.post(`/workspaces/${workspaceId}/leave`).then((res) => res.data);

export const respondToInvitation = (invitationId, action) =>
  api.post(`/workspaces/invitations/${invitationId}/respond`, { action }).then((res) => res.data);

export const markWorkspaceNotificationsAsReadApi = () =>
  api.post("/workspaces/notifications/mark-read").then((res) => res.data);

export const transferAdminOwnership = (workspaceId, targetUserId) =>
  api.post(`/workspaces/${workspaceId}/transfer-admin`, { targetUserId }).then((res) => res.data);
