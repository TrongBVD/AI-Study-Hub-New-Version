import { useEffect, useState } from "react";
import { LuArchiveRestore, LuFileText, LuRefreshCw, LuShieldAlert, LuTrash2, LuX } from "react-icons/lu";
import { getDeletedWorkspaces, permanentlyDeleteWorkspace, restoreWorkspace } from "../../../../utils/adminApi";
import "./DeletedWorkspacesPage.css";

function DeletedWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() { try { setLoading(true); setError(""); setWorkspaces(await getDeletedWorkspaces()); } catch (err) { setError(err.response?.data?.message || "Could not load deleted workspaces."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function restore() { try { setBusy(true); await restoreWorkspace(restoreTarget.id); setWorkspaces((items) => items.filter((item) => item.id !== restoreTarget.id)); setNotice("Workspace restored successfully."); setRestoreTarget(null); } catch (err) { setError(err.response?.data?.message || "Could not restore workspace."); } finally { setBusy(false); } }
  async function purge() { try { setBusy(true); await permanentlyDeleteWorkspace(selected.id, confirmation); setWorkspaces((items) => items.filter((item) => item.id !== selected.id)); setNotice("Workspace permanently deleted."); setSelected(null); } catch (err) { setError(err.response?.data?.message || "Could not permanently delete workspace."); } finally { setBusy(false); } }

  return <main className="deleted-workspaces">
    <header className="deleted-workspaces__header"><div><span className="deleted-workspaces__eyebrow">System administration</span><h1>Deleted workspaces</h1><p>Restore access to a workspace, or permanently remove it when it is no longer needed.</p></div><button className="deleted-workspaces__refresh" onClick={load} disabled={loading}><LuRefreshCw className={loading ? "is-spinning" : ""} /> Refresh</button></header>
    {error && <div className="deleted-workspaces__alert is-error">{error}<button onClick={() => setError("")}><LuX /></button></div>}
    {notice && <div className="deleted-workspaces__alert is-success">{notice}<button onClick={() => setNotice("")}><LuX /></button></div>}
    <section className="deleted-workspaces__panel"><div className="deleted-workspaces__panel-heading"><div className="deleted-workspaces__icon"><LuTrash2 /></div><div><h2>Recovery queue</h2><p>{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} awaiting review</p></div></div>
      {loading ? <div className="deleted-workspaces__empty">Loading deleted workspaces…</div> : workspaces.length === 0 ? <div className="deleted-workspaces__empty"><LuArchiveRestore /><h3>No deleted workspaces</h3><p>Soft-deleted workspaces will appear here for recovery or permanent removal.</p></div> : <div className="deleted-workspaces__table-wrap"><table><thead><tr><th>Workspace</th><th>Deleted</th><th>Content</th><th aria-label="Actions" /></tr></thead><tbody>{workspaces.map((workspace) => <tr key={workspace.id}><td><strong>{workspace.name}</strong><small>{workspace.description || "No description provided"}</small></td><td><span className="deleted-workspaces__date">{new Date(workspace.deleted_at).toLocaleDateString()}</span><small>{new Date(workspace.deleted_at).toLocaleTimeString()}</small></td><td><span className="deleted-workspaces__content"><LuFileText /> {workspace.documentCount || 0} documents</span></td><td><div className="deleted-workspaces__actions"><button className="restore" onClick={() => setRestoreTarget(workspace)}><LuArchiveRestore /> Restore</button><button className="purge" onClick={() => { setSelected(workspace); setConfirmation(""); }}><LuTrash2 /> Review purge</button></div></td></tr>)}</tbody></table></div>}
    </section>
    {restoreTarget && <div className="deleted-workspaces__overlay" role="dialog" aria-modal="true"><section className="deleted-workspaces__modal"><div className="deleted-workspaces__modal-icon restore"><LuArchiveRestore /></div><h2>Restore workspace?</h2><p><strong>{restoreTarget.name}</strong> and its existing members, documents, and messages will become accessible again.</p><div className="deleted-workspaces__modal-actions"><button onClick={() => setRestoreTarget(null)}>Cancel</button><button className="restore" onClick={restore} disabled={busy}>{busy ? "Restoring…" : "Restore workspace"}</button></div></section></div>}
    {selected && <div className="deleted-workspaces__overlay" role="dialog" aria-modal="true"><section className="deleted-workspaces__modal"><div className="deleted-workspaces__modal-icon purge"><LuShieldAlert /></div><h2>Permanently delete?</h2><p>This cannot be undone. Type <strong>{selected.name}</strong> to confirm permanent removal.</p><label>Workspace name<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus /></label><div className="deleted-workspaces__modal-actions"><button onClick={() => setSelected(null)}>Cancel</button><button className="purge" onClick={purge} disabled={busy || confirmation !== selected.name}>Permanently delete</button></div></section></div>}
  </main>;
}
export default DeletedWorkspacesPage;
