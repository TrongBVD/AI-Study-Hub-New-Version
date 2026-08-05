import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineBell,
  HiOutlineBars3,
} from "react-icons/hi2";
import {
  getNotificationSettings,
  getNotifications,
  markAllNotificationsAsRead,
  mergeAppNotifications,
} from "../../../utils/notificationStore.js";
import { searchUsers } from "../../../utils/searchApi.js";
import { getMyLibraries } from "../../../utils/documentApi.js";
import { getMyWorkspaceNotifications, getWorkspaces, markWorkspaceNotificationsAsReadApi, respondToInvitation } from "../../../utils/workspaceApi.js";
import { getMyProfile } from "../../../utils/profileApi.js";
import { getPublicLibraries } from "../../../utils/publicApi.js";
import defaultAvatar from "../../../assets/images/account.png";
import { getStoredUser } from "../../../utils/authToken.js";
import { getUserStoredItem, setUserStoredItem } from "../../../utils/userStorage.js";
import { WorkspaceInviteModal } from "./WorkspaceInviteModal.jsx";

/**
 * Gets the current stored user's system role
 */
function getStoredUserRole() {
  try {
    const user = getStoredUser();
    return String(user?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Helper to combine public and personal libraries
 */
function mergeLibraries(publicLibraries = [], myLibraries = []) {
  const librariesById = new Map();

  publicLibraries.forEach((library) => {
    if (library?.id) librariesById.set(String(library.id), library);
  });

  myLibraries.forEach((library) => {
    if (!library?.id) return;
    const key = String(library.id);
    librariesById.set(key, { ...librariesById.get(key), ...library });
  });

  return [...librariesById.values()];
}

/**
 * Normalizes notification strings
 */
function getNotificationMessage(message) {
  return String(message || "").replace(/\bViewer\b/gi, "Contributor");
}

/**
 * Saves library visit history
 */
function saveRecentLibrary(library) {
  const currentRecentLibraries = JSON.parse(
    getUserStoredItem("aiStudyHubRecentLibraries") || "[]"
  );

  const recentLibrary = {
    id: library.id,
    name: library.name || library.libraryName || "Untitled Library",
    description: library.description || "",
    documents: Number(library.documents) || 0,
    icon: library.icon || "ti-book",
    visitedAt: Date.now(),
  };

  const nextRecentLibraries = [
    recentLibrary,
    ...currentRecentLibraries.filter((item) => item.id !== library.id),
  ].slice(0, 2);

  setUserStoredItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(nextRecentLibraries)
  );
}

/**
 * Saves workspace visit history
 */
function saveRecentWorkspace(workspace) {
  const currentRecentWorkspaces = JSON.parse(
    getUserStoredItem("aiStudyHubRecentWorkspaces") || "[]"
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

  setUserStoredItem(
    "aiStudyHubRecentWorkspaces",
    JSON.stringify(nextRecentWorkspaces)
  );
}

/**
 * Navbar Component: Sleek Top Navigation Bar for AI Study Hub
 * Fully localized in 100% English
 * Uses react-icons/hi2 for 100% stable icon compatibility
 */
function Navbar({
  onOpenSidebar,
  profilePath = "/dashboard/profile",
  searchPlaceholder = "Search library or workspace...",
  showSearch = true,
}) {
  const navigate = useNavigate();
  const isLoggedIn = !!getStoredUser();
  const isGuest = getStoredUserRole() === "GUEST";
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [profileAvatar, setProfileAvatar] = useState("");

  const [notifications, setNotifications] = useState(() => getNotifications());
  const [selectedInviteNotification, setSelectedInviteNotification] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState(() =>
    getNotificationSettings()
  );

  /**
   * Responds to workspace invitation (Accept/Reject)
   */
  const handleRespondInvite = async (invitationId, action) => {
    try {
      const res = await respondToInvitation(invitationId, action);
      const updatedNotifications = await getMyWorkspaceNotifications();
      setNotifications(mergeAppNotifications(updatedNotifications || []));
      if (res?.action === "ACCEPTED" && res?.workspaceId) {
        navigate(`/dashboard/workspaces/${res.workspaceId}`);
      }
    } catch (err) {
      console.error("Could not respond to invitation:", err);
    }
  };

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
    if (isGuest) return undefined;

    let isMounted = true;
    let isRequestInFlight = false;
    let lastSyncedAt = 0;
    let nextAllowedSyncAt = 0;

    const POLL_INTERVAL_MS = 60 * 1000;
    const FOCUS_REFRESH_STALE_MS = 30 * 1000;

    function getRetryDelayMs(error) {
      const retryAfter = error?.response?.headers?.["retry-after"];
      const retryAfterSeconds = Number(retryAfter);

      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return Math.ceil(retryAfterSeconds * 1000);
      }

      const retryAfterDateMs = Date.parse(retryAfter);
      if (Number.isFinite(retryAfterDateMs)) {
        return Math.max(0, retryAfterDateMs - Date.now());
      }

      return POLL_INTERVAL_MS;
    }

    async function syncServerNotifications() {
      if (
        !isMounted ||
        document.visibilityState !== "visible" ||
        isRequestInFlight ||
        Date.now() < nextAllowedSyncAt
      ) {
        return;
      }

      isRequestInFlight = true;
      try {
        const serverNotifications = await getMyWorkspaceNotifications();
        if (isMounted) {
          setNotifications(mergeAppNotifications(serverNotifications || []));
          lastSyncedAt = Date.now();
        }
      } catch (error) {
        const status = error?.response?.status;

        if (status === 429) {
          nextAllowedSyncAt = Date.now() + getRetryDelayMs(error);
          console.warn("Notification sync is rate-limited; waiting before retrying.");
          return;
        }

        if (status === 401) {
          nextAllowedSyncAt = Number.POSITIVE_INFINITY;
          console.warn("Notification sync stopped because the session is no longer valid.");
          return;
        }

        console.error("Failed to sync workspace notifications:", error);
      } finally {
        isRequestInFlight = false;
      }
    }

    syncServerNotifications();
    const intervalId = window.setInterval(syncServerNotifications, POLL_INTERVAL_MS);
    const handleWindowFocus = () => {
      if (Date.now() - lastSyncedAt >= FOCUS_REFRESH_STALE_MS) {
        syncServerNotifications();
      }
    };
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isGuest, isLoggedIn]);

  useEffect(() => {
    const keyword = searchValue.trim();

    if (keyword.length < 2) {
      return undefined;
    }

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const users = await searchUsers(keyword);
        if (!isCancelled) setMatchedUsers(users || []);
      } catch {
        if (!isCancelled) setMatchedUsers([]);
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchValue]);

  useEffect(() => {
    function syncProfileAvatar(event) {
      setProfileAvatar(event.detail?.avatar || "");
    }

    window.addEventListener("aiStudyHubProfileChanged", syncProfileAvatar);

    return () => {
      window.removeEventListener(
        "aiStudyHubProfileChanged",
        syncProfileAvatar
      );
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || isGuest) return;

    let isMounted = true;

    async function loadProfileAvatar() {
      try {
        const profile = await getMyProfile();
        if (!isMounted) return;

        const nextAvatar = profile?.avatar_url || "";
        setProfileAvatar(nextAvatar);
      } catch (error) {
        console.error("Failed to load profile avatar:", error);
      }
    }

    loadProfileAvatar();

    return () => {
      isMounted = false;
    };
  }, [isGuest, isLoggedIn]);

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const [libraries, setLibraries] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let isMounted = true;

    async function loadSearchData() {
      try {
        if (isGuest) {
          const publicLibraries = await getPublicLibraries();
          if (isMounted) {
            setLibraries(publicLibraries || []);
            setWorkspaces([]);
          }
          return;
        }

        const [publicLibraries, myLibraries, wspaces] = await Promise.all([
          getPublicLibraries(),
          getMyLibraries(),
          getWorkspaces()
        ]);
        if (isMounted) {
          setLibraries(mergeLibraries(publicLibraries, myLibraries));
          setWorkspaces(wspaces || []);
        }
      } catch (err) {
        console.error("Failed to load search data:", err);
      }
    }
    loadSearchData();

    return () => {
      isMounted = false;
    };
  }, [isGuest, isLoggedIn]);

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
        icon: library.icon || "ti-book",
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

    const userResults = (keyword.length >= 2 ? matchedUsers : []).map((user) => ({
      id: user.id,
      type: "user",
      title: user.full_name || user.username || user.email || "Unknown user",
      description: user.username ? `@${user.username}` : user.email,
      icon: "ti-user",
      data: user,
    }));

    return [...userResults, ...matchedLibraries, ...matchedWorkspaces].slice(
      0,
      8,
    );
  }, [searchValue, libraries, workspaces, matchedUsers]);

  function handleOpenSearchResult(result) {
    if (result.type === "library") {
      if (!isGuest) {
        saveRecentLibrary(result.data);
      }

      navigate(`/dashboard/libraries/${result.id}`, {
        state: {
          library: isGuest
            ? { ...result.data, isPublicView: true, visibility: "public" }
            : result.data,
          from: window.location.pathname,
        },
      });
    }

    if (result.type === "workspace" && !isGuest) {
      saveRecentWorkspace(result.data);
      navigate(`/dashboard/workspaces/${result.id}`, {
        state: {
          workspace: result.data,
          from: window.location.pathname,
        },
      });
    }

    if (result.type === "user") {
      navigate(`/dashboard/profile/${result.id}`);
    }

    setSearchValue("");
    setIsSearchFocused(false);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();

    const keyword = searchValue.trim();
    if (!keyword) return;

    navigate(`/dashboard/search?q=${encodeURIComponent(keyword)}`);
    setIsSearchFocused(false);
  }

  const shouldShowSearchPanel = isSearchFocused && searchValue.trim() !== "";
  const avatarImage = profileAvatar || defaultAvatar;

  return (
    <header className="top_navbar">
      <div className="nav_left">
        <button
          type="button"
          className="menu_btn"
          aria-label="Open sidebar"
          onClick={onOpenSidebar}
        >
          <HiOutlineBars3 aria-hidden="true" />
        </button>
      </div>

      {showSearch && (
        <form className="search_box" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={(e) => setSearchValue(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />

        {shouldShowSearchPanel && (
          <div className="global_search_panel">
            {searchResults.length === 0 ? (
              <div className="global_search_empty">
                <i className="ti-search"></i>
                <p>No users, libraries, or workspaces found.</p>
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
            <button
              type="submit"
              className="global_search_view_all"
              onMouseDown={(e) => e.preventDefault()}
            >
              <i className="ti-search" />
              View all results for “{searchValue.trim()}”
            </button>
          </div>
        )}
        </form>
      )}

      {/* Navbar Actions & Profile */}
      <div className="nav_actions">
        {isGuest ? (
          <div className="guest_auth_actions">
            <Link to="/login" className="guest_auth_link">
              Log in
            </Link>
            <Link to="/register" className="guest_auth_link primary">
              Sign up
            </Link>
          </div>
        ) : (
          <>
            {/* Notification Panel */}
            <div className="notification_dropdown">
              <button type="button" className="notification_btn" aria-label="Notifications">
                <HiOutlineBell aria-hidden="true" />
                {notificationSettings.showBadge && unreadNotificationCount > 0 && (
                  <span className="notification_badge">{unreadNotificationCount}</span>
                )}
              </button>

              <div className="notification_panel">
                <div className="notification_header">
                  <div>
                    <strong>Notifications</strong>
                    <p>Recent activity updates</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await markWorkspaceNotificationsAsReadApi();
                      } catch (err) {
                        console.error("Failed to mark notifications read:", err);
                      }
                      markAllNotificationsAsRead();
                      try {
                        const updated = await getMyWorkspaceNotifications();
                        setNotifications(mergeAppNotifications(updated || []));
                      } catch {
                        setNotifications(getNotifications());
                      }
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
                      <div
                        key={notification.id}
                        className={`notification_item ${notification.isRead ? "" : "unread"}`}
                        onClick={() => {
                          if (notification.isInvitation) {
                            setSelectedInviteNotification(notification);
                          } else if (notification.link) {
                            navigate(notification.link);
                          }
                        }}
                      >
                        <div className="notification_icon">
                          <i className={notification.icon || "ti-bell"}></i>
                        </div>

                        <div>
                          <strong>{notification.title}</strong>
                          <p>{getNotificationMessage(notification.message)}</p>
                          <span>{notification.createdAt}</span>

                          {notification.isInvitation && (
                            <div
                              className="notification_invite_actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {notification.status === "PENDING" ? (
                                <>
                                  <button
                                    type="button"
                                    className="invite_btn_sm reject"
                                    onClick={() =>
                                      handleRespondInvite(notification.logId, "reject")
                                    }
                                  >
                                    Decline
                                  </button>
                                  <button
                                    type="button"
                                    className="invite_btn_sm accept"
                                    onClick={() =>
                                      handleRespondInvite(notification.logId, "accept")
                                    }
                                  >
                                    Accept
                                  </button>
                                </>
                              ) : (
                                <span
                                  className={`invite_status_tag ${
                                    notification.status
                                      ? notification.status.toLowerCase()
                                      : ""
                                  }`}
                                >
                                  {notification.status === "ACCEPTED"
                                    ? "Accepted"
                                    : "Declined"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

            {selectedInviteNotification && (
              <WorkspaceInviteModal
                invitation={selectedInviteNotification}
                onClose={() => setSelectedInviteNotification(null)}
                onRespond={handleRespondInvite}
              />
            )}
          </>
        )}

        {!isGuest && (
          <Link
            to={profilePath}
            className="profile_avatar"
            aria-label="Go to personal profile"
            style={{ backgroundImage: `url(${avatarImage})` }}
          />
        )}
      </div>
    </header>
  );
}

export default Navbar;
