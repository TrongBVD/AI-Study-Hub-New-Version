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
  storage.setItem("accessToken", accessToken);
  if (user) storage.setItem("user", JSON.stringify(user));

  if (rememberMe) localStorage.setItem("rememberMe", "true");
  else localStorage.removeItem("rememberMe");
}

export function clearStoredSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("rememberMe");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("user");
}

export function getAccessToken() {
  return getAuthStorage().getItem("accessToken");
}

export function clearAccessToken() {
  localStorage.removeItem("accessToken");
  sessionStorage.removeItem("accessToken");
}

export function isTokenValid(token) {
  if (!token) {
    return false;
  }

  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) {
      return false;
    }

    const normalizePayload = payloadBase64
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const payloadJson = atob(normalizePayload);
    const payload = JSON.parse(payloadJson);

    if (!payload.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
export function isLoggedIn() {
  const token = getAccessToken();

  if (!isTokenValid(token)) {
    clearAccessToken();
    return false;
  }
  return true;
}
