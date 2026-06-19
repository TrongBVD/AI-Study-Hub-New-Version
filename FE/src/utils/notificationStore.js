const NOTIFICATION_SETTINGS_KEY = "aiStudyHubNotificationSettings";
const NOTIFICATIONS_KEY = "aiStudyHubNotifications";

export const defaultNotificationSettings = {
  enabled: true,
  showBadge: true,
  sound: false,
  browserNotification: false,

  discussion: {
    newTopic: true,
    newReply: true,
    solved: true,
  },

  task: {
    assigned: true,
    completed: false,
    deadlineReminder: true,
  },

  file: {
    uploaded: true,
    deleted: true,
    storageWarning: true,
  },

  member: {
    joined: true,
    roleChanged: true,
  },

  deadlineReminder: "1_day_before",

  doNotDisturb: {
    enabled: false,
    from: "22:00",
    to: "07:00",
  },
};

export function getNotificationSettings() {
  try {
    const savedSettings = JSON.parse(
      localStorage.getItem(NOTIFICATION_SETTINGS_KEY) || "{}",
    );

    return {
      ...defaultNotificationSettings,
      ...savedSettings,

      discussion: {
        ...defaultNotificationSettings.discussion,
        ...(savedSettings.discussion || {}),
      },

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

      doNotDisturb: {
        ...defaultNotificationSettings.doNotDisturb,
        ...(savedSettings.doNotDisturb || {}),
      },
    };
  } catch (error) {
    console.error("Cannot read notification settings:", error);
    return defaultNotificationSettings;
  }
}

export function saveNotificationSettings(settings) {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("aiStudyHubNotificationSettingsChanged"));
}

export function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
  } catch (error) {
    console.error("Cannot read notifications:", error);
    return [];
  }
}

export function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
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
    id: `notification-${Date.now()}`,
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

  const nextNotifications = [newNotification, ...getNotifications()].slice(
    0,
    30,
  );

  saveNotifications(nextNotifications);
}

export function markAllNotificationsAsRead() {
  const nextNotifications = getNotifications().map((notification) => ({
    ...notification,
    isRead: true,
  }));

  saveNotifications(nextNotifications);
}