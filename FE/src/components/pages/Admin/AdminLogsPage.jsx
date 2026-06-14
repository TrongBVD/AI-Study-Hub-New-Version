import { useEffect, useState } from "react";
import { getActivityLogs } from "../../../utils/adminApi";
import "./Admin.css";

function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLogs() {
      try {
        setError("");
        const data = await getActivityLogs();
        setLogs(data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load activity logs.");
      }
    }

    loadLogs();
  }, []);

  return (
    <div className="admin_page">
      <div className="admin_header">
        <h1>Activity Logs</h1>
        <p>Audit trail for important system and Admin actions.</p>
      </div>

      {error && <div className="admin_error">{error}</div>}

      <div className="admin_panel">
        <div className="admin_table_wrapper">
          <table className="admin_table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Created At</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {log.actor?.email ||
                      log.actor?.username ||
                      log.user_id ||
                      "N/A"}
                  </td>

                  <td>{log.action_type}</td>
                  <td>{log.entity_type}</td>
                  <td>{log.entity_id}</td>

                  <td>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="admin_empty">
                    No activity logs found.
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

export default AdminLogsPage;