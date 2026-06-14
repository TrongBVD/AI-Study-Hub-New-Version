import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./Admin.css";

function AdminLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin_shell">
      <aside className="admin_sidebar">
        <div className="admin_brand">
          <h2>AI StudyHub</h2>
          <p>System Admin</p>
        </div>

        <nav className="admin_nav">
          <NavLink className="admin_nav_link" to="/admin/dashboard">
            Dashboard
          </NavLink>

          <NavLink className="admin_nav_link" to="/admin/users">
            User Management
          </NavLink>

          <NavLink className="admin_nav_link" to="/admin/ai-moderation">
            AI Content Moderation
          </NavLink>

          <NavLink className="admin_nav_link" to="/admin/storage">
            Storage Management
          </NavLink>

          <NavLink className="admin_nav_link" to="/dashboard/home">
            User Dashboard
          </NavLink>
        </nav>

        <button className="admin_logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="admin_content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
