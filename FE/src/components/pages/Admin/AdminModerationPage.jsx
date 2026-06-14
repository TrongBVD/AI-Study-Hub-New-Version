import { useEffect, useState } from "react";
import {
  getModerationDocuments,
  reviewDocument,
} from "../../../utils/adminApi";
import "./Admin.css";

function getReasonText(reason) {
  if (!reason) return "N/A";

  if (typeof reason === "string") {
    return reason;
  }

  return reason.reason || reason.message || JSON.stringify(reason);
}

function AdminModerationPage() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState("");

  async function loadDocuments() {
    try {
      setError("");
      const data = await getModerationDocuments();
      setDocuments(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load moderation list.");
    }
  }

useEffect(() => {
  async function initialLoad() {
    try {
      setError("");
      const data = await getModerationDocuments();
      setDocuments(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load moderation list.");
    }
  }

  initialLoad();
}, []);

  async function handleReview(documentId, decision) {
    const reason = window.prompt("Enter admin review reason:");

    if (!reason || !reason.trim()) {
      return;
    }

    try {
      setLoadingId(documentId);
      await reviewDocument(documentId, decision, reason.trim());
      await loadDocuments();
    } catch (err) {
      alert(err.response?.data?.message || "Review failed.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <div className="admin_page">
      <div className="admin_header">
        <h1>AI Moderation Review</h1>
        <p>Review documents that AI rejected, flagged, or failed to process.</p>
      </div>

      {error && <div className="admin_error">{error}</div>}

      <div className="admin_panel">
        <div className="admin_table_wrapper">
          <table className="admin_table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Uploader</th>
                <th>Status</th>
                <th>AI Reason</th>
                <th>Created At</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.title}</td>

                  <td>
                    {doc.uploader?.email ||
                      doc.uploader?.username ||
                      doc.uploader_id}
                  </td>

                  <td>
                    <span
                      className={`admin_status ${String(doc.status || "")
                        .toLowerCase()
                        .replace("-", "_")}`}
                    >
                      {doc.status}
                    </span>
                  </td>

                  <td>{getReasonText(doc.ai_reject_reason)}</td>

                  <td>
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleString()
                      : "N/A"}
                  </td>

                  <td>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </td>

                  <td>
                    <div className="admin_actions">
                      <button
                        className="admin_button"
                        disabled={loadingId === doc.id}
                        onClick={() => handleReview(doc.id, "APPROVE")}
                      >
                        Approve
                      </button>

                      <button
                        className="admin_button secondary"
                        disabled={loadingId === doc.id}
                        onClick={() => handleReview(doc.id, "KEEP_REJECTED")}
                      >
                        Keep Rejected
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {documents.length === 0 && (
                <tr>
                  <td colSpan="7" className="admin_empty">
                    No documents need moderation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminModerationPage;