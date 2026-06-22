import { useEffect, useMemo, useState } from "react";
import { getModerationDocuments, reviewDocument } from "../../../../utils/adminApi";
import "./AIContentModerationPage.css";

const FILTERS = ["All", "Pending review", "Flagged", "Approved", "Quarantined"];

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}

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
      .toUpperCase() || "U"
  );
}

function getReason(document) {
  const reason = document.ai_reject_reason;
  if (!reason) return "No AI reason was stored for this document.";
  if (typeof reason === "string") return reason;
  return reason.reason || reason.error || JSON.stringify(reason);
}

function getSuspiciousContent(document) {
  const reason = document.ai_reject_reason;
  if (reason?.suspicious_text?.length) return reason.suspicious_text.join("\n");
  return document.admin_review_reason || "No suspicious text excerpt was stored.";
}

function getStatusLabel(status) {
  if (status === "APPROVED") return "Approved";
  if (status === "FLAGGED") return "Flagged";
  return "Pending review";
}

function getSeverity(status) {
  if (status === "FLAGGED" || status === "REJECTED") return "High";
  return "Medium";
}

function getSeverityClass(severity) {
  return severity.toLowerCase();
}

function AIContentModerationPage() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadCases() {
    try {
      setIsLoading(true);
      setError("");
      const data = await getModerationDocuments();
      setCases(data || []);
      setSelectedCaseId((data || [])[0]?.id || null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load moderation queue.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const selectedCase =
    cases.find((item) => item.id === selectedCaseId) || cases[0] || null;

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cases.filter((item) => {
      const uploaderName = getDisplayName(item.uploader);
      const matchesQuery =
        !normalizedQuery ||
        item.title?.toLowerCase().includes(normalizedQuery) ||
        uploaderName.toLowerCase().includes(normalizedQuery) ||
        item.uploader?.email?.toLowerCase().includes(normalizedQuery) ||
        item.status?.toLowerCase().includes(normalizedQuery);

      const statusLabel = getStatusLabel(item.status);
      const matchesStatus =
        statusFilter === "All" || statusLabel === statusFilter;
      const matchesSeverity =
        severityFilter === "All" || getSeverity(item.status) === severityFilter;

      return matchesQuery && matchesStatus && matchesSeverity;
    });
  }, [cases, query, statusFilter, severityFilter]);

  const stats = useMemo(() => {
    const flagged = cases.filter((item) => item.status === "FLAGGED").length;
    const pending = cases.filter((item) => item.status !== "APPROVED").length;
    const highRisk = cases.filter((item) => getSeverity(item.status) === "High").length;

    return [
      { label: "Flagged files", value: flagged, note: "Require admin action" },
      { label: "Pending review", value: pending, note: "Waiting for decision" },
      { label: "High risk", value: highRisk, note: "Prioritize these first" },
      { label: "AI confidence", value: "N/A", note: "Not stored in current schema" },
    ];
  }, [cases]);

  async function updateCaseStatus(id, nextStatus) {
    const decision = nextStatus === "Approved" ? "APPROVE" : "KEEP_REJECTED";

    try {
      await reviewDocument(id, decision, `${nextStatus} from admin moderation page.`);
      setCases((currentCases) => currentCases.filter((item) => item.id !== id));
      setSelectedCaseId((currentId) => {
        if (currentId !== id) return currentId;
        return cases.find((item) => item.id !== id)?.id || null;
      });
      setNotice(`Case ${id} marked as ${nextStatus.toLowerCase()}.`);
    } catch (err) {
      setNotice(err.response?.data?.message || "Could not save moderation decision.");
    }
  }

  return (
    <section className="ai-moderation-page">
      <header className="ai-moderation-page__hero">
        <div className="ai-moderation-page__hero-copy">
          <span className="ai-moderation-page__eyebrow">AI moderation desk</span>
          <h1>Review risky uploads before they reach students.</h1>
          <p>
            Inspect AI reason, suspicious content, uploader identity and document
            metadata in one admin workflow.
          </p>
        </div>

        <div className="ai-moderation-page__hero-panel">
          <span>Current queue</span>
          <strong>{cases.length} cases</strong>
          <p>{filteredCases.length} visible after filters</p>
          <button type="button" onClick={loadCases}>
            <i className="ti-reload"></i>
            Refresh queue
          </button>
        </div>
      </header>

      {isLoading && <div className="ai-moderation-page__notice">Loading moderation queue...</div>}
      {error && <div className="ai-moderation-page__notice">{error}</div>}
      {notice && (
        <div className="ai-moderation-page__notice">
          <i className="ti-check"></i>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}

      <div className="ai-moderation-page__stats-grid">
        {stats.map((item) => (
          <article key={item.label} className="ai-moderation-page__stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
          </article>
        ))}
      </div>

      <div className="ai-moderation-page__workbench">
        <main className="ai-moderation-page__queue-card">
          <div className="ai-moderation-page__queue-header">
            <div>
              <h2>Moderation queue</h2>
              <p>Search and filter flagged documents before taking action.</p>
            </div>

            <div className="ai-moderation-page__filters">
              <label className="ai-moderation-page__search-box">
                <i className="ti-search"></i>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search document, uploader or status..."
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {FILTERS.map((filter) => (
                  <option key={filter}>{filter}</option>
                ))}
              </select>

              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option>All</option>
                <option>High</option>
                <option>Medium</option>
              </select>
            </div>
          </div>

          <div className="ai-moderation-page__case-list">
            {filteredCases.length > 0 ? (
              filteredCases.map((item) => {
                const severity = getSeverity(item.status);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`ai-moderation-page__case-row ${
                      selectedCase?.id === item.id ? "is-selected" : ""
                    }`}
                    onClick={() => setSelectedCaseId(item.id)}
                  >
                    <span className="ai-moderation-page__file-icon">
                      <i className="ti-file"></i>
                    </span>

                    <span className="ai-moderation-page__case-main">
                      <strong>{item.title}</strong>
                      <small>{getDisplayName(item.uploader)} · {formatDate(item.created_at)}</small>
                    </span>

                    <span className={`ai-moderation-page__severity ${getSeverityClass(severity)}`}>
                      {severity}
                    </span>

                    <span className="ai-moderation-page__confidence">N/A</span>

                    <span className="ai-moderation-page__status-pill">
                      {getStatusLabel(item.status)}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="ai-moderation-page__empty-state">
                <i className="ti-shield"></i>
                <h3>No cases match your filters</h3>
                <p>Try another keyword, status or severity level.</p>
              </div>
            )}
          </div>
        </main>

        <aside className="ai-moderation-page__detail-panel">
          {selectedCase ? (
            <>
              <div className="ai-moderation-page__detail-top">
                <div>
                  <span>{selectedCase.id}</span>
                  <h2>{selectedCase.title}</h2>
                </div>
                <span className={`ai-moderation-page__severity ${getSeverityClass(getSeverity(selectedCase.status))}`}>
                  {getSeverity(selectedCase.status)}
                </span>
              </div>

              <section className="ai-moderation-page__reason-card">
                <h3>AI reason</h3>
                <p>{getReason(selectedCase)}</p>
              </section>

              <section className="ai-moderation-page__reason-card warning">
                <h3>Suspicious content</h3>
                <p>{getSuspiciousContent(selectedCase)}</p>
              </section>

              <section className="ai-moderation-page__metadata-card">
                <h3>Uploader</h3>
                <div className="ai-moderation-page__uploader-card">
                  <span>{getInitials(getDisplayName(selectedCase.uploader))}</span>
                  <div>
                    <strong>{getDisplayName(selectedCase.uploader)}</strong>
                    <p>{selectedCase.uploader?.email || "No email"}</p>
                    <small>{selectedCase.uploader?.username || "No username"}</small>
                  </div>
                </div>
              </section>

              <section className="ai-moderation-page__metadata-card">
                <h3>Document metadata</h3>
                <div className="ai-moderation-page__meta-grid">
                  <div>
                    <span>Type</span>
                    <strong>{selectedCase.title?.split(".").pop()?.toUpperCase() || "File"}</strong>
                  </div>
                  <div>
                    <span>Size</span>
                    <strong>{formatBytes(selectedCase.file_size_bytes)}</strong>
                  </div>
                  <div>
                    <span>Public</span>
                    <strong>{selectedCase.is_public ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{selectedCase.status}</strong>
                  </div>
                  <div>
                    <span>Uploaded</span>
                    <strong>{formatDate(selectedCase.created_at)}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>N/A</strong>
                  </div>
                </div>
              </section>

              <div className="ai-moderation-page__decision-bar">
                <button
                  type="button"
                  className="approve"
                  onClick={() => updateCaseStatus(selectedCase.id, "Approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="flag"
                  onClick={() => updateCaseStatus(selectedCase.id, "Flagged")}
                >
                  Keep flagged
                </button>
              </div>
            </>
          ) : (
            <div className="ai-moderation-page__empty-state">
              <i className="ti-panel"></i>
              <h3>Select a case</h3>
              <p>Choose a flagged document to inspect details.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default AIContentModerationPage;
