import { clearCurrentUserStorage } from "./userStorage.js";

export function getAuthStorage() {
  return localStorage.getItem("rememberMe") === "true" ||
    localStorage.getItem("accessToken")
    ? localStorage
    : sessionStorage;
}

export function getStoredUser() {
  try {
    return JSON.parse(getAuthStorage().getItem("user") || "null");
  } catch {
    return null;
  }
}

export function storeAuthSession({ accessToken, user, rememberMe }) {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("user");

  const storage = rememberMe ? localStorage : sessionStorage;
  if (accessToken) storage.setItem("accessToken", accessToken);
  if (user) storage.setItem("user", JSON.stringify(user));

  if (rememberMe) localStorage.setItem("rememberMe", "true");
  else localStorage.removeItem("rememberMe");
}

export function clearStoredSession() {
  clearCurrentUserStorage();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("rememberMe");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("user");
}

export function getAccessToken() {
  return getAuthStorage().getItem("accessToken");
}

export function getAccessTokenPayload(token = getAccessToken()) {
  if (!token) return null;

  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;

    const normalizedPayload = payloadBase64
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );

    return JSON.parse(atob(paddedPayload));
  } catch {
    return null;
  }
}

export function getStoredRole() {
  const user = getStoredUser();
  const tokenPayload = getAccessTokenPayload();

  return String(
    tokenPayload?.role ||
      user?.role ||
      user?.system_role ||
      user?.systemRole ||
      user?.profile?.role ||
      "",
  ).toUpperCase();
}

export function getTokenExpiryMs(token) {
  const payload = getAccessTokenPayload(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

export function clearAccessToken() {
  localStorage.removeItem("accessToken");
  sessionStorage.removeItem("accessToken");
}

export function isTokenValid(token) {
  const expiryMs = getTokenExpiryMs(token);
  return Boolean(expiryMs && expiryMs > Date.now());
}
export function isLoggedIn() {
  const token = getAccessToken();
  return isTokenValid(token);
}
