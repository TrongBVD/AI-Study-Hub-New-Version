import { useEffect, useState } from "react";
import { getAdminUsers, updateUserStatus } from "../../../utils/adminApi";
import "./Admin.css";

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState("");

  async function loadUsers(value = "") {
    try {
      setError("");
      const data = await getAdminUsers(value);
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load users.");
    }
  }

useEffect(() => {
  async function initialLoad() {
    try {
      setError("");
      const data = await getAdminUsers("");
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load users.");
    }
  }

  initialLoad();
}, []);

  async function handleSearch(e) {
    e.preventDefault();
    await loadUsers(search);
  }

  async function handleStatusChange(userId, status) {
    const reason = window.prompt(`Reason for changing status to ${status}:`);

    if (!reason || !reason.trim()) {
      return;
    }

    try {
      setLoadingId(userId);
      await updateUserStatus(userId, status, reason.trim());
      await loadUsers(search);
    } catch (err) {
      alert(err.response?.data?.message || "Could not update user status.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <div className="admin_page">
      <div className="admin_header">
        <h1>User Management</h1>
        <p>Search users, disable accounts, or reactivate accounts.</p>
      </div>

      {error && <div className="admin_error">{error}</div>}

      <form onSubmit={handleSearch} style={{ marginBottom: "16px" }}>
        <input
          className="admin_input"
          placeholder="Search username or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button className="admin_button" type="submit">
          Search
        </button>
      </form>

      <div className="admin_panel">
        <div className="admin_table_wrapper">
          <table className="admin_table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username || "N/A"}</td>
                  <td>{user.email}</td>
                  <td>{user.full_name || "N/A"}</td>
                  <td>{user.role}</td>

                  <td>
                    <span
                      className={`admin_status ${String(user.status || "")
                        .toLowerCase()
                        .replace("-", "_")}`}
                    >
                      {user.status}
                    </span>
                  </td>

                  <td>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleString()
                      : "N/A"}
                  </td>

                  <td>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "N/A"}
                  </td>

                  <td>
                    <div className="admin_actions">
                      {user.status === "ACTIVE" ? (
                        <button
                          className="admin_button danger"
                          disabled={loadingId === user.id}
                          onClick={() =>
                            handleStatusChange(user.id, "DISABLED")
                          }
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          className="admin_button"
                          disabled={loadingId === user.id}
                          onClick={() => handleStatusChange(user.id, "ACTIVE")}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan="8" className="admin_empty">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminUsersPage;