
import { useMemo, useState } from "react";

import "./UserManagementPage.css";

const INITIAL_USERS = [
  {
    id: "USR-1024",
    name: "Dr. Elena Rostova",
    email: "elena.r@scholarhub.edu",
    role: "Faculty",
    status: "Active",
    storageUsed: 41,
    quota: 50,
    lastActive: "2 mins ago",
    avatar: "https://i.pravatar.cc/80?img=32",
    department: "Research Methods",
  },
  {
    id: "USR-1025",
    name: "Julian Marchetti",
    email: "j.marchetti@scholarhub.edu",
    role: "Researcher",
    status: "Active",
    storageUsed: 12,
    quota: 100,
    lastActive: "1 hour ago",
    avatarText: "JM",
    department: "Data Lab",
  },
  {
    id: "USR-1026",
    name: "Liam Thorne",
    email: "l.thorne@scholarhub.edu",
    role: "Student",
    status: "Disabled",
    storageUsed: 4.5,
    quota: 10,
    lastActive: "Oct 12, 2023",
    avatar: "https://i.pravatar.cc/80?img=12",
    department: "Software Engineering",
  },
  {
    id: "USR-1027",
    name: "Maya Linton",
    email: "maya.linton@scholarhub.edu",
    role: "Student",
    status: "Active",
    storageUsed: 47,
    quota: 50,
    lastActive: "Yesterday",
    avatarText: "ML",
    department: "Design Research",
  },
];

function formatStorage(used, quota) {
  return `${used} / ${quota} GB`;
}

function getStoragePercent(user) {
  return Math.min(100, Math.round((user.storageUsed / user.quota) * 100));
}

function UserManagementPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [notice, setNotice] = useState("");

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

  function applyConfirmedAction() {
    if (!confirmAction) return;

    const { type, user } = confirmAction;

    setUsers((currentUsers) =>
      currentUsers.map((item) => {
        if (item.id !== user.id) return item;

        if (type === "disable") {
          return { ...item, status: "Disabled" };
        }

        if (type === "reactivate") {
          return { ...item, status: "Active" };
        }

        if (type === "resetQuota") {
          return { ...item, storageUsed: 0, quota: 50 };
        }

        return item;
      })
    );

    const actionText = {
      disable: "disabled",
      reactivate: "reactivated",
      resetQuota: "quota reset",
    }[type];

    setNotice(`${user.name} has been ${actionText}.`);
    closeConfirmation();
  }

  function handleInviteUser(event) {
    event.preventDefault();

    const email = inviteEmail.trim();
    if (!email) {
      setNotice("Enter an email before sending an invite.");
      return;
    }

    const newUser = {
      id: `USR-${Date.now()}`,
      name: email.split("@")[0].replace(/[._-]/g, " "),
      email,
      role: "Student",
      status: "Pending",
      storageUsed: 0,
      quota: 50,
      lastActive: "Invite sent",
      avatarText: email.slice(0, 2).toUpperCase(),
      department: "Pending assignment",
    };

    setUsers((currentUsers) => [newUser, ...currentUsers]);
    setInviteEmail("");
    setNotice(`Invite sent to ${email}.`);
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
        "This will reset the user's used storage to 0 GB and restore the quota to 50 GB.",
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
              <p>Send an invite with a default student role. You can adjust permissions later.</p>
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
                placeholder="Search by name, email, role, or department"
              />
            </div>
          </div>

          <div className="user-management-page__filter-row">
            {[
              ["all", "All users"],
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
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} />
                          ) : (
                            <span>{user.avatarText}</span>
                          )}

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
