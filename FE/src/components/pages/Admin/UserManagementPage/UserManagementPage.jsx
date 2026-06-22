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
    avatarText: getInitials(name),
    department: row.username ? `@${row.username}` : "No username",
    raw: row,
  };
}

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        setIsLoading(true);
        setError("");
        const data = await getAdminUsers();
        setUsers((data || []).map(mapUser));
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
      const text = `${user.name} ${user.email} ${user.role} ${user.department}`.toLowerCase();
      const matchesSearch = text.includes(query.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "all" || user.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, query, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((user) => user.status === "Active").length;
    const disabled = users.filter((user) => user.status === "Disabled").length;
    const highStorage = users.filter((user) => getStoragePercent(user) >= 80).length;
    const totalQuota = users.reduce((sum, user) => sum + user.quota, 0);
    const totalUsed = users.reduce((sum, user) => sum + user.storageUsed, 0);

    return {
      active,
      disabled,
      highStorage,
      totalQuota,
      totalUsed,
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

  return (
    <section className="user-management-page">
      <main className="user-management-page__shell">
        <header className="user-management-page__hero">
          <div className="user-management-page__hero-copy">
            <span>User administration</span>
            <h1>Manage accounts, access, and storage from one place.</h1>
            <p>
              Disable users, reactivate accounts, reset storage quota, and review usage before it becomes a system issue.
            </p>
          </div>

          <form className="user-management-page__invite-panel" onSubmit={handleInviteUser}>
            <div>
              <span>Quick invite</span>
              <h2>Add a user</h2>
              <p>Invite persistence is not wired to a backend endpoint yet.</p>
            </div>

            <label>
              Email address
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="student@school.edu"
              />
            </label>

            <button type="submit">
              <i className="ti-plus"></i>
              Send invite
            </button>
          </form>
        </header>

        {isLoading && <div className="user-management-page__notice">Loading users...</div>}
        {error && <div className="user-management-page__notice">{error}</div>}
        {notice && (
          <div className="user-management-page__notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <section className="user-management-page__stats-grid" aria-label="User statistics">
          <article>
            <span>Total users</span>
            <strong>{stats.totalUsers}</strong>
            <p>{stats.active} active accounts</p>
          </article>

          <article>
            <span>Disabled</span>
            <strong>{stats.disabled}</strong>
            <p>Requires admin reactivation</p>
          </article>

          <article>
            <span>Storage alerts</span>
            <strong>{stats.highStorage}</strong>
            <p>Users above 80 percent quota</p>
          </article>

          <article>
            <span>Total storage</span>
            <strong>{stats.totalUsed} GB</strong>
            <p>{stats.totalQuota} GB quota assigned</p>
          </article>
        </section>

        <section className="user-management-page__board">
          <div className="user-management-page__board-header">
            <div>
              <h2>User directory</h2>
              <p>Search users, filter by account state, and run admin actions with confirmation.</p>
            </div>

            <div className="user-management-page__search-box">
              <i className="ti-search"></i>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, role, or username"
              />
            </div>
          </div>

          <div className="user-management-page__filter-row">
            {[
              ["all", "All users"],
              ["active", "Active"],
              ["disabled", "Disabled"],
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
                  const isDisabled = user.status === "Disabled";

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-management-page__identity">
                          <span>{user.avatarText}</span>

                          <div>
                            <strong>{user.name}</strong>
                            <p>{user.email}</p>
                            <small>{user.department}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="user-management-page__role">{user.role}</span>
                      </td>

                      <td>
                        <span className={`user-management-page__status user-management-page__status--${user.status.toLowerCase()}`}>
                          {user.status}
                        </span>
                      </td>

                      <td>
                        <div className="user-management-page__quota">
                          <div>
                            <strong>{storagePercent}%</strong>
                            <span>{formatStorage(user.storageUsed, user.quota)}</span>
                          </div>
                          <div className="user-management-page__quota-bar">
                            <span
                              className={storagePercent >= 80 ? "danger" : ""}
                              style={{ width: `${storagePercent}%` }}
                            ></span>
                          </div>
                        </div>
                      </td>

                      <td>{user.lastActive}</td>

                      <td>
                        <div className="user-management-page__actions">
                          {isDisabled ? (
                            <button type="button" onClick={() => openConfirmation("reactivate", user)}>
                              Reactivate
                            </button>
                          ) : (
                            <button type="button" onClick={() => openConfirmation("disable", user)}>
                              Disable
                            </button>
                          )}

                          <button type="button" onClick={() => openConfirmation("resetQuota", user)}>
                            Reset quota
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="user-management-page__empty">
              <i className="ti-user"></i>
              <h3>No users found</h3>
              <p>Try another keyword or clear the current filter.</p>
            </div>
          )}
        </section>
      </main>

      {confirmAction && (
        <div className="user-management-page__modal-overlay" role="dialog" aria-modal="true">
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
              <button type="button" onClick={closeConfirmation}>Cancel</button>
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
