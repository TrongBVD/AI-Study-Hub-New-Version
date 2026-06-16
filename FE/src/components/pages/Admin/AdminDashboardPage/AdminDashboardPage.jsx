
import { useMemo, useState } from "react";

import "./AdminDashboardPage.css";

const INITIAL_USERS = [
  { id: "U-1024", name: "Dang Khoa", email: "dangkhoa@example.com", status: "active", role: "Student" },
  { id: "U-1088", name: "Mina Tran", email: "mina.tran@example.com", status: "active", role: "Teacher" },
  { id: "U-1120", name: "Aris Nguyen", email: "aris.nguyen@example.com", status: "disabled", role: "Student" },
  { id: "U-1171", name: "Bao Le", email: "bao.le@example.com", status: "pending", role: "Student" },
];

const INITIAL_DOCUMENTS = [
  { id: "DOC-401", title: "Research-method-notes.pdf", owner: "Dang Khoa", size: "18.4 MB", status: "approved" },
  { id: "DOC-402", title: "ML-summary-v2.docx", owner: "Mina Tran", size: "6.8 MB", status: "review" },
  { id: "DOC-403", title: "Copied-reference-pack.zip", owner: "Aris Nguyen", size: "48.2 MB", status: "flagged" },
  { id: "DOC-404", title: "Workspace-outline.xlsx", owner: "Bao Le", size: "2.1 MB", status: "approved" },
];

const INITIAL_QUEUE = [
  {
    id: "MOD-901",
    document: "Copied-reference-pack.zip",
    reason: "Possible copyrighted source bundle",
    uploader: "Aris Nguyen",
    severity: "critical",
    confidence: 92,
  },
  {
    id: "MOD-902",
    document: "ML-summary-v2.docx",
    reason: "AI-generated section detected",
    uploader: "Mina Tran",
    severity: "warning",
    confidence: 78,
  },
  {
    id: "MOD-903",
    document: "Exam-bank-draft.pdf",
    reason: "Suspicious academic integrity pattern",
    uploader: "Dang Khoa",
    severity: "warning",
    confidence: 84,
  },
];

const INITIAL_QUOTAS = [
  { id: "Q-01", owner: "Dang Khoa", used: 34, limit: 50, type: "Library quota" },
  { id: "Q-02", owner: "Mina Tran", used: 41, limit: 50, type: "Workspace quota" },
  { id: "Q-03", owner: "Aris Nguyen", used: 49, limit: 50, type: "Library quota" },
];

const INITIAL_AI_USAGE = [
  { id: "AI-01", owner: "Dang Khoa", tokens: 42000, requests: 61, risk: "normal" },
  { id: "AI-02", owner: "Mina Tran", tokens: 78500, requests: 112, risk: "warning" },
  { id: "AI-03", owner: "Aris Nguyen", tokens: 126000, requests: 244, risk: "critical" },
];

const INITIAL_LOGS = [
  { id: "LOG-704", user: "Aris Nguyen", action: "Upload blocked", target: "Copied-reference-pack.zip", time: "Today, 14:20", type: "moderation" },
  { id: "LOG-703", user: "System", action: "Quota warning sent", target: "Aris Nguyen", time: "Today, 13:58", type: "quota" },
  { id: "LOG-702", user: "Mina Tran", action: "AI summary generated", target: "ML-summary-v2.docx", time: "Today, 12:41", type: "ai" },
  { id: "LOG-701", user: "Dang Khoa", action: "Created workspace", target: "Research Group A", time: "Yesterday, 18:22", type: "workspace" },
];

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getQuotaPercent(item) {
  return Math.min(Math.round((item.used / item.limit) * 100), 100);
}

