import { Navigate, useLocation } from "react-router-dom";

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

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  const user = getStoredUser();

  // Not logged in
  if (!token) {
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

  return children;
}

export default ProtectedRoute;