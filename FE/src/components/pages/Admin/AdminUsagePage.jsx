import { useEffect, useState } from "react";
import { getUsageStats } from "../../../utils/adminApi";
import "./Admin.css";

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function AdminUsagePage() {
  const [usage, setUsage] = useState({
    quotaUsage: [],
    aiUsage: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsage() {
      try {
        setError("");
        const data = await getUsageStats();
        setUsage({
          quotaUsage: data?.quotaUsage || [],
          aiUsage: data?.aiUsage || [],
        });
      } catch (err) {
        setError(err.response?.data?.message || "Could not load usage data.");
      }
    }

    loadUsage();
  }, []);

  return (
    <div className="admin_page">
      <div className="admin_header">
        <h1>Usage Monitoring</h1>
        <p>Monitor upload, download, AI chat, and token usage.</p>
      </div>

      {error && <div className="admin_error">{error}</div>}

      <div className="admin_panel">
        <h2>Daily Quota Usage</h2>

        <div className="admin_table_wrapper">
          <table className="admin_table">
            <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
                <th>Uploaded</th>
                <th>Downloaded</th>
              </tr>
            </thead>

            <tbody>
              {usage.quotaUsage.map((row) => (
                <tr key={row.id}>
                  <td>{row.user?.email || row.user_id}</td>
                  <td>{row.usage_date}</td>
                  <td>{formatBytes(row.bytes_uploaded)}</td>
                  <td>{formatBytes(row.bytes_downloaded)}</td>
                </tr>
              ))}

              {usage.quotaUsage.length === 0 && (
                <tr>
                  <td colSpan="4" className="admin_empty">
                    No quota usage found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin_panel" style={{ marginTop: "24px" }}>
        <h2>AI Usage</h2>

        <div className="admin_table_wrapper">
          <table className="admin_table">
            <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
                <th>Chat Count</th>
                <th>Tokens Consumed</th>
              </tr>
            </thead>

            <tbody>
              {usage.aiUsage.map((row) => (
                <tr key={row.id}>
                  <td>{row.user?.email || row.user_id}</td>
                  <td>{row.usage_date}</td>
                  <td>{row.chat_count}</td>
                  <td>{row.tokens_consumed}</td>
                </tr>
              ))}

              {usage.aiUsage.length === 0 && (
                <tr>
                  <td colSpan="4" className="admin_empty">
                    No AI usage found.
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

export default AdminUsagePage;