import { getUserStoredItem, setUserStoredItem } from "./userStorage.js";

const NOTIFICATION_SETTINGS_KEY = "aiStudyHubNotificationSettings";
const NOTIFICATIONS_KEY = "aiStudyHubNotifications";

export const defaultNotificationSettings = {
  enabled: true,
  showBadge: true,
  sound: false,

  task: {
    assigned: true,
    completed: false,
    deadlineReminder: true,
  },

  file: {
    uploaded: true,
    deleted: true,
  },

  member: {
    joined: true,
    roleChanged: true,
  },

  workspace: {
    renamed: true,
    deleted: true,
  },

  doNotDisturb: {
    enabled: false,
    from: "22:00",
    to: "07:00",
  },
};

export function getNotificationSettings() {
  try {
    const savedSettings = JSON.parse(
      getUserStoredItem(NOTIFICATION_SETTINGS_KEY) || "{}",
    );

    const mergedSettings = {
      ...defaultNotificationSettings,
      ...savedSettings,

      task: {
        ...defaultNotificationSettings.task,
        ...(savedSettings.task || {}),
      },

      file: {
        ...defaultNotificationSettings.file,
        ...(savedSettings.file || {}),
      },

      member: {
        ...defaultNotificationSettings.member,
        ...(savedSettings.member || {}),
      },

      workspace: {
        ...defaultNotificationSettings.workspace,
        ...(savedSettings.workspace || {}),
      },

      doNotDisturb: {
        ...defaultNotificationSettings.doNotDisturb,
        ...(savedSettings.doNotDisturb || {}),
      },
    };

    // Notifications no longer require a user-facing configuration screen.
    // Keep every supported feed category enabled, including for accounts that
    // previously saved disabled preferences.
    return {
      ...mergedSettings,
      enabled: true,
      showBadge: true,
      file: { ...mergedSettings.file, uploaded: true, deleted: true },
      member: { ...mergedSettings.member, joined: true, roleChanged: true },
      workspace: { ...mergedSettings.workspace, renamed: true, deleted: true },
    };
  } catch (error) {
    console.error("Cannot read notification settings:", error);
    return defaultNotificationSettings;
  }
}

export function saveNotificationSettings(settings) {
  setUserStoredItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));

  // Remove notifications that are no longer allowed so the bell updates
  // immediately when a category checkbox is turned off.
  const visibleNotifications = filterNotificationsBySettings(
    getNotifications(),
    settings,
  );
  setUserStoredItem(NOTIFICATIONS_KEY, JSON.stringify(visibleNotifications));
  window.dispatchEvent(new Event("aiStudyHubNotificationSettingsChanged"));
}

export function getNotifications() {
  try {
    return JSON.parse(getUserStoredItem(NOTIFICATIONS_KEY) || "[]");
  } catch (error) {
    console.error("Cannot read notifications:", error);
    return [];
  }
}

export function saveNotifications(notifications) {
  setUserStoredItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new Event("aiStudyHubNotificationsChanged"));
}

export function createAppNotification({
  category,
  action,
  title,
  message,
  icon = "ti-bell",
  link = "",
}) {
  const settings = getNotificationSettings();

  if (!settings.enabled) return;

  if (!settings[category]?.[action]) return;

  const newNotification = {
    id: `notification-${
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }`,
    category,
    action,
    title,
    message,
    icon,
    link,
    isRead: false,
    createdAt: "Just now",
    createdAtMs: Date.now(),
  };

  const nextNotifications = [newNotification, ...getNotifications()];

  saveNotifications(nextNotifications);
}

export function markAllNotificationsAsRead() {
  const nextNotifications = getNotifications().map((notification) => ({
    ...notification,
    isRead: true,
  }));

  saveNotifications(nextNotifications);
}

export function filterNotificationsBySettings(
  notifications = [],
  settings = getNotificationSettings(),
) {
  if (!Array.isArray(notifications)) return [];

  return notifications.filter((notification) => {
    const categorySettings = settings?.[notification?.category];

    // Invitations and system notification types without a user-facing
    // category toggle remain visible.
    if (!categorySettings || typeof categorySettings !== "object") return true;

    const actionSetting = categorySettings[notification?.action];
    return typeof actionSetting === "boolean" ? actionSetting : true;
  });
}

export function mergeAppNotifications(incomingNotifications = []) {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("aiStudyHubPendingInvitations")) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error("Could not clean legacy localStorage keys:", err);
  }

  const settings = getNotificationSettings();
  if (!settings.enabled) return [];

  if (Array.isArray(incomingNotifications)) {
    const visibleNotifications = filterNotificationsBySettings(
      incomingNotifications,
      settings,
    );
    saveNotifications(visibleNotifications);
    return visibleNotifications;
  }

  return filterNotificationsBySettings(getNotifications(), settings);
}
