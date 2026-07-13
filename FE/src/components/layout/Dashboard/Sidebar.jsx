import { NavLink, useNavigate } from "react-router-dom";
import { LuLogOut } from "react-icons/lu";
import Logo from "../../../assets/logo/Logo.jsx";
import api from "../../../utils/api.js";
import { clearStoredSession, getStoredUser } from "../../../utils/authToken.js";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function getStoredUserRole() {
  try {
    const storedUser = getStoredUser();
    return String(storedUser?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const userRole = getStoredUserRole();
  const isSystemAdmin = userRole === "SYSTEM_ADMIN";
  const isGuest = userRole === "GUEST"; // Nhận diện Guest

  // Thêm thuộc tính hideForGuest để ẩn menu với Guest
  const menuItems = [
    { icon: "ti-home", label: "Home", path: "/dashboard/home" },
    { icon: "ti-search", label: "Discover", path: "/dashboard/discover" },
    {
      icon: "ti-folder",
      label: "My libraries",
      path: "/dashboard/libraries",
      hideForGuest: true,
    },
    {
      icon: "ti-layout-grid2",
      label: "My workspaces",
      path: "/dashboard/workspaces",
      hideForGuest: true,
    },
    { icon: "ti-settings", label: "Settings", path: "/dashboard/settings" },
  ];

  // Guest chỉ được xem Discover và Settings.
  const visibleMenuItems = isGuest
    ? menuItems.filter((item) => ["Discover", "Settings"].includes(item.label))
    : menuItems;

  async function handleLogout() {
    try {
      // Nếu không phải là Guest thì mới gọi API logout
      if (!isGuest) {
        await api.post("/auth/logout");
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      clearStoredSession();
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
            {visibleMenuItems.map((item) => (
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
            <LuLogOut aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
