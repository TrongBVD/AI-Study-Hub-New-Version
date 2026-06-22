import { useEffect, useMemo, useState } from "react";
import { getAdminUsers, updateUserStatus } from "../../../../utils/adminApi";
import "./UserManagementPage.css";
function formatStorage(used, quota) {
  return `${used} / ${quota} GB`;
}

function getStoragePercent(user) {
  if (!user.quota) return 0;
  return Math.min(100, Math.round((user.storageUsed / user.quota) * 100));
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US"
  );
}

function formatDate(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function mapUser(row) {
  const name = row.full_name || row.username || row.email || "Unknown user";
  const status = row.status === "DISABLED" ? "Disabled" : "Active";

  return {
    id: row.id,
    name,
    email: row.email || "",
    role: row.role || "USER",
    status,
    storageUsed: 0,
    quota: 50,
    lastActive: formatDate(row.last_login_at || row.updated_at),
    memberSince: formatDate(row.created_at),
    workspaceAccess: Number(row.workspace_count || 0),
    libraryAccess: Number(row.library_count || 0),
    avatarText: getInitials(name),
    department: row.username ? `@${row.username}` : "No username",
    raw: row,
  };
}

function UserAvatar({ user, large = false }) {
  return user.avatar ? (
    <img
      className={large ? "is-large" : ""}
      src={user.avatar}
      alt={user.name}
    />
  ) : (
    <span className={large ? "is-large" : ""}>{user.avatarText}</span>
  );
}
function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        setIsLoading(true);
        setError("");
        const data = await getAdminUsers();
        const mappedUsers = (data || []).map(mapUser);
        setUsers(mappedUsers);
        setSelectedUserId(mappedUsers[0]?.id || null);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load users.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text =
        `${user.name} ${user.email} ${user.role} ${user.department}`.toLowerCase();
      const matchesSearch = text.includes(query.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "all" || user.status.toLowerCase() === statusFilter;
      const matchesRole =
        roleFilter === "all" || user.role.toLowerCase() === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, query, statusFilter, roleFilter]);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) || null;

  const stats = useMemo(() => {
    const active = users.filter((user) => user.status === "Active").length;
    const disabled = users.filter((user) => user.status === "Disabled").length;
    const highStorage = users.filter(
      (user) => getStoragePercent(user) >= 80
    ).length;

    return {
      active,
      disabled,
      highStorage,
      totalUsers: users.length,
    };
  }, [users]);

  function openConfirmation(type, user) {
    setConfirmAction({ type, user });
  }

  function closeConfirmation() {
    setConfirmAction(null);
  }

  async function applyConfirmedAction() {
    if (!confirmAction) return;

    const { type, user } = confirmAction;

    if (type === "resetQuota") {
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === user.id ? { ...item, storageUsed: 0, quota: 50 } : item,
        ),
      );
      setNotice(`${user.name} quota was reset locally. Backend quota reset is not implemented yet.`);
      closeConfirmation();
      return;
    }

    const nextBackendStatus = type === "disable" ? "DISABLED" : "ACTIVE";

    try {
      const updated = await updateUserStatus(
        user.id,
        nextBackendStatus,
        `${type} from admin user management page.`,
      );

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === user.id ? mapUser({ ...item.raw, ...updated }) : item,
        ),
      );

      const actionText = type === "disable" ? "disabled" : "reactivated";
      setNotice(`${user.name} has been ${actionText}.`);
      closeConfirmation();
    } catch (err) {
      setNotice(err.response?.data?.message || "Could not update user status.");
    }
  }

  function handleInviteUser(event) {
    event.preventDefault();
    const email = inviteEmail.trim();

    if (!email) {
      setNotice("Enter an email before sending an invite.");
      return;
    }

    setInviteEmail("");
    setInviteOpen(false);
    setNotice(`Invite endpoint is not implemented yet. No database record was created for ${email}.`);
  }

  const confirmationContent = {
    disable: {
      title: "Disable user account?",
      message:
        "This user will lose access to libraries, workspaces, and collaboration features until reactivated.",
      button: "Disable account",
    },
    reactivate: {
      title: "Reactivate user account?",
      message:
        "This user will be able to sign in and continue using shared study resources.",
      button: "Reactivate account",
    },
    resetQuota: {
      title: "Reset storage quota?",
      message:
        "This will reset the displayed used storage to 0 GB. A backend quota reset endpoint is still needed for persistence.",
      button: "Reset quota",
    },
  };

  const statCards = [
    {
      label: "Total users",
      value: stats.totalUsers,
      note: "All registered accounts",
      icon: "ti-user",
      tone: "neutral",
    },
    {
      label: "Active",
      value: stats.active,
      note: "Currently active",
      icon: "ti-check",
      tone: "success",
    },
    {
      label: "Disabled",
      value: stats.disabled,
      note: "Disabled accounts",
      icon: "ti-close",
      tone: "danger",
    },
    {
      label: "Storage alerts",
      value: stats.highStorage,
      note: "Above 80% quota",
      icon: "ti-alert",
      tone: "warning",
    },
  ];

  return (
    <section className="user-management-page">
      <main className="user-management-page__shell">
        <header className="user-management-page__page-header">
          <div>
            <span>User administration</span>
            <h1>Users</h1>
            <p>Manage accounts, access, roles and storage.</p>
          </div>

          <div className="user-management-page__header-actions">
            <button type="button" onClick={() => setInviteOpen(true)}>
              <i className="ti-user"></i>
              Invite user
            </button>
            <button type="button" aria-label="Export users">
              <i className="ti-download"></i>
            </button>
          </div>
        </header>

        {isLoading && (
          <div className="user-management-page__notice">Loading users...</div>
        )}
        {error && <div className="user-management-page__notice">{error}</div>}
        {notice && (
          <div className="user-management-page__notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}

        <section
          className="user-management-page__stats-grid"
          aria-label="User statistics"
        >
          {statCards.map((stat) => (
            <article key={stat.label}>
              <span
                className={`user-management-page__stat-icon is-${stat.tone}`}
              >
                <i className={stat.icon}></i>
              </span>
              <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <p>{stat.note}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="user-management-page__workspace">
          <section className="user-management-page__board">
            <div className="user-management-page__board-title">
              <h2>User directory</h2>
            </div>

            <div className="user-management-page__toolbar">
              <label className="user-management-page__search-box">
              <i className="ti-search"></i>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search users..."
              />
              </label>

              <div className="user-management-page__filter-row">
                {[
                  ["all", "All"],
                  ["active", "Active"],
                  ["disabled", "Disabled"],
                  ["pending", "Pending"],
                    ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={statusFilter === value ? "active" : ""}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">Role</option>
                <option value="faculty">Faculty</option>
                <option value="researcher">Researcher</option>
                <option value="student">Student</option>
              </select>

              <select aria-label="Sort users" defaultValue="last-active">
                <option value="last-active">Sort: Last active</option>
                <option value="name">Sort: Name</option>
                <option value="storage">Sort: Storage</option>
              </select>
            </div>

          <div className="user-management-page__table-wrap">
            <table className="user-management-page__table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Storage</th>
                  <th>Last active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const storagePercent = getStoragePercent(user);
                  return (
                      <tr
                        key={user.id}
                        className={
                          selectedUserId === user.id ? "is-selected" : ""
                        }
                        onClick={() => setSelectedUserId(user.id)}
                      >
                      <td>
                        <div className="user-management-page__identity">
                            <UserAvatar user={user} />
                          <div>
                            <strong>{user.name}</strong>
                            <p>{user.email}</p>
                            <small>{user.department}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                          <span className="user-management-page__role">
                            {user.role}
                          </span>
                      </td>
                      <td>
                          <span
                            className={`user-management-page__status user-management-page__status--${user.status.toLowerCase()}`}
                          >
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <div className="user-management-page__quota">
                            <strong>{storagePercent}%</strong>
                            <div className="user-management-page__quota-bar">
                              <span
                                className={
                                  storagePercent >= 80 ? "danger" : ""
                                }
                                style={{ width: `${storagePercent}%` }}
                              ></span>
                            </div>
                            <small>
                              {formatStorage(user.storageUsed, user.quota)}
                            </small>
                          </div>
                        </td>
                        <td>{user.lastActive}</td>
                        <td>
                          <button
                            type="button"
                            className="user-management-page__more-button"
                            aria-label={`Open actions for ${user.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedUserId(user.id);
                            }}
                          >
                            <i className="ti-more-alt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="user-management-page__empty">
                <i className="ti-user"></i>
                <h3>No users found</h3>
                <p>Try another keyword or clear the current filter.</p>
              </div>
            ) : (
              <footer className="user-management-page__table-footer">
                <span>
                  Showing 1–{filteredUsers.length} of {filteredUsers.length} users
                </span>
                <div>
                  <button type="button" disabled>
                    <i className="ti-angle-left"></i>
                  </button>
                  <button type="button" className="active">
                    1
                  </button>
                  <button type="button" disabled>
                    <i className="ti-angle-right"></i>
                  </button>
                </div>
              </footer>
            )}
          </section>

          <aside className="user-management-page__detail-panel">
            {selectedUser ? (
              <>
                <div className="user-management-page__detail-heading">
                  <h2>User details</h2>
                  <button
                    type="button"
                    aria-label="Close user details"
                    onClick={() => setSelectedUserId(null)}
                  >
                    <i className="ti-close"></i>
                  </button>
                </div>

                <div className="user-management-page__profile">
                  <UserAvatar user={selectedUser} large />
                  <div>
                    <h3>{selectedUser.name}</h3>
                    <p>{selectedUser.email}</p>
                    <span>{selectedUser.department}</span>
                  </div>
                </div>

                <dl className="user-management-page__details-list">
                  <div>
                    <dt>Role</dt>
                    <dd>
                      <span className="user-management-page__role">
                        {selectedUser.role}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`user-management-page__status user-management-page__status--${selectedUser.status.toLowerCase()}`}
                      >
                        {selectedUser.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Member since</dt>
                    <dd>{selectedUser.memberSince}</dd>
                  </div>
                  <div>
                    <dt>Last active</dt>
                    <dd>{selectedUser.lastActive}</dd>
                  </div>
                </dl>

                <section className="user-management-page__detail-storage">
                  <h3>Storage usage</h3>
                  <div>
                    <strong>{getStoragePercent(selectedUser)}%</strong>
                    <span>
                      {formatStorage(
                        selectedUser.storageUsed,
                        selectedUser.quota
                      )}
                    </span>
                  </div>
                  <div className="user-management-page__quota-bar">
                    <span
                      className={
                        getStoragePercent(selectedUser) >= 80 ? "danger" : ""
                      }
                      style={{
                        width: `${getStoragePercent(selectedUser)}%`,
                      }}
                    ></span>
                  </div>
                  <p>
                    {Math.max(
                      0,
                      selectedUser.quota - selectedUser.storageUsed
                    )}{" "}
                    GB remaining
                  </p>
                </section>

                <dl className="user-management-page__access-list">
                  <div>
                    <dt>Storage quota</dt>
                    <dd>{selectedUser.quota} GB</dd>
                  </div>
                  <div>
                    <dt>Workspace access</dt>
                    <dd>{selectedUser.workspaceAccess} workspaces</dd>
                  </div>
                  <div>
                    <dt>Libraries access</dt>
                    <dd>{selectedUser.libraryAccess} libraries</dd>
                  </div>
                </dl>

                <div className="user-management-page__detail-actions">
                  <button
                    type="button"
                    onClick={() =>
                      openConfirmation("resetQuota", selectedUser)
                    }
                  >
                    <i className="ti-reload"></i>
                    Reset quota
                  </button>
                  <button
                    type="button"
                    className={
                      selectedUser.status === "Disabled"
                        ? "reactivate"
                        : "disable"
                    }
                    onClick={() =>
                      openConfirmation(
                        selectedUser.status === "Disabled"
                          ? "reactivate"
                          : "disable",
                        selectedUser
                      )
                    }
                  >
                    <i
                      className={
                        selectedUser.status === "Disabled"
                          ? "ti-check"
                          : "ti-user"
                      }
                    ></i>
                    {selectedUser.status === "Disabled"
                      ? "Reactivate account"
                      : "Disable account"}
                  </button>
                </div>
              </>
            ) : (
              <div className="user-management-page__detail-empty">
                <i className="ti-user"></i>
                <h2>Select a user</h2>
                <p>Choose a row to review account and storage details.</p>
              </div>
            )}
          </aside>
        </section>
      </main>

      {inviteOpen && (
        <div
          className="user-management-page__modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <form
            className="user-management-page__invite-modal"
            onSubmit={handleInviteUser}
          >
            <div className="user-management-page__modal-title">
              <div>
                <span>User administration</span>
                <h2>Invite a new user</h2>
              </div>
              <button
                type="button"
                aria-label="Close invite dialog"
                onClick={() => setInviteOpen(false)}
              >
                ×
              </button>
            </div>
            <p>
              Send an invitation with the default student role. Permissions can
              be adjusted later.
            </p>
            <label>
              Email address
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="student@school.edu"
                autoFocus
              />
            </label>
            <div className="user-management-page__invite-actions">
              <button type="button" onClick={() => setInviteOpen(false)}>
                Cancel
              </button>
              <button type="submit">
                <i className="ti-user"></i>
                Send invite
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmAction && (
        <div
          className="user-management-page__modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="user-management-page__confirm-modal">
            <div className="user-management-page__confirm-icon">
              <i className="ti-alert"></i>
            </div>
            <h2>{confirmationContent[confirmAction.type].title}</h2>
            <p>{confirmationContent[confirmAction.type].message}</p>
            <div className="user-management-page__confirm-user">
              <strong>{confirmAction.user.name}</strong>
              <span>{confirmAction.user.email}</span>
            </div>
            <div className="user-management-page__confirm-actions">
              <button type="button" onClick={closeConfirmation}>
                Cancel
              </button>
              <button type="button" onClick={applyConfirmedAction}>
                {confirmationContent[confirmAction.type].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default UserManagementPage;
