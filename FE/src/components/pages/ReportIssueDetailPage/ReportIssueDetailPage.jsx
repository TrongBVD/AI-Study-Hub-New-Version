import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuCalendarDays,
  LuClock3,
  LuDownload,
  LuFileText,
  LuMessageSquareText,
  LuTag,
} from "react-icons/lu";
import { getMyIssue } from "../../../utils/issueApi";
import "./ReportIssueDetailPage.css";
import "./ReportIssueDetailOverrides.css";

const categoryLabels = {
  LIBRARY: "Library",
  WORKSPACE: "Workspace",
  DISCOVERY: "Discovery",
  AI_CHATBOT: "AI chatbot",
  OTHER: "Other",
};

const statusLabels = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ReportIssueDetailPage() {
  const { issueId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMyIssue(issueId)
      .then((data) => { if (active) setReport(data); })
      .catch((err) => { if (active) setError(err.response?.status === 404 ? "This report does not exist or you do not have access to it." : "Could not load this report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [issueId]);

  if (loading) return <main className="report-detail"><div className="report-detail__state">Loading report…</div></main>;
  if (error || !report) return <main className="report-detail"><div className="report-detail__state"><h1>Report unavailable</h1><p>{error}</p><Link to="/dashboard/report-issue"><LuArrowLeft /> Back to my reports</Link></div></main>;

  return (
    <main className="report-detail">
      <div className="report-detail__shell">
        <Link className="report-detail__back" to="/dashboard/report-issue"><LuArrowLeft /> Back to my reports</Link>

        <header className="report-detail__header">
          <div>
            <span>Support request</span>
            <h1>{report.title}</h1>
            <p>Report ID: {report.id}</p>
          </div>
        </header>

        <div className="report-detail__layout">
          <div className="report-detail__main">
            <section className="report-detail__card">
              <h2>Issue description</h2>
              <p className="report-detail__description">{report.description}</p>
            </section>

            <section className="report-detail__card">
              <div className="report-detail__section-heading"><div><h2>Attachments</h2><p>Files included with this report</p></div><span>{report.attachments?.length || 0}</span></div>
              {report.attachments?.length ? <div className="report-detail__files">{report.attachments.map((file) => <a href={file.url} target="_blank" rel="noreferrer" key={file.id || file.storage_path}><LuFileText /><span><strong>{file.file_name}</strong><small>{formatSize(file.file_size)} · {file.mime_type}</small></span><LuDownload /></a>)}</div> : <p className="report-detail__muted">No files were attached.</p>}
            </section>

            <section className="report-detail__card report-detail__response">
              <div className="report-detail__response-icon"><LuMessageSquareText /></div>
              <div><h2>Admin response</h2>{report.admin_note ? <p>{report.admin_note}</p> : <p className="report-detail__muted">The support team has not responded yet.</p>}</div>
            </section>
          </div>

          <aside className="report-detail__card report-detail__meta">
            <h2>Report details</h2>
            <dl>
              <div className="report-detail__status-row"><dt><LuClock3 /> Status</dt><dd><span className={`report-detail__status ${report.status.toLowerCase()}`}>{statusLabels[report.status] || report.status}</span></dd></div>
              <div><dt><LuTag /> Category</dt><dd>{categoryLabels[report.category] || report.category}</dd></div>
              <div><dt><LuCalendarDays /> Submitted</dt><dd>{formatDate(report.created_at)}</dd></div>
              <div><dt><LuClock3 /> Last updated</dt><dd>{formatDate(report.updated_at)}</dd></div>
              {report.resolved_at && <div><dt><LuClock3 /> Resolved</dt><dd>{formatDate(report.resolved_at)}</dd></div>}
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
