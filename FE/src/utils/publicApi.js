import api from "./api";

export const getPublicTags = () =>
  api.get("/public/tags").then((res) => res.data.data);

export const getPublicLibraries = (tagQuery = "") =>
  api
    .get("/public/libraries", { params: tagQuery ? { tag: tagQuery } : {} })
    .then((res) => res.data.data);

export const getPublicLibrary = (libraryId) =>
  api.get(`/public/libraries/${libraryId}`).then((res) => res.data.data);

export const recordPublicLibraryDownload = (libraryId) =>
  api.post(`/public/libraries/${libraryId}/download`).then((res) => res.data.data);

export const viewPublicDocument = (documentId) =>
  api.get(`/public/documents/${documentId}/view`).then((res) => res.data.data);

export const downloadPublicDocument = (documentId) =>
  api.get(`/public/documents/${documentId}/download`).then((res) => res.data.data);
