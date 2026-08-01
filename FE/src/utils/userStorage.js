import { getStoredUser } from "./authToken.js";

export function getCurrentUserId() {
  const user = getStoredUser();
  return user?.id || user?._id || user?.user_id || null;
}

export function getUserStorageKey(key) {
  const userId = getCurrentUserId();
  return userId ? `${key}:${userId}` : null;
}

export function getUserStoredItem(key) {
  const scopedKey = getUserStorageKey(key);
  return scopedKey ? localStorage.getItem(scopedKey) : null;
}

export function setUserStoredItem(key, value) {
  const scopedKey = getUserStorageKey(key);
  if (scopedKey) localStorage.setItem(scopedKey, value);
}

export function removeUserStoredItem(key) {
  const scopedKey = getUserStorageKey(key);
  if (scopedKey) localStorage.removeItem(scopedKey);
}

export function clearCurrentUserStorage() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;

    const userSuffix = `:${userId}`;
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(userSuffix)) {
        keysToRemove.push(key);
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.endsWith(userSuffix)) {
        sessionStorage.removeItem(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("Failed to clear user-scoped storage:", error);
  }
}
