import { useEffect, useMemo, useState } from "react";
import { getActivityLogs } from "../../../../utils/adminApi";
import "./ActivityLogPage.css";

const ACTION_OPTIONS = [
  { value: "DEFAULT", label: "Default (Select an action...)" },
  { value: "ADMIN_REVIEW_DOCUMENT", label: "ADMIN_REVIEW_DOCUMENT (Admin Review)" },
  { value: "DOCUMENT_APPROVED", label: "DOCUMENT_APPROVED (File Approved)" },
  { value: "DOCUMENT_REJECTED", label: "DOCUMENT_REJECTED (File Rejected)" },
  { value: "FILE_FLAGGED", label: "FILE_FLAGGED (AI Moderation Flagged)" },
  { value: "WORKSPACE_ROLE_CHANGED", label: "WORKSPACE_ROLE_CHANGED (Role Update)" },
  { value: "WORKSPACE_DELETED", label: "WORKSPACE_DELETED (Workspace Removed)" },
  { value: "WORKSPACE_RENAMED", label: "WORKSPACE_RENAMED (Workspace Renamed)" },
  { value: "ADMIN_UPDATE_USER_STATUS", label: "ADMIN_UPDATE_USER_STATUS (User Status)" },
  { value: "ADMIN_UPDATE_USER_ROLE", label: "ADMIN_UPDATE_USER_ROLE (User Role)" },
];

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
  if (action.includes("CREATE") || action.includes("UPLOAD") || action.includes("APPROVED")) return "create";
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
  const adminName = row.admin ? getDisplayName(row.admin) : actorName;
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const action = row.action_type || "UNKNOWN_ACTION";
  const oldData = row.old_data || {};
  const newData = row.new_data || {};

  let targetUser = "N/A";
  let documentTitle = row.entity_type === "documents" ? (newData.documentTitle || oldData.title || row.entity_id) : "N/A";
  let workspaceName = row.entity_type === "workspaces" ? (newData.name || oldData.name || row.entity_id) : "System";
  let changeSummary = "";

  if (action === "ADMIN_REVIEW_DOCUMENT" || action === "DOCUMENT_APPROVED" || action === "DOCUMENT_REJECTED") {
    targetUser = oldData.uploader_id ? (oldData.uploader_name || `User ID: ${oldData.uploader_id.slice(0, 8)}...`) : actorName;
    changeSummary = row.details || `${newData.notificationType || action}`;
  } else if (action === "FILE_FLAGGED") {
    targetUser = actorName;
    changeSummary = newData.word ? `Flagged word: "${newData.word}" (${newData.classification || "FLAGGED"})` : row.details;
  } else if (action === "WORKSPACE_ROLE_CHANGED") {
    targetUser = newData.targetUserName || newData.targetUserId || "Workspace Member";
    changeSummary = `Role change: ${oldData.role || "Member"} → ${newData.role || "Updated"}`;
  } else if (action === "ADMIN_UPDATE_USER_STATUS") {
    targetUser = newData.username || newData.targetUserId || row.entity_id;
    changeSummary = `Status change: ${oldData.status || "Active"} → ${newData.status || "Updated"}`;
  } else if (action === "ADMIN_UPDATE_USER_ROLE") {
    targetUser = newData.username || newData.targetUserId || row.entity_id;
    changeSummary = `Role change: ${oldData.role || "USER"} → ${newData.role || "Updated"}`;
  } else {
    changeSummary = row.details || `${action} on ${row.entity_type}`;
  }

  return {
    id: row.id,
    user: row.actor?.email || row.actor?.username || row.user_id || "unknown",
    userName: actorName,
    adminId: row.admin_id || row.user_id,
    adminName: adminName,
    targetUser: targetUser,
    role: row.actor?.username || "User",
    avatar: getInitials(actorName),
    action: action,
    actionLabel: getActionLabel(action),
    actionType: getActionType(action),
    document: documentTitle,
    documentId: row.entity_type === "documents" ? row.entity_id : "N/A",
    workspace: workspaceName,
    workspaceId: row.entity_type === "workspaces" ? row.entity_id : (row.entity_type || "SYS"),
    entityType: row.entity_type || "System",
    changeSummary: changeSummary,
    riskLevel: row.risk_level || "INFO",
    date: createdAt ? createdAt.toISOString().slice(0, 10) : "",
    time: createdAt ? createdAt.toLocaleTimeString() : "",
    result: "Recorded",
    details: row.details || changeSummary,
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
  const [actionFilter, setActionFilter] = useState("DEFAULT");
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
      } catch (err) {
        setError(err.response?.data?.message || "Could not load activity logs.");
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, []);

  const uniqueUsers = useMemo(
    () => ["All users", ...new Set(logs.map((log) => log.user))],
    [logs],
  );

  const uniqueWorkspaces = useMemo(
    () => ["All scopes", ...new Set(logs.map((log) => log.workspace))],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    if (actionFilter === "DEFAULT") {
      return [];
    }

    const keyword = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesKeyword =
        !keyword ||
        [
          log.user,
          log.userName,
          log.adminName,
          log.targetUser,
          log.action,
          log.actionLabel,
          log.document,
          log.workspace,
          log.changeSummary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesUser = userFilter === "All users" || log.user === userFilter;
      const matchesAction = log.action === actionFilter;
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
        ["security", "danger"].includes(log.actionType) || log.riskLevel === "HIGH",
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
    setActionFilter("DEFAULT");
    setWorkspaceFilter("All scopes");
    setStartDate("");
    setEndDate("");
    setSelectedLog(null);
    setNotice("Filters reset.");
  }

  function exportCsv() {
    if (filteredLogs.length === 0) {
      setNotice("No logs selected to export.");
      return;
    }
    const rows = [
      ["Log ID", "Actor/Admin", "Target User", "Action", "Document/Workspace", "Change Details", "Date", "Time", "Risk Level"],
      ...filteredLogs.map((log) => [
        log.id,
        log.adminName || log.userName,
        log.targetUser,
        log.action,
        log.document !== "N/A" ? log.document : log.workspace,
        log.changeSummary,
        log.date,
        log.time,
        log.riskLevel,
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
    link.download = `audit-logs-${actionFilter}.csv`;
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
    ["Total events", stats.total, "Filtered action events", "ti-list", "neutral"],
    ["High risk events", stats.security, "Security & high risk actions", "ti-shield", "danger"],
    ["Document actions", stats.document, "Document reviews and moderation", "ti-file", "orange"],
    ["Active scopes", stats.workspace, "Workspaces and targets", "ti-user", "green"],
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
            <button type="button" onClick={exportCsv} disabled={actionFilter === "DEFAULT"}>
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
              <p>Select a specific action from the dropdown to inspect audit records.</p>
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
                  disabled={actionFilter === "DEFAULT"}
                />
              </div>
            </label>

            <label className="activity-log-page__filter-field">
              <span>Action (Required)</span>
              <select
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setSelectedLog(null);
                }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="activity-log-page__filter-field">
              <span>User</span>
              <select
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
                disabled={actionFilter === "DEFAULT"}
              >
                {uniqueUsers.map((user) => <option key={user}>{user}</option>)}
              </select>
            </label>

            <label className="activity-log-page__filter-field">
              <span>Scope</span>
              <select
                value={workspaceFilter}
                onChange={(event) => setWorkspaceFilter(event.target.value)}
                disabled={actionFilter === "DEFAULT"}
              >
                {uniqueWorkspaces.map((scope) => <option key={scope}>{scope}</option>)}
              </select>
            </label>

            <label className="activity-log-page__filter-field activity-log-page__filter-field--date">
              <span>Date range</span>
              <div className="activity-log-page__date-range">
                <i className="ti-calendar" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={actionFilter === "DEFAULT"}
                />
                <span>–</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={actionFilter === "DEFAULT"}
                />
              </div>
            </label>
          </div>
        </section>

        <section className="activity-log-page__layout">
          <article className="activity-log-page__table-card">
            <header className="activity-log-page__table-toolbar">
              <div>
                <h2>Audit records</h2>
                <p>
                  {actionFilter === "DEFAULT"
                    ? "No action selected."
                    : `Showing ${filteredLogs.length} events for ${actionFilter}.`}
                </p>
              </div>
            </header>

            <div className="activity-log-page__table-wrapper">
              <table className="activity-log-page__table">
                <thead>
                  <tr>
                    <th>Actor / Admin</th>
                    <th>Target User</th>
                    <th>Action</th>
                    <th>Target Resource</th>
                    <th>Details &amp; Changes</th>
                    <th>Date &amp; Time</th>
                    <th>Risk</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {actionFilter === "DEFAULT" ? (
                    <tr>
                      <td colSpan="8">
                        <div className="activity-log-page__empty">
                          <i className="ti-mouse-alt" />
                          <h3>Please select an action to view audit logs.</h3>
                          <p>Choose an action option from the filter dropdown above to display matching system events.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="activity-log-page__empty">
                          <i className="ti-search" />
                          <h3>No audit records found for this action</h3>
                          <p>Try clearing your search term or adjusting date range filters.</p>
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
                            <span className={`is-${log.actionType}`}>
                              <i className={getEventIcon(log.actionType)} />
                            </span>
                            <div>
                              <strong>{log.adminName || log.userName}</strong>
                              <small>ID: {(log.adminId || log.user).slice(0, 8)}...</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="activity-log-page__entity-cell">
                            <strong>{log.targetUser}</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`activity-log-page__action-badge activity-log-page__action-badge--${log.actionType}`}>
                            {log.actionLabel}
                          </span>
                        </td>
                        <td>
                          <div className="activity-log-page__entity-cell">
                            <strong>{log.document !== "N/A" ? log.document : log.workspace}</strong>
                            <small>{log.documentId !== "N/A" ? `Doc: ${log.documentId.slice(0, 8)}...` : `Scope: ${log.workspaceId}`}</small>
                          </div>
                        </td>
                        <td>
                          <div className="activity-log-page__change-cell">
                            <span>{log.changeSummary}</span>
                          </div>
                        </td>
                        <td>
                          <div className="activity-log-page__time-cell">
                            <strong>{formatDate(log.date)}</strong>
                            <small>{log.time}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`activity-log-page__risk-pill is-${String(log.riskLevel).toLowerCase()}`}>
                            {log.riskLevel}
                          </span>
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
                <span>Showing 1–{filteredLogs.length} of {filteredLogs.length} events</span>
                <div>
                  <button disabled><i className="ti-angle-left" /></button>
                  <button className="active">1</button>
                  <button disabled><i className="ti-angle-right" /></button>
                </div>
              </footer>
            )}
          </article>

          <aside className="activity-log-page__details-panel">
            {selectedLog ? (
              <>
                <div className="activity-log-page__details-title">
                  <h2>Event details</h2>
                  <button type="button" onClick={() => setSelectedLog(null)} aria-label="Close details">
                    <i className="ti-close" />
                  </button>
                </div>

                <div className="activity-log-page__details-list">
                  <div>
                    <span>Actor / Admin</span>
                    <strong>{selectedLog.adminName || selectedLog.userName}</strong>
                    <small>ID: {selectedLog.adminId || selectedLog.user}</small>
                  </div>
                  <div>
                    <span>Target User</span>
                    <strong>{selectedLog.targetUser}</strong>
                  </div>
                  <div>
                    <span>Action Type</span>
                    <strong>{selectedLog.action}</strong>
                  </div>
                  <div>
                    <span>Target Resource</span>
                    <strong>{selectedLog.document !== "N/A" ? selectedLog.document : selectedLog.workspace}</strong>
                    <small>ID: {selectedLog.documentId !== "N/A" ? selectedLog.documentId : selectedLog.workspaceId}</small>
                  </div>
                  <div>
                    <span>Change Summary</span>
                    <strong>{selectedLog.changeSummary}</strong>
                  </div>
                  <div>
                    <span>Risk Level</span>
                    <strong className={`risk-text-${String(selectedLog.riskLevel).toLowerCase()}`}>{selectedLog.riskLevel}</strong>
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
