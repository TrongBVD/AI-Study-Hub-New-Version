import { NavLink } from "react-router-dom";
import Logo from "../../../assets/logo/Logo.jsx";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function Sidebar({ isOpen, onClose }) {
  const menuItems = [
    { icon: "ti-home", label: "Home", path: "/dashboard/home" },
    { icon: "ti-folder", label: "My libraries", path: "/dashboard/libraries" },
    { icon: "ti-layout-grid2", label: "My workspaces", path: "/dashboard/workspaces" },
    { icon: "ti-comments", label: "AI Chat", path: "/dashboard/ai-chat"},
    { icon: "ti-cloud-up", label: "Cloud upload", path: "/dashboard/cloud-upload" },
    { icon: "ti-settings", label: "Settings", path: "/dashboard/settings" },
  ];

  return (
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

      <button className="logout_btn">
        <i className="ti-power-off"></i>
        <span>Log out</span>
      </button>
    </aside>
  );
}

export default Sidebar;
