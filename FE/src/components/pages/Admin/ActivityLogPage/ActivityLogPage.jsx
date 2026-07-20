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

function getEventIcon(type) {
  return {
    create: "ti-upload",
    info: "ti-user",
    document: "ti-file",
    danger: "ti-trash",
    security: "ti-shield",
  }[type] || "ti-info";
}

function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState("All users");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [workspaceFilter, setWorkspaceFilter] = useState("All scopes");
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
    () => ["All scopes", ...new Set(logs.map((log) => log.workspace))],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

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
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesUser = userFilter === "All users" || log.user === userFilter;
      const matchesAction =
        actionFilter === "All actions" || log.action === actionFilter;
      const matchesWorkspace =
        workspaceFilter === "All scopes" ||
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
        matchesWorkspace &&
        matchesDate
      );
    });
  }, [
    logs,
    searchTerm,
    userFilter,
    actionFilter,
    workspaceFilter,
    startDate,
    endDate,
  ]);

  const stats = useMemo(() => {
    return {
      total: filteredLogs.length,
      security: filteredLogs.filter((log) =>
        ["security", "danger"].includes(log.actionType),
      ).length,
      document: filteredLogs.filter((log) =>
        String(log.entityType).toLowerCase().includes("document"),
      ).length,
      workspace: new Set(filteredLogs.map((log) => log.workspace)).size,
    };
  }, [filteredLogs]);

  function resetFilters() {
    setSearchTerm("");
    setUserFilter("All users");
    setActionFilter("All actions");
    setWorkspaceFilter("All scopes");
    setStartDate("");
    setEndDate("");
    setNotice("Filters reset.");
  }

  function exportCsv() {
    const rows = [
      ["Log ID", "User", "Action", "Resource", "Scope", "Date", "Time", "Risk"],
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
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity-log.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Activity log exported.");
  }

  async function copyEventId() {
    if (!selectedLog) return;
    await navigator.clipboard.writeText(selectedLog.id);
    setNotice(`${selectedLog.id} copied.`);
  }

  const statCards = [
    ["Total events", stats.total, "All recorded events", "ti-list", "neutral"],
    ["Security events", stats.security, "Policy and security actions", "ti-shield", "danger"],
    ["Document actions", stats.document, "Uploads, edits and deletes", "ti-file", "orange"],
    ["Active scopes", stats.workspace, "Workspaces and libraries", "ti-user", "green"],
  ];

  return (
    <section className="activity-log-page">
      <main className="activity-log-page__content">
        <header className="activity-log-page__page-header">
          <div>
            <span>Admin audit trail</span>
            <h1>Activity logs</h1>
            <p>Trace system events, user actions and security changes.</p>
          </div>
          <div className="activity-log-page__header-actions">
            <button type="button" onClick={resetFilters}>
              <i className="ti-reload" /> Reset filters
            </button>
            <button type="button" onClick={exportCsv}>
              <i className="ti-download" /> Export CSV
            </button>
          </div>
        </header>

        {isLoading && <div className="activity-log-page__notice">Loading activity logs...</div>}
        {error && <div className="activity-log-page__notice">{error}</div>}
        {notice && (
          <div className="activity-log-page__notice" role="status">
            <i className="ti-check" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <section className="activity-log-page__stats-grid">
          {statCards.map(([label, value, note, icon, tone]) => (
            <article key={label}>
              <span className={`activity-log-page__stat-icon is-${tone}`}>
                <i className={icon} />
              </span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <p>{note}</p>
              </div>
            </article>
          ))}
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
            <label className="activity-log-page__filter-field activity-log-page__filter-field--search">
              <span>Search all fields</span>
              <div className="activity-log-page__input-shell">
                <i className="ti-search" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search logs..."
                />
              </div>
            </label>

            <label className="activity-log-page__filter-field">
              <span>User</span>
              <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
                {uniqueUsers.map((user) => <option key={user}>{user}</option>)}
              </select>
            </label>

            <label className="activity-log-page__filter-field">
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

            <label className="activity-log-page__filter-field">
              <span>Scope</span>
              <select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
                {uniqueWorkspaces.map((scope) => <option key={scope}>{scope}</option>)}
              </select>
            </label>

            <label className="activity-log-page__filter-field activity-log-page__filter-field--date">
              <span>Date range</span>
              <div className="activity-log-page__date-range">
                <i className="ti-calendar" />
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <span>–</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
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
                          <div className="activity-log-page__event">
                            <span className={`is-${log.actionType}`}><i className={getEventIcon(log.actionType)} /></span>
                            <div><strong>{log.actionLabel}</strong><small>{log.id}</small></div>
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

              {filteredLogs.length > 0 && (
                <footer className="activity-log-page__table-footer">
                  <span>Showing 1–{filteredLogs.length} of {logs.length} events</span>
                  <div><button disabled><i className="ti-angle-left" /></button><button className="active">1</button><button disabled><i className="ti-angle-right" /></button></div>
                </footer>
              )}
          </article>

          <aside className="activity-log-page__details-panel">
            {selectedLog ? (
              <>
                <div className="activity-log-page__details-title">
                  <h2>Event details</h2>
                  <button type="button" onClick={() => setSelectedLog(null)} aria-label="Close details"><i className="ti-close" /></button>
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

                <div className="activity-log-page__detail-actions">
                  <button type="button" onClick={copyEventId}>
                    <i className="ti-layers" /> Copy event ID
                  </button>
                </div>
              </>
            ) : (
              <div className="activity-log-page__empty compact">
                <i className="ti-layout-list-thumb" />
                <h3>Select an event</h3>
                <p>Choose an audit record to inspect its metadata.</p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </section>
  );
}

export default ActivityLogPage;
