import { useEffect, useMemo, useState } from "react";
import { getUsageStats } from "../../../../utils/adminApi";
import "./AdminUsagePage.css";

const QUOTA_LIMIT_BYTES = 50 * 1024 * 1024;
const AI_TOKEN_LIMIT = 120000;
const PAGE_SIZE = 10;

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function getPercent(value, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((Number(value || 0) / limit) * 100));
}

function getUserKey(row) {
  return row.user?.email || row.user_id || "unknown-user";
}

function getDisplayName(row) {
  return row.user?.name || row.user?.full_name || row.user?.email || row.user_id || "Unknown user";
}

function getUsageDate(row) {
  return row.usage_date || row.date || "No date";
}

function normalizeUsage(quotaUsage, aiUsage) {
  const records = new Map();

  quotaUsage.forEach((row) => {
    const key = `${getUserKey(row)}-${getUsageDate(row)}`;
    const current = records.get(key) || {
      id: key,
      userId: row.user_id,
      userName: getDisplayName(row),
      email: getUserKey(row),
      date: getUsageDate(row),
      bytesUploaded: 0,
      bytesDownloaded: 0,
      chatCount: 0,
      tokensConsumed: 0,
    };

    records.set(key, {
      ...current,
      userId: row.user_id || current.userId,
      userName: getDisplayName(row),
      email: getUserKey(row),
      date: getUsageDate(row),
      bytesUploaded: Number(row.bytes_uploaded || 0),
      bytesDownloaded: Number(row.bytes_downloaded || 0),
    });
  });

  aiUsage.forEach((row) => {
    const key = `${getUserKey(row)}-${getUsageDate(row)}`;
    const current = records.get(key) || {
      id: key,
      userId: row.user_id,
      userName: getDisplayName(row),
      email: getUserKey(row),
      date: getUsageDate(row),
      bytesUploaded: 0,
      bytesDownloaded: 0,
      chatCount: 0,
      tokensConsumed: 0,
    };

    records.set(key, {
      ...current,
      userId: row.user_id || current.userId,
      userName: getDisplayName(row),
      email: getUserKey(row),
      date: getUsageDate(row),
      chatCount: Number(row.chat_count || 0),
      tokensConsumed: Number(row.tokens_consumed || 0),
    });
  });

  return Array.from(records.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getRiskLevel(record) {
  const quotaPercent = getPercent(record.bytesUploaded, QUOTA_LIMIT_BYTES);
  const aiPercent = getPercent(record.tokensConsumed, AI_TOKEN_LIMIT);

  if (quotaPercent >= 100 || aiPercent >= 100) return "critical";
  if (quotaPercent >= 80 || aiPercent >= 80) return "warning";
  return "normal";
}

function AdminUsagePage() {
  const [usage, setUsage] = useState({
    quotaUsage: [],
    aiUsage: [],
  });
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [usageTypeFilter, setUsageTypeFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [notice, setNotice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const usageRecords = useMemo(
    () => normalizeUsage(usage.quotaUsage, usage.aiUsage),
    [usage.aiUsage, usage.quotaUsage]
  );

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return usageRecords.filter((record) => {
      const matchesSearch =
        !query ||
        record.email.toLowerCase().includes(query) ||
        record.userName.toLowerCase().includes(query) ||
        record.date.toLowerCase().includes(query);

      const risk = getRiskLevel(record);
      const matchesRisk = riskFilter === "all" || risk === riskFilter;

      const matchesUsageType =
        usageTypeFilter === "all" ||
        (usageTypeFilter === "quota" && record.bytesUploaded + record.bytesDownloaded > 0) ||
        (usageTypeFilter === "ai" && record.tokensConsumed + record.chatCount > 0);

      return matchesSearch && matchesRisk && matchesUsageType;
    });
  }, [riskFilter, searchText, usageRecords, usageTypeFilter]);

  useEffect(() => {
    // Resetting pagination is intentional whenever the filter result set changes.
    setCurrentPage(1);
  }, [searchText, riskFilter, usageTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(
    () =>
      filteredRecords.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredRecords],
  );

  const stats = useMemo(() => {
    const totalUpload = usageRecords.reduce((sum, row) => sum + row.bytesUploaded, 0);
    const totalDownload = usageRecords.reduce((sum, row) => sum + row.bytesDownloaded, 0);
    const totalTokens = usageRecords.reduce((sum, row) => sum + row.tokensConsumed, 0);
    const riskyUsers = usageRecords.filter((row) => getRiskLevel(row) !== "normal").length;

    return {
      totalUpload,
      totalDownload,
      totalTokens,
      riskyUsers,
    };
  }, [usageRecords]);

  function exportUsageCsv() {
    const rows = [
      [
        "User",
        "Email",
        "Date",
        "Uploaded bytes",
        "Downloaded bytes",
        "AI tokens",
        "Chat count",
        "Risk",
      ],
      ...filteredRecords.map((record) => [
        record.userName,
        record.email,
        record.date,
        record.bytesUploaded,
        record.bytesDownloaded,
        record.tokensConsumed,
        record.chatCount,
        getRiskLevel(record),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");

    link.href = url;
    link.download = "admin-usage-report.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Usage report exported.");
  }

  return (
    <main className="usage_admin_page">
      <header className="usage_admin_header">
        <div>
          <span className="usage_admin_kicker">Admin usage monitor</span>
          <h1>Usage monitor</h1>
          <p>Track storage, AI consumption and accounts that require review.</p>
        </div>

        <div className="usage_admin_header_actions">
          <div>
            <span>Risk queue</span>
            <strong>{stats.riskyUsers}</strong>
          </div>
          <button type="button" onClick={exportUsageCsv}>
            <i className="ti-download" />
            Export report
          </button>
        </div>
      </header>

      {error && <div className="usage_admin_error">{error}</div>}
      {notice && (
        <div className="usage_admin_notice">
          <i className="ti-check" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="usage_admin_stats_grid">
        <article>
          <span className="usage_admin_stat_icon is-upload"><i className="ti-upload" /></span>
          <div>
            <span>Total uploaded</span>
            <strong>{formatBytes(stats.totalUpload)}</strong>
            <p>Across monitored accounts</p>
          </div>
        </article>

        <article>
          <span className="usage_admin_stat_icon is-download"><i className="ti-download" /></span>
          <div>
            <span>Total downloaded</span>
            <strong>{formatBytes(stats.totalDownload)}</strong>
            <p>Library and workspace traffic</p>
          </div>
        </article>

        <article>
          <span className="usage_admin_stat_icon is-ai"><i className="ti-bolt" /></span>
          <div>
            <span>AI tokens</span>
            <strong>{formatNumber(stats.totalTokens)}</strong>
            <p>Combined token consumption</p>
          </div>
        </article>

        <article>
          <span className="usage_admin_stat_icon is-risk"><i className="ti-alert" /></span>
          <div>
            <span>Risk users</span>
            <strong>{stats.riskyUsers}</strong>
            <p>Accounts requiring review</p>
          </div>
        </article>
      </section>

      <section className="usage_admin_workspace">
        <section className="usage_admin_panel">
          <div className="usage_admin_toolbar">
            <div>
              <h2>Usage records</h2>
              <p>{filteredRecords.length} records from quota and AI usage data.</p>
            </div>

            <div className="usage_admin_filters">
              <label>
                <i className="ti-search" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search users..."
                />
              </label>
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                <option value="all">All risks</option>
                <option value="normal">Normal</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              <select value={usageTypeFilter} onChange={(event) => setUsageTypeFilter(event.target.value)}>
                <option value="all">All usage</option>
                <option value="quota">Storage</option>
                <option value="ai">AI usage</option>
              </select>
            </div>
          </div>

          <div className="usage_admin_table_wrapper">
            <table className="usage_admin_table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Date</th>
                  <th>Storage usage</th>
                  <th>AI usage</th>
                  <th>Risk</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => {
                  const risk = getRiskLevel(record);
                  const quotaPercent = getPercent(record.bytesUploaded, QUOTA_LIMIT_BYTES);
                  const aiPercent = getPercent(record.tokensConsumed, AI_TOKEN_LIMIT);

                  return (
                    <tr
                      key={record.id}
                      className={selectedRecord?.id === record.id ? "is-selected" : ""}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <td>
                        <div className="usage_admin_user_cell">
                          <span>{record.userName.slice(0, 2).toUpperCase()}</span>
                          <div><strong>{record.userName}</strong><small>{record.email}</small></div>
                        </div>
                      </td>
                      <td>{record.date}</td>
                      <td>
                        <div className="usage_admin_meter_cell">
                          <div><span>{formatBytes(record.bytesUploaded)}</span><small>{quotaPercent}%</small></div>
                          <div className="usage_admin_meter"><span className={quotaPercent >= 80 ? "danger" : ""} style={{ width: `${quotaPercent}%` }} /></div>
                          <small>Down: {formatBytes(record.bytesDownloaded)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="usage_admin_meter_cell">
                          <div><span>{formatNumber(record.tokensConsumed)}</span><small>{aiPercent}%</small></div>
                          <div className="usage_admin_meter"><span className={aiPercent >= 80 ? "danger" : ""} style={{ width: `${aiPercent}%` }} /></div>
                          <small>{formatNumber(record.chatCount)} chats</small>
                        </div>
                      </td>
                      <td><span className={`usage_admin_risk usage_admin_risk_${risk}`}>{risk}</span></td>
                      <td>
                        <button
                          type="button"
                          className="usage_admin_more"
                          aria-label={`View usage for ${record.userName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedRecord(record);
                          }}
                        >
                          <i className="ti-more-alt" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="usage_admin_empty">No usage records match the current filters.</div>
          ) : (
            <footer className="usage_admin_table_footer">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of{" "}
                {filteredRecords.length} records
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  <i className="ti-angle-left" />
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  <i className="ti-angle-right" />
                </button>
              </div>
            </footer>
          )}
        </section>

        <aside className="usage_admin_detail_panel">
          {selectedRecord ? (
            <>
              <div className="usage_admin_detail_header">
                <h2>Usage details</h2>
                <button type="button" onClick={() => setSelectedRecord(null)} aria-label="Close usage details">×</button>
              </div>
              <div className="usage_admin_profile">
                <span>{selectedRecord.userName.slice(0, 2).toUpperCase()}</span>
                <div><h3>{selectedRecord.userName}</h3><p>{selectedRecord.email}</p><small>{selectedRecord.date}</small></div>
              </div>

              <div className="usage_admin_detail_section">
                <div className="usage_admin_detail_title"><h3>Storage usage</h3><strong>{getPercent(selectedRecord.bytesUploaded, QUOTA_LIMIT_BYTES)}%</strong></div>
                <div className="usage_admin_meter"><span className={getPercent(selectedRecord.bytesUploaded, QUOTA_LIMIT_BYTES) >= 80 ? "danger" : ""} style={{ width: `${getPercent(selectedRecord.bytesUploaded, QUOTA_LIMIT_BYTES)}%` }} /></div>
                <dl><div><dt>Uploaded</dt><dd>{formatBytes(selectedRecord.bytesUploaded)}</dd></div><div><dt>Downloaded</dt><dd>{formatBytes(selectedRecord.bytesDownloaded)}</dd></div><div><dt>Quota limit</dt><dd>{formatBytes(QUOTA_LIMIT_BYTES)}</dd></div></dl>
              </div>

              <div className="usage_admin_detail_section">
                <div className="usage_admin_detail_title"><h3>AI usage</h3><strong>{getPercent(selectedRecord.tokensConsumed, AI_TOKEN_LIMIT)}%</strong></div>
                <div className="usage_admin_meter"><span className={getPercent(selectedRecord.tokensConsumed, AI_TOKEN_LIMIT) >= 80 ? "danger" : ""} style={{ width: `${getPercent(selectedRecord.tokensConsumed, AI_TOKEN_LIMIT)}%` }} /></div>
                <dl><div><dt>Tokens</dt><dd>{formatNumber(selectedRecord.tokensConsumed)}</dd></div><div><dt>Chats</dt><dd>{formatNumber(selectedRecord.chatCount)}</dd></div><div><dt>Daily limit</dt><dd>{formatNumber(AI_TOKEN_LIMIT)}</dd></div></dl>
              </div>

              <div className="usage_admin_detail_risk">
                <span>Risk level</span>
                <strong className={`usage_admin_risk usage_admin_risk_${getRiskLevel(selectedRecord)}`}>{getRiskLevel(selectedRecord)}</strong>
              </div>

            </>
          ) : (
            <div className="usage_admin_detail_empty">
              <i className="ti-bar-chart" />
              <h2>Select a record</h2>
              <p>Choose a user to review storage and AI consumption.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="usage_admin_policy_bar">
        <div><span><i className="ti-alert" /></span><p><strong>Quota spike</strong> Storage usage reaches 80% of the account limit.</p></div>
        <div><span><i className="ti-bolt" /></span><p><strong>AI spike</strong> Token consumption approaches the daily threshold.</p></div>
        <div><span><i className="ti-shield" /></span><p><strong>Admin policy</strong> Use the Users page for account status changes.</p></div>
      </section>
    </main>
  );
}

export default AdminUsagePage;
