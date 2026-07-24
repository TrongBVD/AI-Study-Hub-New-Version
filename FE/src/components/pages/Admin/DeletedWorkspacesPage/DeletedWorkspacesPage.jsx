import { useEffect, useState } from "react";
import { getDeletedWorkspaces, getWorkspacePurgePreview, permanentlyDeleteWorkspace } from "../../../../utils/adminApi";
import "./DeletedWorkspacesPage.css";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function DeletedWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadWorkspaces() {
    try {
      setLoading(true); setError("");
      setWorkspaces(await getDeletedWorkspaces());
    } catch (err) { setError(err.response?.data?.message || "Could not load deleted workspaces."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // Initial network load intentionally updates the page state after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspaces();
  }, []);

  async function openPreview(workspace) {
    try {
      setActionLoading(true); setError(""); setSelected(workspace); setConfirmation("");
      setPreview(await getWorkspacePurgePreview(workspace.id));
    } catch (err) { setSelected(null); setError(err.response?.data?.message || "Could not load purge preview."); }
    finally { setActionLoading(false); }
  }
  async function purge() {
    if (!selected) return;
    try {
      setActionLoading(true); setError("");
      const result = await permanentlyDeleteWorkspace(selected.id, confirmation);
      setWorkspaces((items) => items.filter((item) => item.id !== selected.id));
      setNotice(`Workspace permanently deleted. ${formatBytes(result.bytesFreed)} reclaimed.`);
      setSelected(null); setPreview(null);
    } catch (err) { setError(err.response?.data?.message || "Could not permanently delete workspace."); }
    finally { setActionLoading(false); }
  }

  return <main className="deleted_workspaces_page">
    <header><div><span>System administration</span><h1>Deleted workspaces</h1><p>Review soft-deleted workspaces before permanently removing their workspace-only data.</p></div><button onClick={loadWorkspaces} disabled={loading}>Refresh</button></header>
    {error && <div className="deleted_workspace_error">{error}</div>}
    {notice && <div className="deleted_workspace_notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <section className="deleted_workspace_panel"><div className="deleted_workspace_intro"><h2>Purge queue</h2><p>Files in personal libraries are preserved and detached from the workspace.</p></div>
      {loading ? <div className="deleted_workspace_empty">Loading deleted workspaces…</div> : workspaces.length === 0 ? <div className="deleted_workspace_empty">There are no soft-deleted workspaces to review.</div> : <div className="deleted_workspace_table"><table><thead><tr><th>Workspace</th><th>Deleted</th><th>Documents</th><th>Reclaimable storage</th><th /></tr></thead><tbody>{workspaces.map((workspace) => <tr key={workspace.id}><td><strong>{workspace.name}</strong><small>{workspace.description || "No description"}</small></td><td>{new Date(workspace.deleted_at).toLocaleString()}</td><td>{workspace.documentCount} total · {workspace.preservedDocumentCount} preserved</td><td>{formatBytes(workspace.reclaimableBytes)}</td><td><button className="deleted_workspace_danger" onClick={() => openPreview(workspace)} disabled={actionLoading}>Review purge</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected && preview && <div className="deleted_workspace_overlay" role="dialog" aria-modal="true"><section className="deleted_workspace_modal"><button className="deleted_workspace_close" onClick={() => { setSelected(null); setPreview(null); }}>×</button><span>Irreversible action</span><h2>Permanently delete “{selected.name}”?</h2><p>This removes the workspace and its workspace-only data. Personal Library documents will remain available.</p><div className="deleted_workspace_stats"><div><strong>{preview.deletion.documents}</strong><small>documents removed</small></div><div><strong>{formatBytes(preview.deletion.reclaimableBytes)}</strong><small>storage reclaimed</small></div><div><strong>{preview.preservation.documents}</strong><small>documents preserved</small></div></div><details><summary>View deletion preview</summary><ul>{Object.entries(preview.deletion).filter(([key]) => key !== "reclaimableBytes").map(([key, value]) => <li key={key}>{key}: <strong>{value}</strong></li>)}</ul>{preview.preservation.documentList.length > 0 && <><h3>Personal Library documents preserved</h3><ul>{preview.preservation.documentList.map((document) => <li key={document.id}>{document.title}</li>)}</ul></>}</details><label>Type <strong>{selected.name}</strong> exactly to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><div className="deleted_workspace_actions"><button onClick={() => { setSelected(null); setPreview(null); }}>Cancel</button><button className="deleted_workspace_danger" onClick={purge} disabled={actionLoading || confirmation !== selected.name}>{actionLoading ? "Deleting…" : "Permanently delete"}</button></div></section></div>}
  </main>;
}

export default DeletedWorkspacesPage;
