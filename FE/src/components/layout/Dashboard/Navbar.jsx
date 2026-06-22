import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  getNotificationSettings,
  getNotifications,
  markAllNotificationsAsRead,
} from "../../../utils/notificationStore.js";

const PROFILE_AVATAR_KEY = "aiStudyHubProfileAvatar";

function getSavedLibraries() {
  try {
    return JSON.parse(localStorage.getItem("aiStudyHubLibraries") || "[]");
  } catch (error) {
    console.error("Cannot read libraries from localStorage:", error);
    return [];
  }
}

function getSavedWorkspaces() {
  try {
    return JSON.parse(localStorage.getItem("aiStudyHubWorkspaces") || "[]");
  } catch (error) {
    console.error("Cannot read workspaces from localStorage:", error);
    return [];
  }
}

function saveRecentLibrary(library) {
  const currentRecentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

  const recentLibrary = {
    id: library.id,
    name: library.name || library.libraryName || "Untitled Library",
    description: library.description || "",
    documents: Number(library.documents) || 0,
    icon: library.icon || "ti-archive",
    visitedAt: Date.now(),
  };

  const nextRecentLibraries = [
    recentLibrary,
    ...currentRecentLibraries.filter((item) => item.id !== library.id),
  ].slice(0, 2);

  localStorage.setItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(nextRecentLibraries)
  );
}

function saveRecentWorkspace(workspace) {
  const currentRecentWorkspaces = JSON.parse(
    localStorage.getItem("aiStudyHubRecentWorkspaces") || "[]"
  );

  const recentWorkspace = {
    id: workspace.id,
    name: workspace.name || "Untitled Workspace",
    documents: Number(workspace.documents) || 0,
    icon: workspace.icon || "ti-layout-grid2",
    visitedAt: Date.now(),
  };

  const nextRecentWorkspaces = [
    recentWorkspace,
    ...currentRecentWorkspaces.filter((item) => item.id !== workspace.id),
  ].slice(0, 3);

  localStorage.setItem(
    "aiStudyHubRecentWorkspaces",
    JSON.stringify(nextRecentWorkspaces)
  );
}

function Navbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(() => {
    return localStorage.getItem(PROFILE_AVATAR_KEY) || "";
  });

  const [notifications, setNotifications] = useState(() => getNotifications());
  const [notificationSettings, setNotificationSettings] = useState(() =>
    getNotificationSettings()
  );

  useEffect(() => {
    function syncNotifications() {
      setNotifications(getNotifications());
      setNotificationSettings(getNotificationSettings());
    }

    window.addEventListener("aiStudyHubNotificationsChanged", syncNotifications);
    window.addEventListener(
      "aiStudyHubNotificationSettingsChanged",
      syncNotifications
    );
    window.addEventListener("storage", syncNotifications);

    return () => {
      window.removeEventListener(
        "aiStudyHubNotificationsChanged",
        syncNotifications
      );
      window.removeEventListener(
        "aiStudyHubNotificationSettingsChanged",
        syncNotifications
      );
      window.removeEventListener("storage", syncNotifications);
    };
  }, []);

  useEffect(() => {
    function syncProfileAvatar() {
      setProfileAvatar(localStorage.getItem(PROFILE_AVATAR_KEY) || "");
    }

    window.addEventListener("aiStudyHubProfileAvatarChanged", syncProfileAvatar);
    window.addEventListener("storage", syncProfileAvatar);

    return () => {
      window.removeEventListener(
        "aiStudyHubProfileAvatarChanged",
        syncProfileAvatar
      );
      window.removeEventListener("storage", syncProfileAvatar);
    };
  }, []);

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const libraries = getSavedLibraries();
  const workspaces = getSavedWorkspaces();

  const searchResults = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();

    if (keyword === "") {
      return [];
    }

    const matchedLibraries = libraries
      .filter((library) => {
        const libraryName = library.name || library.libraryName || "";
        const libraryDescription = library.description || "";

        return (
          libraryName.toLowerCase().includes(keyword) ||
          libraryDescription.toLowerCase().includes(keyword)
        );
      })
      .map((library) => ({
        id: library.id,
        type: "library",
        title: library.name || library.libraryName || "Untitled Library",
        description: library.description || `${Number(library.documents) || 0} documents`,
        icon: library.icon || "ti-archive",
        data: library,
      }));

    const matchedWorkspaces = workspaces
      .filter((workspace) => {
        const workspaceName = workspace.name || "";
        const workspaceDescription = workspace.description || "";

        return (
          workspaceName.toLowerCase().includes(keyword) ||
          workspaceDescription.toLowerCase().includes(keyword)
        );
      })
      .map((workspace) => ({
        id: workspace.id,
        type: "workspace",
        title: workspace.name || "Untitled Workspace",
        description: workspace.description || `${Number(workspace.documents) || 0} documents`,
        icon: workspace.icon || "ti-layout-grid2",
        data: workspace,
      }));

    return [...matchedLibraries, ...matchedWorkspaces].slice(0, 8);
  }, [searchValue, libraries, workspaces]);

  function handleOpenSearchResult(result) {
    if (result.type === "library") {
      saveRecentLibrary(result.data);
      navigate(`/dashboard/libraries/${result.id}`, {
        state: {
          library: result.data,
          from: window.location.pathname,
        },
      });
    }

    if (result.type === "workspace") {
      saveRecentWorkspace(result.data);
      navigate(`/dashboard/workspaces/${result.id}`, {
        state: {
          workspace: result.data,
          from: window.location.pathname,
        },
      });
    }

    setSearchValue("");
    setIsSearchFocused(false);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();

    if (searchResults.length === 0) return;

    handleOpenSearchResult(searchResults[0]);
  }

  const shouldShowSearchPanel = isSearchFocused && searchValue.trim() !== "";

  return (
    <header className="top_navbar">
      <div className="nav_left">
        <button className="menu_btn" onClick={onOpenSidebar}>
          ☰
        </button>
      </div>

      <form className="search_box" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchValue}
          placeholder="Search your library or workspace..."
          onChange={(e) => setSearchValue(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
        />

        {shouldShowSearchPanel && (
          <div className="global_search_panel">
            {searchResults.length === 0 ? (
              <div className="global_search_empty">
                <i className="ti-search"></i>
                <p>No library or workspace found.</p>
              </div>
            ) : (
              searchResults.map((result) => (
                <button
                  type="button"
                  className="global_search_item"
                  key={`${result.type}-${result.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleOpenSearchResult(result)}
                >
                  <div className="global_search_icon">
                    <i className={result.icon}></i>
                  </div>

                  <div>
                    <strong>{result.title}</strong>
                    <p>{result.description}</p>
                  </div>

                  <span>{result.type}</span>
                </button>
              ))
            )}
          </div>
        )}
      </form>

      <div className="nav_actions">
        <div className="create_dropdown">
          <button type="button" className="create_dropdown_btn">
            <i className="ti-plus"></i>
          </button>

          <div className="create_dropdown_menu">
            <Link to="/dashboard/create-library">
              <i className="ti-folder"></i>
              Create library
            </Link>

            <Link to="/dashboard/create-workspace">
              <i className="ti-layout-grid2"></i>
              Create workspace
            </Link>
          </div>
        </div>

        <div className="notification_dropdown">
          <button type="button" className="notification_btn">
            <i className="ti-bell"></i>
            {notificationSettings.showBadge && unreadNotificationCount > 0 && (
              <span className="notification_badge">{unreadNotificationCount}</span>
            )}
          </button>

          <div className="notification_panel">
            <div className="notification_header">
              <div>
                <strong>Notifications</strong>
                <p>Recent workspace activity</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  markAllNotificationsAsRead();
                  setNotifications(getNotifications());
                }}
              >
                Mark all read
              </button>
            </div>

            <div className="notification_list">
              {!notificationSettings.enabled ? (
                <div className="notification_empty">
                  <i className="ti-bell"></i>
                  <p>Notifications are turned off.</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification_empty">
                  <i className="ti-bell"></i>
                  <p>No notifications yet.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={`notification_item ${
                      notification.isRead ? "" : "unread"
                    }`}
                    onClick={() => {
                      if (notification.link) {
                        navigate(notification.link);
                      }
                    }}
                  >
                    <div className="notification_icon">
                      <i className={notification.icon}></i>
                    </div>

                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <span>{notification.createdAt}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <button type="button" className="notification_view_all">
              View all notifications
            </button>
          </div>
        </div>

        <Link
          to="/dashboard/profile"
          className="profile_avatar"
          aria-label="Go to personal profile"
          style={
            profileAvatar
              ? { backgroundImage: `url(${profileAvatar})` }
              : undefined
          }
        />
      </div>
    </header>
  );
}

export default Navbar;