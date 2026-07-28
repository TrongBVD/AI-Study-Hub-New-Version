export function getStarredLibraryIds() {
  try {
    const raw = localStorage.getItem("aiStudyHubStarredLibraries");
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
  localStorage.setItem("aiStudyHubStarredLibraries", JSON.stringify(nextStarred));
  return nextStarred.includes(idStr);
}
