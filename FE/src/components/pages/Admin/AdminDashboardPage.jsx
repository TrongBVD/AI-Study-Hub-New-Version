import { useEffect, useState } from "react";
import { getAdminDashboard } from "../../../utils/adminApi";
import "./Admin.css";

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getAdminDashboard();
        setStats(data);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load dashboard.");
      }
    }

    loadStats();
  }, []);

  if (error) {
    return (
      <div className="admin_page">
        <div className="admin_error">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return <div className="admin_page">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin_page">
      <div className="admin_header">
        <h1>Admin Dashboard</h1>
        <p>Overview of users, documents, AI moderation, and usage.</p>
      </div>

      <div className="admin_grid">
        <div className="admin_card">
          <div className="admin_card_label">Total Users</div>
          <div className="admin_card_value">{stats.totalUsers}</div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">Total Documents</div>
          <div className="admin_card_value">{stats.totalDocuments}</div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">Pending Moderation</div>
          <div className="admin_card_value">{stats.pendingModeration}</div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">AI Chats Today</div>
          <div className="admin_card_value">{stats.totalAiChatsToday}</div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">Tokens Today</div>
          <div className="admin_card_value">{stats.totalTokensToday}</div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">Uploaded Today</div>
          <div className="admin_card_value">
            {formatBytes(stats.totalBytesUploadedToday)}
          </div>
        </div>

        <div className="admin_card">
          <div className="admin_card_label">Downloaded Today</div>
          <div className="admin_card_value">
            {formatBytes(stats.totalBytesDownloadedToday)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;