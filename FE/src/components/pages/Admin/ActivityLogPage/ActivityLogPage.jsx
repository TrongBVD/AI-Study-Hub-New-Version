import { useEffect, useMemo, useState } from "react";
import { getActivityLogs } from "../../../../utils/adminApi";
import "./ActivityLogPage.css";

function getDisplayName(user) {
  return user?.full_name || user?.username || user?.email || "Unknown user";
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AL"
  );
}

function getActionType(action = "") {
  if (action.includes("DISABLE") || action.includes("SECURITY")) return "security";
  if (action.includes("DELETE") || action.includes("REJECT")) return "danger";
  if (action.includes("QUOTA")) return "quota";
  if (action.includes("CREATE") || action.includes("UPLOAD")) return "create";
  return "update";
}

function getActionLabel(action = "") {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapLog(row) {
  const actorName = getDisplayName(row.actor);
  const createdAt = row.created_at ? new Date(row.created_at) : null;

  return {
    id: row.id,
    user: row.actor?.email || row.actor?.username || row.user_id || "unknown",
    userName: actorName,
    role: row.actor?.username || "User",
    avatar: getInitials(actorName),
    action: row.action_type || "UNKNOWN_ACTION",
    actionLabel: getActionLabel(row.action_type || "UNKNOWN_ACTION"),
    actionType: getActionType(row.action_type || ""),
    document: row.entity_type === "documents" ? row.entity_id : "N/A",
    documentId: row.entity_type === "documents" ? row.entity_id : "N/A",
    workspace: row.entity_type === "workspaces" ? row.entity_id : row.entity_type || "System",
    workspaceId: row.entity_type === "workspaces" ? row.entity_id : row.entity_type || "SYS",
    entityType: row.entity_type || "System",
    ipAddress: "N/A",
    device: "Backend API",
    date: createdAt ? createdAt.toISOString().slice(0, 10) : "",
    time: createdAt ? createdAt.toLocaleTimeString() : "",
    result: "Recorded",
    details: `${row.action_type} on ${row.entity_type} ${row.entity_id}`,
    raw: row,
  };
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState("All users");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [documentFilter, setDocumentFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("All workspaces");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        setIsLoading(true);
        setError("");
        const data = await getActivityLogs();
        const mapped = (data || []).map(mapLog);
        setLogs(mapped);
        setSelectedLog(mapped[0] || null);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load activity logs.");
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, []);

  const actionFilters = useMemo(
    () => ["All actions", ...new Set(logs.map((log) => log.action))],
    [logs],
  );

  const uniqueUsers = useMemo(
    () => ["All users", ...new Set(logs.map((log) => log.user))],
    [logs],
  );

  const uniqueWorkspaces = useMemo(
    () => ["All workspaces", ...new Set(logs.map((log) => log.workspace))],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const documentKeyword = documentFilter.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesKeyword =
        !keyword ||
        [
          log.user,
          log.userName,
          log.action,
          log.actionLabel,
          log.document,
          log.documentId,
          log.workspace,
          log.workspaceId,
          log.entityType,
          log.result,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesUser = userFilter === "All users" || log.user === userFilter;
      const matchesAction =
        actionFilter === "All actions" || log.action === actionFilter;
      const matchesDocument =
        !documentKeyword ||
        log.document.toLowerCase().includes(documentKeyword) ||
        log.documentId.toLowerCase().includes(documentKeyword);
      const matchesWorkspace =
        workspaceFilter === "All workspaces" ||
        log.workspace === workspaceFilter;

      const logDate = log.date ? new Date(`${log.date}T00:00:00`) : null;
      const fromDate = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const toDate = endDate ? new Date(`${endDate}T23:59:59`) : null;

      const matchesDate =
        (!fromDate || !logDate || logDate >= fromDate) &&
        (!toDate || !logDate || logDate <= toDate);

      return (
        matchesKeyword &&
        matchesUser &&
        matchesAction &&
        matchesDocument &&
        matchesWorkspace &&
        matchesDate
      );
    });
  }, [
    logs,
    searchTerm,
    userFilter,
    actionFilter,
    documentFilter,
    workspaceFilter,
    startDate,
    endDate,
  ]);

  const stats = useMemo(() => {
    const securityCount = filteredLogs.filter(
      (log) => log.actionType === "security" || log.actionType === "danger",
    ).length;
    const documentCount = filteredLogs.filter(
      (log) => log.entityType === "documents",
    ).length;
    const workspaceCount = new Set(filteredLogs.map((log) => log.workspace)).size;

    return {
      total: filteredLogs.length,
      security: securityCount,
      document: documentCount,
      workspace: workspaceCount,
    };
  }, [filteredLogs]);

  function resetFilters() {
    setSearchTerm("");
    setUserFilter("All users");
    setActionFilter("All actions");
    setDocumentFilter("");
    setWorkspaceFilter("All workspaces");
    setStartDate("");
    setEndDate("");
    setNotice("Filters reset.");
  }

  function exportCsv() {
    const rows = [
      ["Log ID", "User", "Action", "Document", "Workspace", "Date", "Time", "Result"],
      ...filteredLogs.map((log) => [
        log.id,
        log.user,
        log.action,
        log.document,
        log.workspace,
        log.date,
        log.time,
        log.result,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity-log.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Activity log exported.");
  }

  return (
    <section className="activity-log-page">
      <main className="activity-log-page__content">
        <section className="activity-log-page__hero-panel">
          <div>
            <span className="activity-log-page__eyebrow">Admin audit trail</span>
            <h1>Activity logs for user, document and workspace actions</h1>
            <p>
              Review system events, trace user actions, filter audit records and
              inspect the source metadata behind each log entry.
            </p>
          </div>

          <div className="activity-log-page__hero-actions">
            <button type="button" onClick={exportCsv}>
              <i className="ti-download" />
              Export CSV
            </button>
            <button type="button" onClick={resetFilters}>
              <i className="ti-reload" />
              Reset filters
            </button>
          </div>
        </section>

        {isLoading && <div className="activity-log-page__notice">Loading activity logs...</div>}
        {error && <div className="activity-log-page__notice">{error}</div>}
        {notice && (
          <div className="activity-log-page__notice">
            <i className="ti-check" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}

        <section className="activity-log-page__stats-grid" aria-label="Log stats">
          <article>
            <span>Total results</span>
            <strong>{stats.total}</strong>
            <p>Logs matched by current filters</p>
          </article>
          <article>
            <span>Security events</span>
            <strong>{stats.security}</strong>
            <p>Disable, policy and delete related actions</p>
          </article>
          <article>
            <span>Document actions</span>
            <strong>{stats.document}</strong>
            <p>Uploads, deletes, comments and metadata changes</p>
          </article>
          <article>
            <span>Workspaces</span>
            <strong>{stats.workspace}</strong>
            <p>Unique workspace or library scopes found</p>
          </article>
        </section>

        <section className="activity-log-page__filter-panel">
          <div className="activity-log-page__filter-header">
            <div>
              <h2>Filter activity logs</h2>
              <p>Filter by user, action, document, workspace and date range.</p>
            </div>
            <strong>{filteredLogs.length} shown</strong>
          </div>

          <div className="activity-log-page__filter-grid">
            <label>
              <span>Search all fields</span>
              <div className="activity-log-page__input-shell">
                <i className="ti-search" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search user, action, document or workspace"
                />
              </div>
            </label>

            <label>
              <span>User</span>
              <select
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
              >
                {uniqueUsers.map((user) => (
                  <option key={user}>{user}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Action</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                {actionFilters.map((action) => (
                  <option key={action}>{action}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Document</span>
              <input
                type="text"
                value={documentFilter}
                onChange={(event) => setDocumentFilter(event.target.value)}
                placeholder="Document name or ID"
              />
            </label>

            <label>
              <span>Workspace</span>
              <select
                value={workspaceFilter}
                onChange={(event) => setWorkspaceFilter(event.target.value)}
              >
                {uniqueWorkspaces.map((workspace) => (
                  <option key={workspace}>{workspace}</option>
                ))}
              </select>
            </label>

            <label>
              <span>From date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label>
              <span>To date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="activity-log-page__layout">
          <article className="activity-log-page__table-card">
            <header className="activity-log-page__table-toolbar">
              <div>
                <h2>Audit records</h2>
                <p>Showing {filteredLogs.length} of {logs.length} total events.</p>
              </div>
            </header>

            <div className="activity-log-page__table-wrapper">
              <table className="activity-log-page__table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Document</th>
                    <th>Workspace</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="activity-log-page__empty">
                          <i className="ti-search" />
                          <h3>No logs match these filters</h3>
                          <p>Adjust the filter values or reset the filter form.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className={selectedLog?.id === log.id ? "is-selected" : ""}
                      >
                        <td>
                          <div className="activity-log-page__actor">
                            <span>{log.avatar}</span>
                            <div>
                              <strong>{log.userName}</strong>
                              <small>{log.user}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`activity-log-page__action-badge activity-log-page__action-badge--${log.actionType}`}>
                            {log.actionLabel}
                          </span>
                        </td>
                        <td>
                          <div className="activity-log-page__entity-cell">
                            <strong>{log.document}</strong>
                            <small>{log.documentId}</small>
                          </div>
                        </td>
                        <td>
                          <div className="activity-log-page__entity-cell">
                            <strong>{log.workspace}</strong>
                            <small>{log.workspaceId}</small>
                          </div>
                        </td>
                        <td>
                          <div className="activity-log-page__time-cell">
                            <strong>{formatDate(log.date)}</strong>
                            <small>{log.time}</small>
                          </div>
                        </td>
                        <td>
                          <span className="activity-log-page__result">{log.result}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="activity-log-page__details-btn"
                            onClick={() => setSelectedLog(log)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="activity-log-page__details-panel">
            {selectedLog ? (
              <>
                <div className="activity-log-page__details-header">
                  <span>{selectedLog.id}</span>
                  <h2>{selectedLog.actionLabel}</h2>
                  <p>{selectedLog.details}</p>
                </div>

                <div className="activity-log-page__details-list">
                  <div>
                    <span>User</span>
                    <strong>{selectedLog.userName}</strong>
                    <small>{selectedLog.user}</small>
                  </div>
                  <div>
                    <span>Entity</span>
                    <strong>{selectedLog.entityType}</strong>
                    <small>{selectedLog.raw?.entity_id}</small>
                  </div>
                  <div>
                    <span>Device</span>
                    <strong>{selectedLog.device}</strong>
                    <small>{selectedLog.ipAddress}</small>
                  </div>
                  <div>
                    <span>Timestamp</span>
                    <strong>{formatDate(selectedLog.date)}</strong>
                    <small>{selectedLog.time}</small>
                  </div>
                </div>

                <button type="button" onClick={() => setNotice("Log marked for review.")}>
                  <i className="ti-flag" />
                  Mark for review
                </button>
              </>
            ) : (
              <div className="activity-log-page__empty compact">
                <i className="ti-layout-list-thumb" />
                <h3>Select a log</h3>
                <p>Choose one audit record to inspect its metadata.</p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </section>
  );
}

export default ActivityLogPage;
