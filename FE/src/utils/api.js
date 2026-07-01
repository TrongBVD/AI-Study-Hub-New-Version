import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

let refreshPromise = null;

function clearStoredSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("aiStudyHubProfileName");
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${api.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((response) => {
        const accessToken = response.data?.data?.accessToken;
        const user = response.data?.data?.user;

        if (!accessToken) {
          throw new Error("Refresh response did not include an access token.");
        }

        localStorage.setItem("accessToken", accessToken);
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem(
            "aiStudyHubProfileName",
            user.username || user.full_name || user.email || "User",
          );
        }

        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");

    config.headers = config.headers || {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor cho Response
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      const originalRequest = error.config || {};
      const url = originalRequest.url || "";
      const isAuthAttempt =
        url.includes("/auth/login") ||
        url.includes("/auth/refresh") ||
        url.includes("/auth/verify-otp") ||
        url.includes("/auth/verify-reset-otp") ||
        url.includes("/auth/complete-setup") ||
        url.includes("/auth/google");

      const isSessionInvalidated =
        error.response.data?.code === "SESSION_EXPIRED";

      if (!isAuthAttempt && !originalRequest._retry && !isSessionInvalidated) {
        originalRequest._retry = true;

        try {
          const accessToken = await refreshAccessToken();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // Continue to the shared cleanup below.
        }
      }

      if (!isAuthAttempt) {
        if (error.response.data?.code === "SESSION_EXPIRED") {
          alert("Phiên đăng nhập đã hết hạn do tài khoản được đăng nhập ở nơi khác.");
        } else {
          alert("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
        }

        // Dọn dẹp vùng nhớ
        clearStoredSession();
        
        // Cưỡng chế điều hướng về trang đăng nhập
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
