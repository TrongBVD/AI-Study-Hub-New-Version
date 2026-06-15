import { useState } from "react";
import "./SettingPage.css";

function SettingPage() {
  const [workspaceName, setWorkspaceName] = useState("AI Student Hub");
  const [customBranding, setCustomBranding] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#b4531a");
  const [activeSetting, setActiveSetting] = useState("General");

  const [notificationSettings, setNotificationSettings] = useState({
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
  });

  const settingMenus = [
    {
      title: "Admin",
      items: [
        { icon: "ti-settings", label: "General" },
        { icon: "ti-user", label: "People" },
        { icon: "ti-id-badge", label: "Teams" },
        { icon: "ti-upload", label: "Upgrade" },
        { icon: "ti-shield", label: "Security & Permissions" },
        { icon: "ti-notepad", label: "Audit Logs" },
        { icon: "ti-trash", label: "Trash" },
      ],
    },
    {
      title: "Features",
      items: [
        { icon: "ti-pencil-alt", label: "Custom Field Manager" },
        { icon: "ti-tag", label: "Tag Manager" },
        { icon: "ti-layout", label: "Template Center" },
        { icon: "ti-bolt", label: "Automations Manager" },
        { icon: "ti-calendar", label: "Work Schedule" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: "ti-bell", label: "Notification Settings" },
        { icon: "ti-email", label: "Email Alerts" },
        { icon: "ti-time", label: "Do Not Disturb" },
      ],
    },
  ];

  const colorOptions = [
    "#4b5563",
    "#8b5cf6",
    "#0ea5e9",
    "#ec4899",
    "#a855f7",
    "#6366f1",
    "#b4531a",
    "#0f9f9a",
    "#a78b72",
    "#10b981",
  ];

  function toggleNotificationSetting(key) {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleNotificationCategory(category, key) {
    setNotificationSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key],
      },
    }));
  }

  function updateDoNotDisturb(key, value) {
    setNotificationSettings((prev) => ({
      ...prev,
      doNotDisturb: {
        ...prev.doNotDisturb,
        [key]: value,
      },
    }));
  }

  return (
    <main className="settings_page">
      <aside className="settings_sidebar">
        <div className="settings_sidebar_header">
          <h2>All settings</h2>
          <p>Manage workspace, account, and notification preferences.</p>
        </div>

        <div className="settings_menu_groups">
          {settingMenus.map((group) => (
            <section className="settings_menu_group" key={group.title}>
              <h3>{group.title}</h3>

              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  className={activeSetting === item.label ? "active" : ""}
                  onClick={() => setActiveSetting(item.label)}
                >
                  <i className={item.icon}></i>
                  {item.label}
                </button>
              ))}
            </section>
          ))}
        </div>

        <button type="button" className="settings_logout_btn">
          <i className="ti-power-off"></i>
          Log out
        </button>
      </aside>

      <section className="settings_content">
        {activeSetting === "General" && (
          <>
            <header className="settings_page_header">
              <span>Workspace settings</span>
              <h1>Workspace Settings</h1>
              <p>
                Update workspace profile, branding, permissions, and
                notification preferences.
              </p>
            </header>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <h2>General</h2>
                <p>Basic information about your current workspace.</p>
              </div>

              <div className="settings_table">
                <div className="settings_table_row">
                  <div>
                    <strong>Avatar</strong>
                    <p>Your workspace avatar displayed across the app.</p>
                  </div>

                  <div className="settings_avatar">
                    {workspaceName.slice(0, 1).toUpperCase()}
                  </div>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Name</strong>
                    <p>This is the display name for your workspace.</p>
                  </div>

                  <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <div>
                  <h2>Custom branding</h2>
                  <span>Enterprise</span>
                </div>
                <p>Customize how your workspace appears to members.</p>
              </div>

              <div className="settings_table">
                <div className="settings_table_row">
                  <div>
                    <strong>Enable custom branding</strong>
                    <p>
                      Turn on custom logos, color schemes, and public branding.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${customBranding ? "on" : ""}`}
                    onClick={() => setCustomBranding(!customBranding)}
                  >
                    <span></span>
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Round logo</strong>
                    <p>
                      We recommend a 72 × 72 px PNG file. This logo is used as
                      your workspace avatar.
                    </p>
                  </div>

                  <button type="button" className="settings_add_btn">
                    Add
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Rectangle logo</strong>
                    <p>
                      We recommend a 232 × 48 px PNG file. This logo appears on
                      public links and shared pages.
                    </p>
                  </div>

                  <button type="button" className="settings_add_btn">
                    Add
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Social media graphic</strong>
                    <p>
                      This graphic appears as the preview image when workspace
                      links are shared.
                    </p>
                  </div>

                  <button type="button" className="settings_add_btn">
                    Add
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Color scheme</strong>
                    <p>Choose the main accent color for your workspace UI.</p>
                  </div>

                  <div className="settings_color_list">
                    {colorOptions.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={selectedColor === color ? "active" : ""}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                        aria-label={`Choose ${color}`}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeSetting === "Notification Settings" && (
          <>
            <header className="settings_page_header">
              <span>Notification preferences</span>
              <h1>Notification Settings</h1>
              <p>
                Control which updates you receive from discussions, tasks,
                files, members, and system events.
              </p>
            </header>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <h2>General notifications</h2>
                <p>Basic notification behavior across your workspace.</p>
              </div>

              <div className="settings_table">
                <div className="settings_table_row">
                  <div>
                    <strong>Enable notifications</strong>
                    <p>
                      Allow the app to create notifications for important
                      activity.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${
                      notificationSettings.enabled ? "on" : ""
                    }`}
                    onClick={() => toggleNotificationSetting("enabled")}
                  >
                    <span></span>
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Show unread badge</strong>
                    <p>
                      Display unread notification count on the bell icon.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${
                      notificationSettings.showBadge ? "on" : ""
                    }`}
                    onClick={() => toggleNotificationSetting("showBadge")}
                  >
                    <span></span>
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Play notification sound</strong>
                    <p>
                      Play a short sound when a new notification arrives.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${
                      notificationSettings.sound ? "on" : ""
                    }`}
                    onClick={() => toggleNotificationSetting("sound")}
                  >
                    <span></span>
                  </button>
                </div>

                <div className="settings_table_row">
                  <div>
                    <strong>Browser notification</strong>
                    <p>
                      Allow desktop browser notifications when supported.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${
                      notificationSettings.browserNotification ? "on" : ""
                    }`}
                    onClick={() =>
                      toggleNotificationSetting("browserNotification")
                    }
                  >
                    <span></span>
                  </button>
                </div>
              </div>
            </section>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <h2>Notification categories</h2>
                <p>Choose which kinds of activity should notify you.</p>
              </div>

              <div className="notification_category_grid">
                <article className="notification_category_card">
                  <div className="notification_category_header">
                    <i className="ti-comments"></i>
                    <div>
                      <h3>Discussion</h3>
                      <p>Topics, replies, and solved discussions.</p>
                    </div>
                  </div>

                  <label>
                    <span>New topic</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.discussion.newTopic}
                      onChange={() =>
                        toggleNotificationCategory("discussion", "newTopic")
                      }
                    />
                  </label>

                  <label>
                    <span>New reply</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.discussion.newReply}
                      onChange={() =>
                        toggleNotificationCategory("discussion", "newReply")
                      }
                    />
                  </label>

                  <label>
                    <span>Topic solved</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.discussion.solved}
                      onChange={() =>
                        toggleNotificationCategory("discussion", "solved")
                      }
                    />
                  </label>
                </article>

                <article className="notification_category_card">
                  <div className="notification_category_header">
                    <i className="ti-check-box"></i>
                    <div>
                      <h3>Task</h3>
                      <p>Subtasks, assignments, and deadlines.</p>
                    </div>
                  </div>

                  <label>
                    <span>Assigned to me</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.task.assigned}
                      onChange={() =>
                        toggleNotificationCategory("task", "assigned")
                      }
                    />
                  </label>

                  <label>
                    <span>Task completed</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.task.completed}
                      onChange={() =>
                        toggleNotificationCategory("task", "completed")
                      }
                    />
                  </label>

                  <label>
                    <span>Deadline reminder</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.task.deadlineReminder}
                      onChange={() =>
                        toggleNotificationCategory(
                          "task",
                          "deadlineReminder",
                        )
                      }
                    />
                  </label>
                </article>

                <article className="notification_category_card">
                  <div className="notification_category_header">
                    <i className="ti-folder"></i>
                    <div>
                      <h3>File</h3>
                      <p>Uploaded files, deleted files, and storage alerts.</p>
                    </div>
                  </div>

                  <label>
                    <span>File uploaded</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.file.uploaded}
                      onChange={() =>
                        toggleNotificationCategory("file", "uploaded")
                      }
                    />
                  </label>

                  <label>
                    <span>File deleted</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.file.deleted}
                      onChange={() =>
                        toggleNotificationCategory("file", "deleted")
                      }
                    />
                  </label>

                  <label>
                    <span>Storage warning</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.file.storageWarning}
                      onChange={() =>
                        toggleNotificationCategory("file", "storageWarning")
                      }
                    />
                  </label>
                </article>

                <article className="notification_category_card">
                  <div className="notification_category_header">
                    <i className="ti-user"></i>
                    <div>
                      <h3>Member</h3>
                      <p>Member joins, removals, and role changes.</p>
                    </div>
                  </div>

                  <label>
                    <span>New member joined</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.member.joined}
                      onChange={() =>
                        toggleNotificationCategory("member", "joined")
                      }
                    />
                  </label>

                  <label>
                    <span>Role changed</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.member.roleChanged}
                      onChange={() =>
                        toggleNotificationCategory("member", "roleChanged")
                      }
                    />
                  </label>
                </article>
              </div>
            </section>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <h2>Reminder schedule</h2>
                <p>
                  Decide when task and subtask deadlines should remind you.
                </p>
              </div>

              <div className="settings_table">
                <div className="settings_table_row">
                  <div>
                    <strong>Deadline reminder</strong>
                    <p>Default reminder time before a task deadline.</p>
                  </div>

                  <select
                    className="settings_select"
                    value={notificationSettings.deadlineReminder}
                    onChange={(e) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        deadlineReminder: e.target.value,
                      }))
                    }
                  >
                    <option value="none">No reminder</option>
                    <option value="at_due_time">At due time</option>
                    <option value="10_minutes_before">
                      10 minutes before
                    </option>
                    <option value="1_hour_before">1 hour before</option>
                    <option value="1_day_before">1 day before</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="settings_panel">
              <div className="settings_panel_title">
                <h2>Do not disturb</h2>
                <p>Pause notification sound and popup during quiet hours.</p>
              </div>

              <div className="settings_table">
                <div className="settings_table_row">
                  <div>
                    <strong>Enable do not disturb</strong>
                    <p>
                      Notifications will still be saved, but they will not
                      disturb you.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`settings_switch ${
                      notificationSettings.doNotDisturb.enabled ? "on" : ""
                    }`}
                    onClick={() =>
                      updateDoNotDisturb(
                        "enabled",
                        !notificationSettings.doNotDisturb.enabled,
                      )
                    }
                  >
                    <span></span>
                  </button>
                </div>

                {notificationSettings.doNotDisturb.enabled && (
                  <div className="settings_table_row">
                    <div>
                      <strong>Quiet hours</strong>
                      <p>
                        Choose the time range when notifications should be
                        silent.
                      </p>
                    </div>

                    <div className="settings_time_range">
                      <input
                        type="time"
                        value={notificationSettings.doNotDisturb.from}
                        onChange={(e) =>
                          updateDoNotDisturb("from", e.target.value)
                        }
                      />

                      <span>to</span>

                      <input
                        type="time"
                        value={notificationSettings.doNotDisturb.to}
                        onChange={(e) =>
                          updateDoNotDisturb("to", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeSetting !== "General" &&
          activeSetting !== "Notification Settings" && (
            <header className="settings_page_header">
              <span>Coming soon</span>
              <h1>{activeSetting}</h1>
              <p>This settings section will be available later.</p>
            </header>
          )}
      </section>
    </main>
  );
}

export default SettingPage;