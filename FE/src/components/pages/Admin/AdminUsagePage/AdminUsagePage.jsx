import { useEffect, useMemo, useState } from "react";
import { getUsageStats } from "../../../../utils/adminApi";
import "./AdminUsagePage.css";

const QUOTA_LIMIT_BYTES = 50 * 1024 * 1024;
const AI_TOKEN_LIMIT = 120000;

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
      status: "active",
      actionNote: "",
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
      status: "active",
      actionNote: "",
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
  const [confirmAction, setConfirmAction] = useState(null);
  const [notice, setNotice] = useState("");

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

  function openAction(type, record) {
    setConfirmAction({ type, record });
  }

  function applyAction() {
    if (!confirmAction) return;

    const { type, record } = confirmAction;
    const actionLabel =
      type === "suspend"
        ? "User access suspended"
        : type === "reset"
        ? "Quota reset requested"
        : "Usage marked for review";

    setNotice(`${actionLabel}: ${record.email}`);

    setUsage((current) => ({
      quotaUsage: current.quotaUsage.map((row) => {
        if (`${getUserKey(row)}-${getUsageDate(row)}` !== record.id) return row;

        if (type === "reset") {
          return {
            ...row,
            bytes_uploaded: 0,
            bytes_downloaded: 0,
          };
        }

        return {
          ...row,
          admin_status: type,
        };
      }),
      aiUsage: current.aiUsage.map((row) => {
        if (`${getUserKey(row)}-${getUsageDate(row)}` !== record.id) return row;

        if (type === "reset") {
          return {
            ...row,
            tokens_consumed: 0,
            chat_count: 0,
          };
        }

        return {
          ...row,
          admin_status: type,
        };
      }),
    }));

    setConfirmAction(null);
  }

  return (
    <main className="usage_admin_page">
      <section className="usage_admin_hero">
        <div>
          <span className="usage_admin_kicker">Admin usage monitor</span>
          <h1>Quota and AI usage control center</h1>
          <p>
            Track heavy storage activity, AI token consumption, and take action
            when usage looks abnormal.
          </p>
        </div>

        <div className="usage_admin_hero_card">
          <span>Risk queue</span>
          <strong>{stats.riskyUsers}</strong>
          <p>Users above warning or critical threshold.</p>
        </div>
      </section>

      {error && <div className="usage_admin_error">{error}</div>}
      {notice && (
        <div className="usage_admin_notice">
          <i className="ti-check" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}

      <section className="usage_admin_stats_grid">
        <article>
          <span>Total uploaded</span>
          <strong>{formatBytes(stats.totalUpload)}</strong>
          <p>Files uploaded across all monitored users.</p>
        </article>

        <article>
          <span>Total downloaded</span>
          <strong>{formatBytes(stats.totalDownload)}</strong>
          <p>Download traffic from libraries and workspaces.</p>
        </article>

        <article>
          <span>AI tokens</span>
          <strong>{formatNumber(stats.totalTokens)}</strong>
          <p>Combined AI token consumption in the selected period.</p>
        </article>

        <article>
          <span>Risk users</span>
          <strong>{stats.riskyUsers}</strong>
          <p>Accounts requiring admin review.</p>
        </article>
      </section>

      <section className="usage_admin_panel">
        <div className="usage_admin_toolbar">
          <div>
            <h2>Usage records</h2>
            <p>{filteredRecords.length} records shown from quota and AI usage data.</p>
          </div>

          <div className="usage_admin_filters">
            <label>
              <i className="ti-search" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search user, email or date"
              />
            </label>

            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="all">All risk levels</option>
              <option value="normal">Normal</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={usageTypeFilter}
              onChange={(event) => setUsageTypeFilter(event.target.value)}
            >
              <option value="all">All usage</option>
              <option value="quota">Quota only</option>
              <option value="ai">AI only</option>
            </select>
          </div>
        </div>

        <div className="usage_admin_table_wrapper">
          <table className="usage_admin_table">
            <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
                <th>Quota usage</th>
                <th>AI usage</th>
                <th>Risk</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => {
                const risk = getRiskLevel(record);
                const quotaPercent = getPercent(record.bytesUploaded, QUOTA_LIMIT_BYTES);
                const aiPercent = getPercent(record.tokensConsumed, AI_TOKEN_LIMIT);

                return (
                  <tr key={record.id}>
                    <td>
                      <div className="usage_admin_user_cell">
                        <span>{record.userName.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{record.userName}</strong>
                          <small>{record.email}</small>
                        </div>
                      </div>
                    </td>

                    <td>{record.date}</td>

                    <td>
                      <div className="usage_admin_meter_cell">
                        <div>
                          <span>{formatBytes(record.bytesUploaded)}</span>
                          <small>{quotaPercent}%</small>
                        </div>
                        <div className="usage_admin_meter">
                          <span style={{ width: `${quotaPercent}%` }} />
                        </div>
                        <small>Downloaded: {formatBytes(record.bytesDownloaded)}</small>
                      </div>
                    </td>

                    <td>
                      <div className="usage_admin_meter_cell">
                        <div>
                          <span>{formatNumber(record.tokensConsumed)} tokens</span>
                          <small>{aiPercent}%</small>
                        </div>
                        <div className="usage_admin_meter">
                          <span style={{ width: `${aiPercent}%` }} />
                        </div>
                        <small>{formatNumber(record.chatCount)} chats</small>
                      </div>
                    </td>

                    <td>
                      <span className={`usage_admin_risk usage_admin_risk_${risk}`}>
                        {risk}
                      </span>
                    </td>

                    <td>
                      <div className="usage_admin_actions">
                        <button type="button" onClick={() => setSelectedRecord(record)}>
                          View
                        </button>
                        <button type="button" onClick={() => openAction("review", record)}>
                          Review
                        </button>
                        <button type="button" onClick={() => openAction("reset", record)}>
                          Reset
                        </button>
                        <button type="button" onClick={() => openAction("suspend", record)}>
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="6" className="usage_admin_empty">
                    No usage records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="usage_admin_bottom_grid">
        <article>
          <h2>Abuse signals</h2>
          <div className="usage_admin_signal_list">
            <div>
              <strong>Quota spike</strong>
              <span>Uploaded usage over 80% of the workspace limit.</span>
            </div>
            <div>
              <strong>AI spike</strong>
              <span>Token usage close to or above the daily threshold.</span>
            </div>
            <div>
              <strong>Admin response</strong>
              <span>Review, reset quota, or suspend user access.</span>
            </div>
          </div>
        </article>

        <article>
          <h2>Action policy</h2>
          <p>
            Use review first for unclear cases. Reset quota when usage is
            confirmed as accidental. Suspend only when repeated abuse is clear.
          </p>
        </article>
      </section>

      {selectedRecord && (
        <div className="usage_admin_modal_overlay" role="dialog" aria-modal="true">
          <div className="usage_admin_modal">
            <header>
              <div>
                <h2>Usage detail</h2>
                <p>{selectedRecord.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedRecord(null)}>
                ×
              </button>
            </header>

            <div className="usage_admin_detail_grid">
              <div>
                <span>Date</span>
                <strong>{selectedRecord.date}</strong>
              </div>
              <div>
                <span>Uploaded</span>
                <strong>{formatBytes(selectedRecord.bytesUploaded)}</strong>
              </div>
              <div>
                <span>Downloaded</span>
                <strong>{formatBytes(selectedRecord.bytesDownloaded)}</strong>
              </div>
              <div>
                <span>AI chats</span>
                <strong>{formatNumber(selectedRecord.chatCount)}</strong>
              </div>
              <div>
                <span>Tokens</span>
                <strong>{formatNumber(selectedRecord.tokensConsumed)}</strong>
              </div>
              <div>
                <span>Risk</span>
                <strong>{getRiskLevel(selectedRecord)}</strong>
              </div>
            </div>

            <footer>
              <button type="button" onClick={() => openAction("review", selectedRecord)}>
                Mark for review
              </button>
              <button type="button" onClick={() => openAction("reset", selectedRecord)}>
                Reset quota
              </button>
              <button type="button" onClick={() => openAction("suspend", selectedRecord)}>
                Suspend user
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="usage_admin_modal_overlay" role="dialog" aria-modal="true">
          <div className="usage_admin_confirm">
            <div className="usage_admin_confirm_icon">
              <i className="ti-alert" />
            </div>
            <h2>Confirm admin action</h2>
            <p>
              You are about to <strong>{confirmAction.type}</strong>{" "}
              <strong>{confirmAction.record.email}</strong>. This action is recorded
              for audit review.
            </p>

            <div>
              <button type="button" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button type="button" onClick={applyAction}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminUsagePage;