function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [selectedLog, setSelectedLog] = useState(INITIAL_LOGS[0]);
  const [notice, setNotice] = useState("");

  const visibleLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return INITIAL_LOGS;

    return INITIAL_LOGS.filter((log) =>
      [log.user, log.action, log.target, log.type]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [searchTerm]);

  const activeUsers = INITIAL_USERS.filter((user) => user.status === "active").length;
  const flaggedDocs = INITIAL_DOCUMENTS.filter((doc) => doc.status === "flagged").length;
  const moderationQueueCount = queue.length;
  const avgQuotaUsage = Math.round(
    INITIAL_QUOTAS.reduce((sum, item) => sum + getQuotaPercent(item), 0) / INITIAL_QUOTAS.length
  );
  const aiCriticalUsers = INITIAL_AI_USAGE.filter((item) => item.risk === "critical").length;
  const totalAiTokens = INITIAL_AI_USAGE.reduce((sum, item) => sum + item.tokens, 0);

  function resolveModerationCase(caseId, action) {
    const target = queue.find((item) => item.id === caseId);
    setQueue((current) => current.filter((item) => item.id !== caseId));
    setNotice(`${action} completed for ${target?.document || "selected document"}.`);
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
            <p>
              Use this page as the first control point before opening deeper admin modules.
            </p>
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
            <strong className="admin-dashboard__stat-value">{INITIAL_USERS.length}</strong>
          </article>

          <article className="admin-dashboard__stat-card">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-files" /></span>
              <span className="admin-dashboard__stat-note">{flaggedDocs} flagged</span>
            </div>
            <span className="admin-dashboard__stat-label">Documents</span>
            <strong className="admin-dashboard__stat-value">{INITIAL_DOCUMENTS.length}</strong>
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
            <span className="admin-dashboard__stat-label">Quota usage</span>
            <strong className="admin-dashboard__stat-value">{avgQuotaUsage}%</strong>
          </article>

          <article className="admin-dashboard__stat-card admin-dashboard__stat-card--dark">
            <div className="admin-dashboard__stat-top">
              <span className="admin-dashboard__stat-icon"><i className="ti-bolt" /></span>
              <span className="admin-dashboard__stat-note">{aiCriticalUsers} critical</span>
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
                      <div className={`admin-dashboard__queue-icon ${item.severity === "critical" ? "is-critical" : ""}`}>
                        <i className="ti-alert" />
                      </div>
                      <div>
                        <strong>{item.document}</strong>
                        <p>{item.reason}</p>
                        <span>Uploader: {item.uploader} · Confidence {item.confidence}%</span>
                      </div>
                      <span className={`admin-dashboard__severity is-${item.severity}`}>{item.severity}</span>
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
                  {INITIAL_QUOTAS.map((item) => {
                    const percent = getQuotaPercent(item);
                    return (
                      <article className="admin-dashboard__quota-row" key={item.id}>
                        <div>
                          <strong>{item.owner}</strong>
                          <span>{item.type}</span>
                        </div>
                        <div className="admin-dashboard__quota-meter">
                          <div><span style={{ width: `${percent}%` }} /></div>
                          <small>{item.used} MB / {item.limit} MB</small>
                        </div>
                        <button type="button" onClick={() => handleQuotaAction(item.owner)}>Review</button>
                      </article>
                    );
                  })}
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
                  {INITIAL_AI_USAGE.map((item) => (
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
                  ))}
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
              {INITIAL_USERS.map((user) => (
                <article className="admin-dashboard__user-row" key={user.id}>
                  <div className="admin-dashboard__avatar small">{getInitials(user.name)}</div>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <span className={`admin-dashboard__user-status is-${user.status}`}>{user.status}</span>
                </article>
              ))}
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
                    <span className={`admin-dashboard__log-dot is-${log.type}`} />
                    <div>
                      <strong>{log.action}</strong>
                      <small>{log.user} · {log.time}</small>
                    </div>
                  </button>
                ))}
              </div>

              {selectedLog && (
                <div className="admin-dashboard__log-detail">
                  <span>Selected log</span>
                  <strong>{selectedLog.id}</strong>
                  <p>{selectedLog.action} on {selectedLog.target}</p>
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
