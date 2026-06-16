import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./AdminLayout.css";

function AdminLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-layout">
      <aside className="admin-layout__sidebar">
        <div className="admin-layout__brand">
          <h2>AI StudyHub</h2>
          <p>System Admin</p>
        </div>

        <nav className="admin-layout__nav">
          <NavLink to="/admin/dashboard" className="admin-layout__nav-link">
            Dashboard
          </NavLink>


          <NavLink to="/admin/moderation" className="admin-layout__nav-link">
            AI Moderation
          </NavLink>

          <NavLink to="/admin/users" className="admin-layout__nav-link">
            Users
          </NavLink>

          <NavLink to="/admin/logs" className="admin-layout__nav-link">
            Activity Logs
          </NavLink>

          <NavLink to="/admin/usage" className="admin-layout__nav-link">
            Usage

          </NavLink>

          <NavLink to="/dashboard/home" className="admin-layout__nav-link">
            User Dashboard
          </NavLink>
        </nav>

        <button className="admin-layout__logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-layout__content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
