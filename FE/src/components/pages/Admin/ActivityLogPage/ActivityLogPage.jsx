import { useMemo, useState } from "react";
import "./ActivityLogPage.css";

const INITIAL_LOGS = [
  {
    id: "LOG-1001",
    user: "j.smith@scholar.edu",
    userName: "Jordan Smith",
    role: "Senior Archivist",
    avatar: "JS",
    action: "DOCUMENT_UPLOADED",
    actionLabel: "Document uploaded",
    actionType: "create",
    document: "research-methods-week-4.pdf",
    documentId: "DOC-492-X901",
    workspace: "Academic Research",
    workspaceId: "WSP-1402",
    entityType: "Document",
    ipAddress: "192.168.1.24",
    device: "Chrome on Windows",
    date: "2026-06-16",
    time: "14:22:10",
    result: "Success",
    details:
      "User uploaded a PDF document to Academic Research. The file passed storage and content validation.",
  },
  {
    id: "LOG-1002",
    user: "admin_root",
    userName: "System Admin",
    role: "System Root",
    avatar: "AR",
    action: "USER_DISABLED",
    actionLabel: "User disabled",
    actionType: "security",
    document: "N/A",
    documentId: "N/A",
    workspace: "System",
    workspaceId: "SYS",
    entityType: "User",
    ipAddress: "10.0.0.12",
    device: "Admin Console",
    date: "2026-06-16",
    time: "13:05:44",
    result: "Requires audit",
    details:
      "Admin disabled a user account after suspicious access attempts. The account can be reactivated by an authorized admin.",
  },
  {
    id: "LOG-1003",
    user: "m.vance@scholar.edu",
    userName: "Mira Vance",
    role: "Editor",
    avatar: "MV",
    action: "TOPIC_STATUS_CHANGED",
    actionLabel: "Topic status changed",
    actionType: "update",
    document: "N/A",
    documentId: "N/A",
    workspace: "Business Case Review",
    workspaceId: "WSP-2218",
    entityType: "Workspace",
    ipAddress: "172.16.4.8",
    device: "Firefox on macOS",
    date: "2026-06-15",
    time: "18:12:03",
    result: "Success",
    details:
      "Topic status changed from In progress to Completed inside Business Case Review workspace.",
  },
  {
    id: "LOG-1004",
    user: "k.lee@scholar.edu",
    userName: "Khoa Lee",
    role: "Member",
    avatar: "KL",
    action: "DOCUMENT_DELETED",
    actionLabel: "Document deleted",
    actionType: "danger",
    document: "old-testing-plan.xlsx",
    documentId: "DOC-802-XLS",
    workspace: "Software Testing",
    workspaceId: "WSP-3310",
    entityType: "Document",
    ipAddress: "192.168.1.88",
    device: "Edge on Windows",
    date: "2026-06-14",
    time: "10:44:12",
    result: "Success",
    details:
      "User deleted an outdated spreadsheet from Software Testing. The action is reversible only if backup retention is enabled.",
  },
  {
    id: "LOG-1005",
    user: "system",
    userName: "System",
    role: "Automation",
    avatar: "SY",
    action: "QUOTA_RESET",
    actionLabel: "Quota reset",
    actionType: "quota",
    document: "N/A",
    documentId: "N/A",
    workspace: "Personal Library",
    workspaceId: "LIB-1180",
    entityType: "Quota",
    ipAddress: "127.0.0.1",
    device: "Scheduled job",
    date: "2026-06-13",
    time: "09:12:15",
    result: "Success",
    details:
      "Storage quota was reset after an admin confirmation. The previous usage record was archived in the audit ledger.",
  },
  {
    id: "LOG-1006",
    user: "n.chen@scholar.edu",
    userName: "Nina Chen",
    role: "Manager",
    avatar: "NC",
    action: "MEMBER_INVITED",
    actionLabel: "Member invited",
    actionType: "create",
    document: "N/A",
    documentId: "N/A",
    workspace: "AI Study Hub",
    workspaceId: "WSP-9081",
    entityType: "Workspace",
    ipAddress: "192.168.2.15",
    device: "Safari on iPad",
    date: "2026-06-12",
    time: "16:30:40",
    result: "Pending",
    details:
      "A new member invitation was sent to the workspace. The invite remains pending until accepted or revoked.",
  },
  {
    id: "LOG-1007",
    user: "r.nguyen@scholar.edu",
    userName: "Rin Nguyen",
    role: "Member",
    avatar: "RN",
    action: "COMMENT_ADDED",
    actionLabel: "Comment added",
    actionType: "update",
    document: "requirement-note.docx",
    documentId: "DOC-228-DOC",
    workspace: "Requirement Analysis",
    workspaceId: "WSP-7714",
    entityType: "Document",
    ipAddress: "192.168.1.31",
    device: "Chrome on Android",
    date: "2026-06-11",
    time: "21:08:18",
    result: "Success",
    details:
      "User added a comment to a requirement document. The document owner received a notification.",
  },
  {
    id: "LOG-1008",
    user: "admin_root",
    userName: "System Admin",
    role: "System Root",
    avatar: "AR",
    action: "POLICY_UPDATED",
    actionLabel: "Policy updated",
    actionType: "security",
    document: "N/A",
    documentId: "N/A",
    workspace: "System",
    workspaceId: "SYS",
    entityType: "System",
    ipAddress: "10.0.0.12",
    device: "Admin Console",
    date: "2026-06-10",
    time: "11:55:02",
    result: "Success",
    details:
      "Admin updated the moderation policy for document uploads and workspace collaboration events.",
  },
];

