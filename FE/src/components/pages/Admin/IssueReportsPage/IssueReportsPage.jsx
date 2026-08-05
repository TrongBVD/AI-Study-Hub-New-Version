import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCheck,
  LuChevronDown,
  LuCircleAlert,
  LuFilter,
  LuDownload,
  LuFileText,
  LuSearch,
  LuSlidersHorizontal,
  LuX,
} from "react-icons/lu";
import { getAdminIssues, updateAdminIssue } from "../../../../utils/adminApi";
import "./IssueReportsPage.css";
import "./IssueReportsOverrides.css";

const statuses = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"];
const categories = [
  "ALL",
  "LIBRARY",
  "WORKSPACE",
  "DISCOVERY",
  "AI_CHATBOT",
  "OTHER",
];
const labels = {
  IN_PROGRESS: "In progress",
  OPEN: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};
const categoryLabels = {
  ALL: "All categories",
  LIBRARY: "Library",
  WORKSPACE: "Workspace",
  DISCOVERY: "Discovery",
  AI_CHATBOT: "AI chatbot",
  OTHER: "Other",
};

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size)) return "Unknown size";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function IssueSelect({
  value,
  options,
  getLabel = (option) => option,
  onChange,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div
      className={`admin-issues__select ${open ? "is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="admin-issues__select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{getLabel(value)}</span>
        <LuChevronDown />
      </button>
      {open && (
        <div
          className="admin-issues__select-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option === value}
              className={option === value ? "is-selected" : ""}
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{getLabel(option)}</span>
              {option === value && <LuCheck />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IssueReportsPage() {
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({
    status: "ALL",
    category: "ALL",
    search: "",
  });
  async function load() {
    try {
      setLoading(true);
      setError("");
      setIssues(await getAdminIssues());
    } catch {
      setError("Could not load issue reports.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const filtered = useMemo(
    () =>
      issues.filter(
        (item) =>
          (filter.status === "ALL" || item.status === filter.status) &&
          (filter.category === "ALL" || item.category === filter.category) &&
          (!filter.search ||
            `${item.title} ${item.description} ${item.reporter?.full_name || ""} ${item.reporter?.email || ""}`
              .toLowerCase()
              .includes(filter.search.toLowerCase())),
      ),
    [issues, filter],
  );
  async function save(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const updated = await updateAdminIssue(selected.id, {
        status: selected.status,
        adminNote: selected.admin_note || "",
      });
      setIssues((items) =>
        items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setSelected(null);
      setError("");
      setNotice("Issue report updated.");
    } catch (err) {
      setNotice("");
      setError(err.response?.data?.message || "Could not save issue report.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="admin-issues">
      <header className="admin-issues__header">
        <div>
          <span>Support management</span>
          <h1>Issue reports</h1>
          <p>
            Review incoming reports and share progress with reporters.
          </p>
        </div>
        <div className="admin-issues__count">
          <LuCircleAlert />
          <strong>
            {issues.filter((item) => item.status === "OPEN").length}
          </strong>
          <span>open reports</span>
        </div>
      </header>
      {error && (
        <div className="admin-issues__alert error">
          {error}
          <button onClick={() => setError("")}>
            <LuX />
          </button>
        </div>
      )}
      {notice && (
        <div className="admin-issues__alert success">
          {notice}
          <button onClick={() => setNotice("")}>
            <LuX />
          </button>
        </div>
      )}
      <section className="admin-issues__panel">
        <div className="admin-issues__toolbar">
          <div className="admin-issues__tabs">
            {statuses.map((status) => (
              <button
                className={filter.status === status ? "active" : ""}
                key={status}
                onClick={() => setFilter({ ...filter, status })}
              >
                {status === "ALL" ? "All" : labels[status]}
              </button>
            ))}
          </div>
          <div className="admin-issues__controls">
            <label>
              <LuSearch />
              <input
                value={filter.search}
                onChange={(e) =>
                  setFilter({ ...filter, search: e.target.value })
                }
                placeholder="Search reports"
              />
            </label>
            <div className="admin-issues__category-filter">
              <IssueSelect
                ariaLabel="Filter by category"
                value={filter.category}
                options={categories}
                getLabel={(category) => categoryLabels[category] || category}
                onChange={(category) => setFilter({ ...filter, category })}
              />
            </div>
          </div>
        </div>
        {loading ? (
          <div className="admin-issues__empty">Loading reports…</div>
        ) : !filtered.length ? (
          <div className="admin-issues__empty">
            <LuFilter />
            <h2>No matching reports</h2>
            <p>Adjust your filters or wait for new reports to arrive.</p>
          </div>
        ) : (
          <div className="admin-issues__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Reporter</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((issue) => (
                  <tr
                    key={issue.id}
                    className={selected?.id === issue.id ? "selected" : ""}
                    onClick={() => setSelected({ ...issue })}
                  >
                    <td>
                      <strong>{issue.title}</strong>
                      <small>
                        {new Date(issue.created_at).toLocaleDateString()}
                      </small>
                    </td>
                    <td>
                      {issue.reporter?.full_name ||
                        issue.reporter?.username ||
                        "Unknown"}
                      <small>{issue.reporter?.email}</small>
                    </td>
                    <td>
                      <span className="admin-issues__category">
                        {issue.category}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-issues__status ${issue.status.toLowerCase()}`}
                      >
                        {labels[issue.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="admin-issues__manage"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ ...issue });
                        }}
                      >
                        <LuSlidersHorizontal /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <div className="admin-issues__overlay" role="dialog" aria-modal="true">
          <form className="admin-issues__drawer" onSubmit={save}>
            <header>
              <div>
                <span>Issue report</span>
                <h2>{selected.title}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                <LuX />
              </button>
            </header>
            <div className="admin-issues__drawer-scroll">
            <div className="admin-issues__reporter">
              <strong>
                {selected.reporter?.full_name ||
                  selected.reporter?.username ||
                  "Unknown reporter"}
              </strong>
              <span>{selected.reporter?.email || "No email available"}</span>
            </div>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{selected.category}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{new Date(selected.created_at).toLocaleString()}</dd>
              </div>
            </dl>
            <section>
              <h3>Description</h3>
              <p>{selected.description}</p>
            </section>
            <section className="admin-issues__attachments-section">
              <div className="admin-issues__attachments-heading">
                <div>
                  <h3>User attachments</h3>
                  <p>Files submitted with this report</p>
                </div>
                <span>{selected.attachments?.length || 0}</span>
              </div>
              {selected.attachments?.length ? (
                <div className="admin-issues__attachments-list">
                  {selected.attachments.map((attachment) => (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      key={attachment.id || attachment.storage_path}
                    >
                      <span className="admin-issues__attachment-icon"><LuFileText /></span>
                      <span className="admin-issues__attachment-copy">
                        <strong>{attachment.file_name}</strong>
                        <small>{formatFileSize(attachment.file_size)} · {attachment.mime_type}</small>
                      </span>
                      <span className="admin-issues__attachment-action"><LuDownload /></span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="admin-issues__attachments-empty">No attachments were submitted.</p>
              )}
            </section>
            <div className="admin-issues__edit-row admin-issues__edit-row--single">
              <label>
                Status
                <IssueSelect
                  ariaLabel="Select status"
                  value={selected.status}
                  options={statuses.slice(1)}
                  getLabel={(status) => labels[status]}
                  onChange={(status) => setSelected({ ...selected, status })}
                />
              </label>
            </div>
            <label className="admin-issues__note">
              Admin response
              <textarea
                value={selected.admin_note || ""}
                placeholder="Share an update or resolution with the reporter…"
                onChange={(e) =>
                  setSelected({ ...selected, admin_note: e.target.value })
                }
              />
            </label>
            </div>
            <footer>
              <button type="button" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button className="save" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
