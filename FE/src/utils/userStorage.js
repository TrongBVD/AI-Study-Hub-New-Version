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
