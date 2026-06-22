import api from "./api";

export const normalizeUserSearchQuery = (query) =>
  String(query || "").trim().replace(/^@+/, "").trim();

export const searchUsers = (query) => {
  const normalizedQuery = normalizeUserSearchQuery(query);

  if (normalizedQuery.length < 2) {
    return Promise.resolve([]);
  }

  return api
    .get("/users/search", { params: { q: normalizedQuery } })
    .then((response) => response.data.data);
};
