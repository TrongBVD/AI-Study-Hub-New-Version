import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isTokenValid } from "../../../utils/authToken";
import { refreshAccessToken } from "../../../utils/api";

const GUEST_ALLOWED_PATHS = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/search-user",
  "/dashboard/profile",
  "/dashboard/search",
];

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user");

    if (!rawUser) {
      return null;
    }

    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function isGuestAllowedPath(pathname) {
  // Cho phép Guest xem chi tiết thư viện công khai (vd: /dashboard/libraries/123)
  // nhưng KHÔNG cho phép vào trang quản lý thư viện cá nhân (/dashboard/libraries)
  if (pathname.startsWith("/dashboard/libraries/")) {
    return true;
  }
  return GUEST_ALLOWED_PATHS.some(
    (allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const [authState, setAuthState] = useState(() =>
    isTokenValid(localStorage.getItem("accessToken"))
      ? "authenticated"
      : "checking",
  );
  const token = localStorage.getItem("accessToken");
  const user = getStoredUser();
  const role = String(user?.role || "").toUpperCase();

  useEffect(() => {
    if (isTokenValid(localStorage.getItem("accessToken"))) {
      return;
    }

    let isMounted = true;
    refreshAccessToken()
      .then(() => {
        if (isMounted) setAuthState("authenticated");
      })
      .catch(() => {
        if (isMounted) setAuthState("unauthenticated");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (authState === "checking") {
    return null;
  }

  // Not logged in or token is expired/invalid
  if (authState === "unauthenticated" || !token || !isTokenValid(token)) {
    if (token) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    }
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // Logged in, but does not have required role
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard/home" replace />;
  }

  if (role === "GUEST" && !isGuestAllowedPath(location.pathname)) {
    return <Navigate to="/dashboard/home" replace />;
  }

  return children;
}

export default ProtectedRoute;