const ACTION_FILTERS = [
  "All actions",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_DELETED",
  "USER_DISABLED",
  "TOPIC_STATUS_CHANGED",
  "QUOTA_RESET",
  "MEMBER_INVITED",
  "COMMENT_ADDED",
  "POLICY_UPDATED",
];

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ActivityLogPage() {
  const [logs] = useState(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState("All users");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [documentFilter, setDocumentFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("All workspaces");
  const [startDate, setStartDate] = useState("2026-06-10");
  const [endDate, setEndDate] = useState("2026-06-16");
  const [selectedLog, setSelectedLog] = useState(logs[0]);
  const [notice, setNotice] = useState("");

  const uniqueUsers = useMemo(
    () => ["All users", ...new Set(logs.map((log) => log.user))],
    [logs]
  );

  const uniqueWorkspaces = useMemo(
    () => ["All workspaces", ...new Set(logs.map((log) => log.workspace))],
    [logs]
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

      const logDate = new Date(`${log.date}T00:00:00`);
      const fromDate = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const toDate = endDate ? new Date(`${endDate}T23:59:59`) : null;

      const matchesDate =
        (!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate);

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
      (log) => log.actionType === "security" || log.actionType === "danger"
    ).length;
    const documentCount = filteredLogs.filter(
      (log) => log.entityType === "Document"
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
    setStartDate("2026-06-10");
    setEndDate("2026-06-16");
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
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
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
              <p>
                Filter by user, action, document, workspace and date range.
              </p>
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
                {ACTION_FILTERS.map((action) => (
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
                <p>
                  Showing {filteredLogs.length} of {logs.length} total events.
                </p>
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
                        className={
                          selectedLog?.id === log.id ? "is-selected" : ""
                        }
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
                          <span
                            className={`activity-log-page__action-badge activity-log-page__action-badge--${log.actionType}`}
                          >
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
                          <span className="activity-log-page__result">
                            {log.result}
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
                    <span>Document</span>
                    <strong>{selectedLog.document}</strong>
                    <small>{selectedLog.documentId}</small>
                  </div>
                  <div>
                    <span>Workspace</span>
                    <strong>{selectedLog.workspace}</strong>
                    <small>{selectedLog.workspaceId}</small>
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
