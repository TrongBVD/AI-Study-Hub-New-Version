import { NavLink, useNavigate } from "react-router-dom";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineBookOpen,
  HiOutlineAcademicCap,
  HiOutlineSquares2X2,
  HiOutlineQuestionMarkCircle,
  HiOutlineCog6Tooth,
  HiOutlineArrowRightOnRectangle,
  HiOutlineXMark,
} from "react-icons/hi2";
import Logo from "../../../assets/logo/Logo.jsx";
import api from "../../../utils/api.js";
import { clearStoredSession, getStoredUser } from "../../../utils/authToken.js";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

/**
 * Helper function to retrieve the stored user's system role
 */
function getStoredUserRole() {
  try {
    const storedUser = getStoredUser();
    return String(storedUser?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Sidebar Component: Provides navigation menu for AI Study Hub
 * Designed in 100% English UI matching NotebookLM aesthetics
 * Uses react-icons/hi2 for 100% stable icon compatibility
 */
function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const userRole = getStoredUserRole();
  const isGuest = userRole === "GUEST";

  // Sidebar navigation menu items
  const menuItems = [
    {
      icon: HiOutlineMagnifyingGlass,
      label: "Discover",
      path: "/dashboard/discover",
    },
    {
      icon: HiOutlineBookOpen,
      label: "Libraries",
      path: "/dashboard/libraries",
      hideForGuest: true,
    },
    {
      icon: HiOutlineAcademicCap,
      label: "Flashcards",
      path: "/dashboard/flashcards",
      hideForGuest: true,
    },
    {
      icon: HiOutlineSquares2X2,
      label: "My Workspaces",
      path: "/dashboard/workspaces",
      hideForGuest: true,
    },
    {
      icon: HiOutlineQuestionMarkCircle,
      label: "Report Issues",
      path: "/dashboard/report-issue",
      hideForGuest: true,
    },
    {
      icon: HiOutlineCog6Tooth,
      label: "Settings",
      path: "/dashboard/settings",
    },
  ];

  // Filter visible items for guest users
  const visibleMenuItems = isGuest
    ? menuItems.filter((item) => ["Discover", "Settings"].includes(item.label))
    : menuItems;

  /**
   * Handles user sign-out and clears local authentication session
   */
  async function handleLogout() {
    try {
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
            {/* App Brand Logo */}
            <Logo />

            <button
              type="button"
              className="close_btn"
              aria-label="Close sidebar"
              onClick={onClose}
            >
              <HiOutlineXMark aria-hidden="true" />
            </button>
          </div>

          <nav className="sidebar_nav">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar_link ${isActive ? "active" : ""}`
                  }
                  key={item.label}
                  onClick={onClose}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar_bottom_actions">
          <button type="button" className="logout_btn" onClick={handleLogout}>
            <HiOutlineArrowRightOnRectangle aria-hidden="true" />
            <span>{isGuest ? "Return to Log In" : "Sign Out"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
