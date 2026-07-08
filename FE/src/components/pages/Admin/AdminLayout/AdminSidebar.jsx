import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../../../../assets/logo/Logo.jsx";
import api from "../../../../utils/api.js";

const ADMIN_MENU_ITEMS = [
  { icon: "ti-dashboard", label: "Dashboard", path: "/admin/dashboard" },
  { icon: "ti-shield", label: "AI Moderation", path: "/admin/moderation" },
  { icon: "ti-user", label: "Users", path: "/admin/users" },
  { icon: "ti-list", label: "Activity Logs", path: "/admin/logs" },
  { icon: "ti-pie-chart", label: "Usage", path: "/admin/usage" },
];

function AdminSidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      localStorage.clear();
      onClose();
      navigate("/login", { replace: true });
    }
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="sidebar_overlay"
          aria-label="Close admin sidebar"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? "sidebar_open" : ""}`}>
        <div className="sidebar_top">
          <div className="sidebar_header">
            <Logo />
            <button
              type="button"
              className="close_btn"
              aria-label="Close admin sidebar"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <nav className="sidebar_nav">
            {ADMIN_MENU_ITEMS.map((item) => (
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar_link ${isActive ? "active" : ""}`
                }
                key={item.label}
                onClick={onClose}
              >
                <i className={item.icon}></i>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar_bottom_actions">
          <NavLink
            to="/dashboard/home"
            className="admin_dashboard_btn"
            onClick={onClose}
          >
            <i className="ti-home"></i>
            <span>User dashboard</span>
          </NavLink>

          <button type="button" className="logout_btn" onClick={handleLogout}>
            <i className="ti-power-off"></i>
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;
