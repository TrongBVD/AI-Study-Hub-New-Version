import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearStoredSession,
  getAccessToken,
  getAuthStorage,
  getStoredRole,
  isTokenValid,
} from "../../../utils/authToken";
import { refreshAccessToken } from "../../../utils/api";
import { getMyProfile } from "../../../utils/profileApi";

const GUEST_ALLOWED_PATHS = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/discover",
  "/dashboard/libraries",
  "/dashboard/search",
  "/dashboard/settings",
];

function isGuestAllowedPath(pathname) {
  // Cho phép Guest xem catalog public và chi tiết thư viện công khai.
  if (pathname === "/dashboard") {
    return true;
  }

  if (pathname === "/dashboard/libraries" || pathname.startsWith("/dashboard/libraries/")) {
    return true;
  }

  if (pathname.startsWith("/dashboard/profile/")) {
    return true;
  }

  if (pathname.startsWith("/dashboard/documents/")) {
    return true;
  }

  return GUEST_ALLOWED_PATHS.some(
    (allowedPath) => pathname === allowedPath,
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const storedRole = getStoredRole();
  const [authState, setAuthState] = useState(() => {
    return storedRole === "GUEST" || isTokenValid(getAccessToken())
      ? "authenticated"
      : "checking";
  });
  const [verifiedRole, setVerifiedRole] = useState(() =>
    storedRole === "GUEST" ? "GUEST" : null,
  );
  const token = getAccessToken();
  const role = verifiedRole || storedRole;
  const isGuest = role === "GUEST";
  const isSystemAdmin = role === "SYSTEM_ADMIN";

  useEffect(() => {
    if (getStoredRole() === "GUEST") {
      return undefined;
    }

    if (isTokenValid(getAccessToken())) {
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

  useEffect(() => {
    if (authState !== "authenticated" || getStoredRole() === "GUEST") {
      return undefined;
    }

    let isMounted = true;

    getMyProfile()
      .then((profile) => {
        if (!isMounted) return;

        let currentUser = {};
        try {
          currentUser = JSON.parse(getAuthStorage().getItem("user") || "{}");
        } catch {
          currentUser = {};
        }
        const serverRole = String(profile?.role || "USER").toUpperCase();

        getAuthStorage().setItem(
          "user",
          JSON.stringify({ ...currentUser, ...profile, role: serverRole }),
        );
        setVerifiedRole(serverRole);
      })
      .catch(() => {
        if (isMounted) setVerifiedRole(getStoredRole() || "USER");
      });

    return () => {
      isMounted = false;
    };
  }, [authState]);

  if (authState === "checking" || (authState === "authenticated" && !verifiedRole)) {
    return null;
  }

  // Not logged in or token is expired/invalid
  if (
    !isGuest &&
    (authState === "unauthenticated" || !token || !isTokenValid(token))
  ) {
    if (token) {
      clearStoredSession();
    }
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // System admins use only the dedicated admin application shell.
  if (isSystemAdmin && location.pathname.startsWith("/dashboard")) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Logged in, but does not have required role
  if (allowedRoles && !allowedRoles.map((item) => item.toUpperCase()).includes(role)) {
    return (
      <Navigate
        to={isSystemAdmin ? "/admin/dashboard" : "/dashboard/home"}
        replace
      />
    );
  }

  if (isGuest && !isGuestAllowedPath(location.pathname)) {
    return <Navigate to="/dashboard/home" replace />;
  }

  return children;
}

export default ProtectedRoute;
