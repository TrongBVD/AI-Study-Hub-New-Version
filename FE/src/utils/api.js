import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

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
  (error) => {
    if (error.response && error.response.status === 401) {
      if (error.response.data?.code === "SESSION_EXPIRED") {
        alert("Phiên đăng nhập đã hết hạn do tài khoản được đăng nhập ở nơi khác.");
        
        // Dọn dẹp vùng nhớ
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        localStorage.removeItem("aiStudyHubProfileName");
        
        // Cưỡng chế điều hướng về trang đăng nhập
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;