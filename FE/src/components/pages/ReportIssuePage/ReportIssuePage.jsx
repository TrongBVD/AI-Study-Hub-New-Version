import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuCheck,
  LuChevronDown,
  LuCircleHelp,
  LuClock3,
  LuFileText,
  LuImage,
  LuPaperclip,
  LuSend,
  LuUpload,
  LuX,
} from "react-icons/lu";
import { getMyIssues, submitIssue } from "../../../utils/issueApi";
import "./ReportIssuePage.css";
import "./ReportIssueUpload.css";
import "./ReportIssueSelect.css";

const categoryLabels = {
  LIBRARY: "Library",
  WORKSPACE: "Workspace",
  DISCOVERY: "Discovery",
  AI_CHATBOT: "AI chatbot",
  OTHER: "Other",
};

const DEFAULT_CATEGORY = Object.keys(categoryLabels)[0];

function CategorySelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!selectRef.current?.contains(event.target)) setIsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="report-issue__category-select" ref={selectRef}>
      <button
        type="button"
        className={isOpen ? "is-open" : ""}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{categoryLabels[value]}</span>
        <LuChevronDown aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="report-issue__category-menu" role="listbox">
          {Object.entries(categoryLabels).map(([categoryValue, label]) => {
            const isSelected = categoryValue === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={isSelected ? "is-selected" : ""}
                key={categoryValue}
                onClick={() => {
                  onChange(categoryValue);
                  setIsOpen(false);
                }}
              >
                <span>{label}</span>
                {isSelected && <LuCheck aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    category: DEFAULT_CATEGORY,
    title: "",
    description: "",
    pagePath: window.location.pathname,
  });
  const [reports, setReports] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(fileList) {
    const accepted = Array.from(fileList || []);
    if (accepted.some((file) => file.size > 50 * 1024 * 1024)) {
      setError("The total attachment size must not exceed 50 MB.");
      return;
    }
    setAttachments((current) => {
      const unique = accepted.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size));
      const candidates = [...current, ...unique].slice(0, 5);
      const totalSize = candidates.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > 50 * 1024 * 1024) {
        setError("The total attachment size must not exceed 50 MB.");
        return current;
      }
      setError("");
      return candidates;
    });
  }

  useEffect(() => {
    getMyIssues()
      .then(setReports)
      .catch(() => setError("Could not load your reports."));
  }, []);

  async function submit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const report = await submitIssue(form, attachments);
      setReports((items) => [report, ...items]);
      setNotice(
        "Your report has been submitted. Thank you for helping us improve.",
      );
      setForm({
        category: DEFAULT_CATEGORY,
        title: "",
        description: "",
        pagePath: window.location.pathname,
      });
      setAttachments([]);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="report-issue">
      <header className="report-issue__header">
        <div className="report-issue__heading-icon"><LuCircleHelp /></div>
        <div>
          <span>Help & support</span>
          <h1>Report an issue</h1>
          <p>Tell us what went wrong. Our team will review your report and keep you updated here.</p>
        </div>
      </header>

      {notice && (
        <div className="report-issue__alert success">
          {notice}<button type="button" onClick={() => setNotice("")}><LuX /></button>
        </div>
      )}
      {error && (
        <div className="report-issue__alert error">
          {error}<button type="button" onClick={() => setError("")}><LuX /></button>
        </div>
      )}

      <div className="report-issue__grid">
        <section className="report-issue__card">
          <div className="report-issue__card-heading">
            <div>
              <h2>Issue details</h2>
              <p>Please include enough detail for us to reproduce the problem.</p>
            </div>
            <span>Required fields *</span>
          </div>

          <form onSubmit={submit}>
            <div className="report-issue__form-row">
              <div className="report-issue__field">
                <span>Category</span>
                <CategorySelect
                  value={form.category}
                  onChange={(category) => setForm({ ...form, category })}
                />
              </div>
              <label>
                Title
                <input required minLength="5" maxLength="150" placeholder="A short summary of the problem" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </label>
            </div>

            <label>
              Describe the issue
              <textarea required minLength="20" maxLength="5000" placeholder="What happened? What did you expect to happen?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <div className="report-issue__field">
              <div className="report-issue__upload-heading">
                <span>Attachments</span>
                <small>Optional · up to 5 files, 50 MB total</small>
              </div>
              <input ref={fileInputRef} className="report-issue__file-input" type="file" multiple accept="image/*,.svg,.pdf,.doc,.docx,.txt" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
              <button type="button" className={`report-issue__dropzone ${dragging ? "is-dragging" : ""}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
                <span className="report-issue__upload-icon"><LuUpload aria-hidden="true" /></span>
                <span className="report-issue__upload-copy">
                  <strong>Drop your files here</strong>
                  <small>or <b>browse from your device</b></small>
                </span>
                <span className="report-issue__upload-types">PNG, JPG, WEBP, SVG, PDF, DOC, DOCX or TXT</span>
              </button>
              {!!attachments.length && <div className="report-issue__attachment-list">
                {attachments.map((file, index) => <div key={`${file.name}-${file.size}`}>
                  {file.type.startsWith("image/") ? <LuImage /> : <LuPaperclip />}
                  <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}><LuX /></button>
                </div>)}
              </div>}
            </div>

            <div className="report-issue__form-footer">
              <span>Your report is visible only to you and system administrators.</span>
              <button type="submit" disabled={submitting}><LuSend /> {submitting ? "Sending…" : "Submit report"}</button>
            </div>
          </form>
        </section>

        <aside className="report-issue__tips">
          <LuFileText />
          <h2>Helpful reports include</h2>
          <ul>
            <li>What you were trying to do</li>
            <li>What happened instead</li>
            <li>Steps we can follow to reproduce it</li>
          </ul>
          <p>Do not include passwords, access tokens, or other sensitive information.</p>
        </aside>
      </div>

      <section className="report-issue__history">
        <div className="report-issue__history-heading">
          <div><h2>My reports</h2><p>Track the status and any response from the support team.</p></div>
          <span>{reports.length} total</span>
        </div>

        {reports.length ? (
          <div className="report-issue__reports">
            {reports.map((report) => (
              <article key={report.id} role="link" tabIndex="0" onClick={() => navigate(`/dashboard/report-issue/${report.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/dashboard/report-issue/${report.id}`); }}>
                <div className="report-issue__report-icon"><LuFileText /></div>
                <div>
                  <strong>{report.title}</strong>
                  <p>{categoryLabels[report.category] || report.category} · Submitted {new Date(report.created_at).toLocaleDateString()}</p>
                  {report.admin_note && <small>Admin response: {report.admin_note}</small>}
                </div>
                <span className={`report-issue__status ${report.status.toLowerCase()}`}>{report.status.replace("_", " ")}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="report-issue__empty">
            <LuClock3 />
            <div><h3>No reports submitted yet</h3><p>Your submitted reports and updates from the team will appear here.</p></div>
          </div>
        )}
      </section>
    </main>
  );
}
