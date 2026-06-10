import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../../../utils/authToken";

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user"));

  if (!isLoggedIn()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

export default ProtectedRoute;