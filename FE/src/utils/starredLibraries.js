import { getUserStoredItem, setUserStoredItem } from "./userStorage.js";

const STARRED_LIBRARIES_KEY = "aiStudyHubStarredLibraries";

export function getStarredLibraryIds() {
  try {
    const raw = getUserStoredItem(STARRED_LIBRARIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isLibraryStarred(libraryId) {
  if (!libraryId) return false;
  const starred = getStarredLibraryIds();
  return starred.includes(String(libraryId));
}

export function toggleStarLibrary(libraryId) {
  if (!libraryId) return false;
  const idStr = String(libraryId);
  const starred = getStarredLibraryIds();
  let nextStarred;
  if (starred.includes(idStr)) {
    nextStarred = starred.filter((id) => id !== idStr);
  } else {
    nextStarred = [...starred, idStr];
  }
  setUserStoredItem(STARRED_LIBRARIES_KEY, JSON.stringify(nextStarred));
  return nextStarred.includes(idStr);
}
