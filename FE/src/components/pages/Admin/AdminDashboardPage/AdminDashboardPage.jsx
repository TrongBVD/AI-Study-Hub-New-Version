import { useEffect, useMemo, useState } from "react";
import {
  getActivityLogs,
  getAdminDashboard,
  getAdminUsers,
  getModerationDocuments,
  getUsageStats,
  reviewDocument,
} from "../../../../utils/adminApi";
import "./AdminDashboardPage.css";

const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const AI_TOKEN_LIMIT = 120000;

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";
}

function getDisplayName(user) {
  return user?.full_name || user?.username || user?.email || "Unknown user";
}

function getLogTime(value) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

function getDocumentReason(document) {
  const reason = document.ai_reject_reason;
  if (!reason) return "Document needs admin review.";
  if (typeof reason === "string") return reason;
  return reason.reason || reason.error || "Document needs admin review.";
}

function getQueueSeverity(status) {
  if (status === "FLAGGED" || status === "REJECTED") return "critical";
  return "warning";
}

function getUsagePercent(value, limit) {
  if (!limit) return 0;
  return Math.min(Math.round((Number(value || 0) / limit) * 100), 100);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [usage, setUsage] = useState({ quotaUsage: [], aiUsage: [] });
  const [selectedLog, setSelectedLog] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError("");

        const [dashboardData, moderationData, userData, logData, usageData] =
          await Promise.all([
            getAdminDashboard(),
            getModerationDocuments(),
            getAdminUsers(),
            getActivityLogs(),
            getUsageStats(),
          ]);

        setStats(dashboardData);
        setQueue(moderationData || []);
        setUsers(userData || []);
        setLogs(logData || []);
        setSelectedLog((logData || [])[0] || null);
        setUsage({
          quotaUsage: usageData?.quotaUsage || [],
          aiUsage: usageData?.aiUsage || [],
        });
      } catch (err) {
        setError(err.response?.data?.message || "Could not load admin dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const visibleLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return logs;

    return logs.filter((log) =>
      [
        getDisplayName(log.actor),
        log.action_type,
        log.entity_type,
        log.entity_id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [logs, searchTerm]);

  const quotaRows = useMemo(
    () =>
      usage.quotaUsage
        .map((row) => {
          const used = Number(row.bytes_uploaded || 0) + Number(row.bytes_downloaded || 0);
          return {
            id: row.id,
            owner: getDisplayName(row.user),
            used,
            percent: getUsagePercent(used, STORAGE_LIMIT_BYTES),
          };
        })
        .sort((a, b) => b.used - a.used)
        .slice(0, 3),
    [usage.quotaUsage],
  );

  const aiRows = useMemo(
    () =>
      usage.aiUsage
        .map((row) => {
          const tokens = Number(row.tokens_consumed || 0);
          const percent = getUsagePercent(tokens, AI_TOKEN_LIMIT);
          return {
            id: row.id,
            owner: getDisplayName(row.user),
            tokens,
            requests: Number(row.chat_count || 0),
            risk: percent >= 100 ? "critical" : percent >= 80 ? "warning" : "normal",
          };
        })
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 3),
    [usage.aiUsage],
  );

  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const moderationQueueCount = queue.length;
  const avgQuotaUsage =
    quotaRows.length === 0
      ? 0
      : Math.round(quotaRows.reduce((sum, item) => sum + item.percent, 0) / quotaRows.length);
  const aiCriticalUsers = aiRows.filter((item) => item.risk === "critical").length;
  const totalAiTokens = stats?.totalTokensToday || 0;

  async function resolveModerationCase(documentId, action) {
    const decision = action === "Approved" ? "APPROVE" : "KEEP_REJECTED";

    try {
      await reviewDocument(documentId, decision, `${action} from admin dashboard.`);
      setQueue((current) => current.filter((item) => item.id !== documentId));
      setNotice(`${action} completed for selected document.`);
    } catch (err) {
      setNotice(err.response?.data?.message || "Could not save moderation decision.");
    }
  }

  function handleQuotaAction(owner) {
    setNotice(`Quota review opened for ${owner}.`);
  }

  function handleAiAction(owner) {
    setNotice(`AI usage investigation opened for ${owner}.`);
  }

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard__topbar">
        <div className="admin-dashboard__brand-block">
          <div className="admin-dashboard__brand-icon">
            <i className="ti-shield" />
          </div>
          <div>
            <strong>AI Study Hub Admin</strong>
            <span>System overview</span>
          </div>
        </div>

        <label className="admin-dashboard__search-box" aria-label="Search dashboard logs">
          <i className="ti-search" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            type="search"
            placeholder="Search users, documents, actions or logs..."
          />
        </label>

        <div className="admin-dashboard__topbar-right">
          <button type="button" className="admin-dashboard__ghost-btn">
            <i className="ti-bell" />
          </button>
          <button type="button" className="admin-dashboard__primary-btn">
            <i className="ti-control-panel" />
            System settings
          </button>
          <div className="admin-dashboard__avatar">AD</div>
        </div>
      </header>

      <main className="admin-dashboard__inner">
        {isLoading && <div className="admin-dashboard__notice">Loading admin data...</div>}
        {error && <div className="admin-dashboard__notice">{error}</div>}
        {notice && (
          <div className="admin-dashboard__notice" role="status">
            <i className="ti-check" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>Close</button>
          </div>
        )}

        <section className="admin-dashboard__hero">
          <div>
            <span className="admin-dashboard__kicker">Admin dashboard</span>
            <h1>Monitor users, documents, moderation, quota, AI usage and recent logs.</h1>
            <p>Use this page as the first control point before opening deeper admin modules.</p>
          </div>

          <div className="admin-dashboard__hero-card">
            <span>Today status</span>
            <strong>{moderationQueueCount + aiCriticalUsers}</strong>
            <p>items need admin attention</p>
          </div>
        </section>

        <section className="admin-dashboard__stats-grid" aria-label="Dashboard summary">
          <article className="admin-dashboard__stat-card">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-user" /></span>
              <span className="admin-dashboard__stat-note">{activeUsers} active</span>
            </div>
            <span className="admin-dashboard__stat-label">Users</span>
            <strong className="admin-dashboard__stat-value">{stats?.totalUsers || 0}</strong>
          </article>

          <article className="admin-dashboard__stat-card">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-files" /></span>
              <span className="admin-dashboard__stat-note">{stats?.pendingModeration || 0} flagged</span>
            </div>
            <span className="admin-dashboard__stat-label">Documents</span>
            <strong className="admin-dashboard__stat-value">{stats?.totalDocuments || 0}</strong>
          </article>

          <article className="admin-dashboard__stat-card admin-dashboard__stat-card--alert">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-alert" /></span>
              <span className="admin-dashboard__stat-note">Review queue</span>
            </div>
            <span className="admin-dashboard__stat-label">Moderation</span>
            <strong className="admin-dashboard__stat-value">{moderationQueueCount}</strong>
          </article>

          <article className="admin-dashboard__stat-card">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-harddrives" /></span>
              <span className="admin-dashboard__stat-note">Average {avgQuotaUsage}%</span>
            </div>
            <span className="admin-dashboard__stat-label">Uploaded today</span>
            <strong className="admin-dashboard__stat-value">{formatBytes(stats?.totalBytesUploadedToday)}</strong>
          </article>

          <article className="admin-dashboard__stat-card admin-dashboard__stat-card--dark">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-bolt" /></span>
              <span className="admin-dashboard__stat-note">{stats?.totalAiChatsToday || 0} chats</span>
            </div>
            <span className="admin-dashboard__stat-label">AI usage</span>
            <strong className="admin-dashboard__stat-value">{totalAiTokens.toLocaleString()}</strong>
          </article>
        </section>

        <section className="admin-dashboard__content-grid">
          <div className="admin-dashboard__main-stack">
            <section className="admin-dashboard__panel">
              <div className="admin-dashboard__panel-header">
                <div>
                  <h2>Moderation queue</h2>
                  <p>Documents flagged by AI that need a decision.</p>
                </div>
                <button type="button" className="admin-dashboard__outline-btn">Open moderation</button>
              </div>

              <div className="admin-dashboard__queue-list">
                {queue.length === 0 ? (
                  <div className="admin-dashboard__empty-state">
                    <i className="ti-check-box" />
                    <h3>No pending cases</h3>
                    <p>All moderation cases have been handled.</p>
                  </div>
                ) : (
                  queue.map((item) => (
                    <article className="admin-dashboard__queue-item" key={item.id}>
                      <div className={`admin-dashboard__queue-icon ${getQueueSeverity(item.status) === "critical" ? "is-critical" : ""}`}>
                        <i className="ti-alert" />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{getDocumentReason(item)}</p>
                        <span>Uploader: {getDisplayName(item.uploader)} · Status {item.status}</span>
                      </div>
                      <span className={`admin-dashboard__severity is-${getQueueSeverity(item.status)}`}>{getQueueSeverity(item.status)}</span>
                      <button type="button" onClick={() => resolveModerationCase(item.id, "Approved")}>Approve</button>
                      <button type="button" onClick={() => resolveModerationCase(item.id, "Removed")}>Remove</button>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="admin-dashboard__dual-grid">
              <div className="admin-dashboard__panel">
                <div className="admin-dashboard__panel-header compact">
                  <div>
                    <h2>Quota monitor</h2>
                    <p>Users close to storage limits.</p>
                  </div>
                </div>

                <div className="admin-dashboard__quota-list">
                  {quotaRows.length === 0 ? (
                    <div className="admin-dashboard__empty-state">No quota usage yet.</div>
                  ) : (
                    quotaRows.map((item) => (
                      <article className="admin-dashboard__quota-row" key={item.id}>
                        <div>
                          <strong>{item.owner}</strong>
                          <span>Daily quota usage</span>
                        </div>
                        <div className="admin-dashboard__quota-meter">
                          <div><span style={{ width: `${item.percent}%` }} /></div>
                          <small>{formatBytes(item.used)} / {formatBytes(STORAGE_LIMIT_BYTES)}</small>
                        </div>
                        <button type="button" onClick={() => handleQuotaAction(item.owner)}>Review</button>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="admin-dashboard__panel">
                <div className="admin-dashboard__panel-header compact">
                  <div>
                    <h2>AI usage watch</h2>
                    <p>High request and token usage.</p>
                  </div>
                </div>

                <div className="admin-dashboard__ai-list">
                  {aiRows.length === 0 ? (
                    <div className="admin-dashboard__empty-state">No AI usage yet.</div>
                  ) : (
                    aiRows.map((item) => (
                      <article className="admin-dashboard__ai-row" key={item.id}>
                        <div className="admin-dashboard__avatar small">{getInitials(item.owner)}</div>
                        <div>
                          <strong>{item.owner}</strong>
                          <span>{item.tokens.toLocaleString()} tokens · {item.requests} requests</span>
                        </div>
                        <button className={`admin-dashboard__risk is-${item.risk}`} type="button" onClick={() => handleAiAction(item.owner)}>
                          {item.risk}
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="admin-dashboard__side-stack">
            <section className="admin-dashboard__panel admin-dashboard__users-panel">
              <div className="admin-dashboard__panel-header compact">
                <div>
                  <h2>Users</h2>
                  <p>Current account state.</p>
                </div>
              </div>
              {users.slice(0, 5).map((user) => {
                const name = getDisplayName(user);
                const status = String(user.status || "ACTIVE").toLowerCase();
                return (
                  <article className="admin-dashboard__user-row" key={user.id}>
                    <div className="admin-dashboard__avatar small">{getInitials(name)}</div>
                    <div>
                      <strong>{name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <span className={`admin-dashboard__user-status is-${status}`}>{status}</span>
                  </article>
                );
              })}
            </section>

            <section className="admin-dashboard__panel admin-dashboard__logs-panel">
              <div className="admin-dashboard__panel-header compact">
                <div>
                  <h2>Recent logs</h2>
                  <p>{visibleLogs.length} entries shown</p>
                </div>
              </div>

              <div className="admin-dashboard__log-list">
                {visibleLogs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    className={`admin-dashboard__log-item ${selectedLog?.id === log.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <span className="admin-dashboard__log-dot is-ai" />
                    <div>
                      <strong>{log.action_type}</strong>
                      <small>{getDisplayName(log.actor)} · {getLogTime(log.created_at)}</small>
                    </div>
                  </button>
                ))}
              </div>

              {selectedLog && (
                <div className="admin-dashboard__log-detail">
                  <span>Selected log</span>
                  <strong>{selectedLog.id}</strong>
                  <p>{selectedLog.action_type} on {selectedLog.entity_type}</p>
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    </section>
  );
}

export default AdminDashboardPage;
