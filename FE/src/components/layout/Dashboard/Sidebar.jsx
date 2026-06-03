import { NavLink } from "react-router-dom";

import Logo from "../../../assets/logo/Logo.jsx";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function Sidebar({ isOpen, onClose }) {
  const menuItems = [
    {
      icon: "ti-home",
      label: "Home",
      path: "/dashboard/home",
      enabled: true,
    },
    {
      icon: "ti-folder",
      label: "My libraries",
      path: "/dashboard/libraries",
      enabled: true,
    },
    {
      icon: "ti-upload",
      label: "Uploads",
      path: "/dashboard/libraries",
      enabled: true,
    },
    {
      icon: "ti-book",
      label: "Subjects",
      path: null,
      enabled: false,
    },
    {
      icon: "ti-comments",
      label: "AI Chat",
      path: "/dashboard/ai-chat",
      enabled: true,
    },
    {
      icon: "ti-settings",
      label: "Settings",
      path: null,
      enabled: false,
    },
  ];

  const topLibraries = [
    "AI-student-hub",
    "JavaScript-notes",
    "Software-engineering",
    "Business-analysis",
    "Final-exam-review",
  ];

  return (
    <aside className={`sidebar ${isOpen ? "sidebar_open" : ""}`}>
      <div className="sidebar_header">
        <Logo />

        <button className="close_btn" type="button" onClick={onClose}>
          ×
        </button>
      </div>

      <nav className="sidebar_nav">
        {menuItems.map((item) => {
          if (!item.enabled) {
            return (
              <button
                type="button"
                className="sidebar_link sidebar_link_disabled"
                key={item.label}
                disabled
              >
                <i className={item.icon}></i>
                <span>{item.label}</span>
              </button>
            );
          }

          return (
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
          );
        })}
      </nav>

      <div className="sidebar_divider" />

      <div className="top_library_header">
        <p>Most accessed libraries</p>
        <button type="button">⌕</button>
      </div>

      <div className="library_shortcut_list">
        {topLibraries.map((library) => (
          <NavLink
            to="/dashboard/libraries"
            className="library_shortcut_item"
            key={library}
            onClick={onClose}
          >
            <i className="ti-archive"></i>
            <span>{library}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;