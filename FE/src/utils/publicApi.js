import api from "./api";

export const getPublicLibraries = () =>
  api.get("/public/libraries").then((res) => res.data.data);

export const getPublicLibrary = (libraryId) =>
  api.get(`/public/libraries/${libraryId}`).then((res) => res.data.data);

export const recordPublicLibraryDownload = (libraryId) =>
  api.post(`/public/libraries/${libraryId}/download`).then((res) => res.data.data);

export const downloadPublicDocument = (documentId) =>
  api.get(`/public/documents/${documentId}/download`).then((res) => res.data.data);
