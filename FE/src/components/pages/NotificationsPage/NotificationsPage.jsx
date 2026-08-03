import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotificationSettings,
  getNotifications,
  markAllNotificationsAsRead,
  saveNotifications,
  mergeAppNotifications,
} from "../../../utils/notificationStore.js";
import { getMyWorkspaceNotifications, respondToInvitation } from "../../../utils/workspaceApi.js";
import { WorkspaceInviteModal } from "../../layout/Dashboard/WorkspaceInviteModal.jsx";
import "./NotificationsPage.css";

const FILTERS = ["All", "Unread", "Read"];

function getTimestamp(notification) {
  if (notification.createdAtMs) {
    return new Date(notification.createdAtMs).toLocaleString();
  }
  return notification.createdAt || "Recently";
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(getNotifications);
  const [selectedInviteNotification, setSelectedInviteNotification] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const notificationSettings = getNotificationSettings();

  useEffect(() => {
    function syncNotifications() {
      setNotifications(getNotifications());
    }

    window.addEventListener("aiStudyHubNotificationsChanged", syncNotifications);
    window.addEventListener("storage", syncNotifications);
    return () => {
      window.removeEventListener("aiStudyHubNotificationsChanged", syncNotifications);
      window.removeEventListener("storage", syncNotifications);
    };
  }, []);

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

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const visibleNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Unread" && !notification.isRead) ||
        (activeFilter === "Read" && notification.isRead);
      const matchesQuery =
        !normalizedQuery ||
        [notification.title, notification.message, notification.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, notifications, query]);

  function markAllRead() {
    markAllNotificationsAsRead();
    setNotifications(getNotifications());
  }

  function openNotification(notification) {
    if (!notification.isRead) {
      const updatedNotifications = notifications.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      );
      saveNotifications(updatedNotifications);
      setNotifications(updatedNotifications);
    }

    if (notification.isInvitation) {
      setSelectedInviteNotification(notification);
    } else if (notification.link) {
      navigate(notification.link);
    }
  }

  return (
    <main className="all-notifications-page">
      <div className="all-notifications-page__container">
        <header className="all-notifications-page__header">
          <div>
            <span>Activity center</span>
            <h1>Notifications</h1>
            <p>Review every workspace and library update you have received.</p>
          </div>
          <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
            <i className="ti-check-box" /> Mark all as read
          </button>
        </header>

        <section className="all-notifications-page__summary">
          <article><span>Total notifications</span><strong>{notifications.length}</strong></article>
          <article><span>Unread</span><strong>{unreadCount}</strong></article>
          <article><span>Read</span><strong>{notifications.length - unreadCount}</strong></article>
        </section>

        <section className="all-notifications-page__card">
          <div className="all-notifications-page__toolbar">
            <div className="all-notifications-page__filters">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={activeFilter === filter ? "active" : ""}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <label className="all-notifications-page__search">
              <i className="ti-search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications..." />
            </label>
          </div>

          {!notificationSettings.enabled ? (
            <div className="all-notifications-page__empty">
              <i className="ti-bell" />
              <h2>Notifications are turned off</h2>
              <p>You can enable them again from Notification settings.</p>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="all-notifications-page__empty">
              <i className="ti-bell" />
              <h2>No notifications found</h2>
              <p>There are no notifications matching the selected filter.</p>
            </div>
          ) : (
            <div className="all-notifications-page__list">
              {visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification_page_item ${notification.isRead ? "" : "unread"}`}
                  onClick={() => openNotification(notification)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="all-notifications-page__icon"><i className={notification.icon || "ti-bell"} /></span>
                  <span className="all-notifications-page__copy">
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{getTimestamp(notification)}</small>
                    {notification.isInvitation && (
                      <div className="notification_invite_actions" onClick={(e) => e.stopPropagation()}>
                        {notification.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              className="invite_btn_sm reject"
                              onClick={() => handleRespondInvite(notification.logId, "reject")}
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              className="invite_btn_sm accept"
                              onClick={() => handleRespondInvite(notification.logId, "accept")}
                            >
                              Accept
                            </button>
                          </>
                        ) : (
                          <span className={`invite_status_tag ${notification.status ? notification.status.toLowerCase() : ""}`}>
                            {notification.status === "ACCEPTED" ? "Accepted" : "Declined"}
                          </span>
                        )}
                      </div>
                    )}
                  </span>
                  {!notification.isRead && <i className="all-notifications-page__unread-dot" aria-label="Unread" />}
                  {notification.link && <i className="ti-angle-right all-notifications-page__arrow" />}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedInviteNotification && (
        <WorkspaceInviteModal
          invitation={selectedInviteNotification}
          onClose={() => setSelectedInviteNotification(null)}
          onRespond={handleRespondInvite}
        />
      )}
    </main>
  );
}

export default NotificationsPage;
