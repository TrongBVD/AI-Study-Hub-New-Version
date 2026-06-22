import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../../../assets/logo/Logo.jsx";
import api from "../../../utils/api.js";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function getStoredUserRole() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    return String(storedUser?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const isSystemAdmin = getStoredUserRole() === "SYSTEM_ADMIN";

  const menuItems = [
    { icon: "ti-home", label: "Home", path: "/dashboard/home" },
    { icon: "ti-folder", label: "My libraries", path: "/dashboard/libraries" },
    { icon: "ti-layout-grid2", label: "My workspaces", path: "/dashboard/workspaces" },
    // Đã thay đổi AI Chat thành Search User ở đây
    { icon: "ti-search", label: "Search User", path: "/dashboard/search-user"},
    { icon: "ti-settings", label: "Settings", path: "/dashboard/settings" },
  ];

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      localStorage.removeItem("aiStudyHubProfileName");
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
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${isOpen ? "sidebar_open" : ""}`}>
        <div className="sidebar_top">
          <div className="sidebar_header">
            <Logo />

            <button className="close_btn" onClick={onClose}>
              ×
            </button>
          </div>

          <nav className="sidebar_nav">
            {menuItems.map((item) => (
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
          {isSystemAdmin && (
            <NavLink
              to="/admin/dashboard"
              className="admin_dashboard_btn"
              onClick={onClose}
            >
              <i className="ti-dashboard"></i>
              <span>Admin dashboard</span>
            </NavLink>
          )}

          <button type="button" className="logout_btn" onClick={handleLogout}>
            <i className="ti-power-off"></i>
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;