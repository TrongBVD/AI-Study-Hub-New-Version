import { useState } from "react";
import { FaCheck, FaUsers, FaUserTie, FaShieldHalved } from "react-icons/fa6";
import { FaTimes, FaFileAlt } from "react-icons/fa";
import "./WorkspaceInviteModal.css";

export function WorkspaceInviteModal({ invitation, onClose, onRespond }) {
  const [loadingAction, setLoadingAction] = useState(null);

  if (!invitation) return null;

  const {
    logId,
    workspaceName,
    inviterName,
    workspaceDescription,
    role,
    status,
    memberCount,
  } = invitation;

  const handleAction = async (action) => {
    try {
      setLoadingAction(action);
      await onRespond(logId, action);
      onClose();
    } catch (err) {
      console.error("Failed to respond to invitation:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const roleLabel =
    role === "Admin"
      ? "Admin"
      : "Contributor";

  return (
    <div className="invite-modal-backdrop" onClick={onClose}>
      <div className="invite-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="invite-modal-header">
          <div className="invite-modal-icon-badge">
            <FaUsers />
          </div>
          <h3>Workspace Invitation</h3>
          <button className="invite-modal-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="invite-modal-body">
          <div className="invite-detail-item">
            <span className="invite-detail-label">
              <FaUsers className="label-icon" /> Workspace Name:
            </span>
            <span className="invite-detail-value highlight">{workspaceName || "AI Study Hub Workspace"}</span>
          </div>

          <div className="invite-detail-item">
            <span className="invite-detail-label">
              <FaUserTie className="label-icon" /> Invited By (Admin):
            </span>
            <span className="invite-detail-value">{inviterName || "Workspace Admin"}</span>
          </div>

          <div className="invite-detail-item">
            <span className="invite-detail-label">
              <FaShieldHalved className="label-icon" /> Invited Role:
            </span>
            <span className="invite-detail-value badge-role">{roleLabel}</span>
          </div>

          <div className="invite-detail-item">
            <span className="invite-detail-label">
              <FaUsers className="label-icon" /> Members:
            </span>
            <span className="invite-detail-value">{memberCount || 1} {(memberCount || 1) === 1 ? "user" : "users"}</span>
          </div>

          <div className="invite-detail-item column">
            <span className="invite-detail-label">
              <FaFileAlt className="label-icon" /> Workspace Description:
            </span>
            <div className="invite-detail-description">
              {workspaceDescription && workspaceDescription.trim()
                ? workspaceDescription
                : "No description provided for this workspace."}
            </div>
          </div>
        </div>

        <div className="invite-modal-footer">
          {status === "PENDING" ? (
            <>
              <button
                className="invite-btn reject"
                onClick={() => handleAction("reject")}
                disabled={loadingAction !== null}
              >
                <FaTimes /> Decline
              </button>
              <button
                className="invite-btn accept"
                onClick={() => handleAction("accept")}
                disabled={loadingAction !== null}
              >
                <FaCheck /> Accept & Join
              </button>
            </>
          ) : (
            <div className={`invite-status-banner ${status ? status.toLowerCase() : ""}`}>
              Invitation status: <strong>{status === "ACCEPTED" ? "Accepted" : "Declined"}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
