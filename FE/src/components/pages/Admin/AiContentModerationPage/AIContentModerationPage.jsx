
import { useMemo, useState } from "react";

import "./AIContentModerationPage.css";

const INITIAL_CASES = [
  {
    id: "MOD-2401",
    documentName: "Quantum_Mechanics_Draft.pdf",
    documentType: "PDF",
    size: "2.4 MB",
    uploadedAt: "2026-06-16 09:42",
    library: "Physics Research",
    workspace: "Science Group A",
    uploader: {
      name: "Dr. Aris Thorne",
      email: "aris.thorne@studyhub.edu",
      role: "Teacher",
    },
    flagType: "AI-generated",
    severity: "Medium",
    confidence: 85,
    status: "Pending review",
    aiReason:
      "The text has repeated sentence patterns, low citation density, and a generated-style summary block near the conclusion.",
    suspiciousContent:
      "The conclusion contains broad claims without source references and repeats the same technical phrasing across multiple paragraphs.",
  },
  {
    id: "MOD-2402",
    documentName: "Medical_Ethics_Case_Study.docx",
    documentType: "DOCX",
    size: "1.1 MB",
    uploadedAt: "2026-06-16 10:18",
    library: "Healthcare Ethics",
    workspace: "Bioethics Review",
    uploader: {
      name: "Elena Rossi",
      email: "elena.rossi@studyhub.edu",
      role: "Student",
    },
    flagType: "Restricted keywords",
    severity: "High",
    confidence: 98,
    status: "Flagged",
    aiReason:
      "The file contains restricted medical terms and multiple instruction-like paragraphs that require manual review.",
    suspiciousContent:
      "Several paragraphs include sensitive clinical wording and should be checked before the document is shared with other users.",
  },
  {
    id: "MOD-2403",
    documentName: "Internal_Research_Archive.zip",
    documentType: "ZIP",
    size: "18.7 MB",
    uploadedAt: "2026-06-16 11:07",
    library: "Research Archive",
    workspace: "Private Research Hub",
    uploader: {
      name: "Anonymous User",
      email: "hidden.account@studyhub.edu",
      role: "Member",
    },
    flagType: "Copyright risk",
    severity: "Medium",
    confidence: 72,
    status: "Pending review",
    aiReason:
      "The archive includes documents with publisher-style naming and missing uploader ownership metadata.",
    suspiciousContent:
      "The file list contains scanned chapter names and bundled source materials that may not belong to the uploader.",
  },
  {
    id: "MOD-2404",
    documentName: "Assignment_Solution_Set_Final.pdf",
    documentType: "PDF",
    size: "920 KB",
    uploadedAt: "2026-06-16 12:21",
    library: "Math Practice",
    workspace: "Calculus Batch 02",
    uploader: {
      name: "Mina Park",
      email: "mina.park@studyhub.edu",
      role: "Student",
    },
    flagType: "Answer leakage",
    severity: "High",
    confidence: 91,
    status: "Flagged",
    aiReason:
      "The document resembles an answer key and contains final answers without supporting explanation or author notes.",
    suspiciousContent:
      "The file title and content suggest it may reveal assignment answers before the class deadline.",
  },
];

const FILTERS = ["All", "Pending review", "Flagged", "Approved", "Quarantined"];

function getSeverityClass(severity) {
  return severity.toLowerCase();
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AIContentModerationPage() {
  const [cases, setCases] = useState(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState(INITIAL_CASES[0]?.id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [notice, setNotice] = useState("");

  const selectedCase =
    cases.find((item) => item.id === selectedCaseId) || cases[0] || null;

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.documentName.toLowerCase().includes(normalizedQuery) ||
        item.uploader.name.toLowerCase().includes(normalizedQuery) ||
        item.uploader.email.toLowerCase().includes(normalizedQuery) ||
        item.flagType.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;
      const matchesSeverity =
        severityFilter === "All" || item.severity === severityFilter;

      return matchesQuery && matchesStatus && matchesSeverity;
    });
  }, [cases, query, statusFilter, severityFilter]);

  const stats = useMemo(() => {
    const flagged = cases.filter((item) => item.status === "Flagged").length;
    const pending = cases.filter((item) => item.status === "Pending review").length;
    const highRisk = cases.filter((item) => item.severity === "High").length;
    const averageConfidence = Math.round(
      cases.reduce((total, item) => total + item.confidence, 0) / cases.length
    );

    return [
      { label: "Flagged files", value: flagged, note: "Require admin action" },
      { label: "Pending review", value: pending, note: "Waiting for decision" },
      { label: "High risk", value: highRisk, note: "Prioritize these first" },
      { label: "AI confidence", value: `${averageConfidence}%`, note: "Average detection score" },
    ];
  }, [cases]);

  function updateCaseStatus(id, nextStatus) {
    setCases((currentCases) =>
      currentCases.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item
      )
    );
    setSelectedCaseId(id);
    setNotice(`Case ${id} marked as ${nextStatus.toLowerCase()}.`);
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
          <button type="button" onClick={() => setNotice("Moderation queue refreshed.")}> 
            <i className="ti-reload"></i>
            Refresh queue
          </button>
        </div>
      </header>

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
                  placeholder="Search document, uploader or flag..."
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
              filteredCases.map((item) => (
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
                    <strong>{item.documentName}</strong>
                    <small>{item.uploader.name} · {item.uploadedAt}</small>
                  </span>

                  <span className={`ai-moderation-page__severity ${getSeverityClass(item.severity)}`}>
                    {item.severity}
                  </span>

                  <span className="ai-moderation-page__confidence">
                    {item.confidence}%
                  </span>

                  <span className="ai-moderation-page__status-pill">
                    {item.status}
                  </span>
                </button>
              ))
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
                  <h2>{selectedCase.documentName}</h2>
                </div>
                <span className={`ai-moderation-page__severity ${getSeverityClass(selectedCase.severity)}`}>
                  {selectedCase.severity}
                </span>
              </div>

              <section className="ai-moderation-page__reason-card">
                <h3>AI reason</h3>
                <p>{selectedCase.aiReason}</p>
              </section>

              <section className="ai-moderation-page__reason-card warning">
                <h3>Suspicious content</h3>
                <p>{selectedCase.suspiciousContent}</p>
              </section>

              <section className="ai-moderation-page__metadata-card">
                <h3>Uploader</h3>
                <div className="ai-moderation-page__uploader-card">
                  <span>{getInitials(selectedCase.uploader.name)}</span>
                  <div>
                    <strong>{selectedCase.uploader.name}</strong>
                    <p>{selectedCase.uploader.email}</p>
                    <small>{selectedCase.uploader.role}</small>
                  </div>
                </div>
              </section>

              <section className="ai-moderation-page__metadata-card">
                <h3>Document metadata</h3>
                <div className="ai-moderation-page__meta-grid">
                  <div>
                    <span>Type</span>
                    <strong>{selectedCase.documentType}</strong>
                  </div>
                  <div>
                    <span>Size</span>
                    <strong>{selectedCase.size}</strong>
                  </div>
                  <div>
                    <span>Library</span>
                    <strong>{selectedCase.library}</strong>
                  </div>
                  <div>
                    <span>Workspace</span>
                    <strong>{selectedCase.workspace}</strong>
                  </div>
                  <div>
                    <span>Uploaded</span>
                    <strong>{selectedCase.uploadedAt}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{selectedCase.confidence}%</strong>
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
                  className="quarantine"
                  onClick={() => updateCaseStatus(selectedCase.id, "Quarantined")}
                >
                  Quarantine
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
