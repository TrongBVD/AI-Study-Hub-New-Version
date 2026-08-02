import React from "react";

/**
 * DuplicateConfirmModal Component
 * Reusable modal for confirming file replacement when uploading duplicates
 */
export default function DuplicateConfirmModal({ isOpen, filename, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal_overlay">
      <div className="sleek_modal" style={{ maxWidth: "440px", padding: "24px", background: "#14171d", border: "1px solid #2a2e37", borderRadius: "16px" }}>
        <div className="sleek_modal_header" style={{ marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#ffffff" }}>
            Duplicate File Detected
          </h2>
        </div>
        <div className="sleek_modal_body">
          <p style={{ color: "#e2e8f0", fontSize: "14px", lineHeight: "1.6" }}>
            File <strong style={{ color: "#38bdf8" }}>"{filename}"</strong> already exists in this library. Do you want to replace it?
          </p>
        </div>
        <div
          className="sleek_modal_footer"
          style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #334155",
              background: "#1e2229",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#38bdf8",
              color: "#0f172a",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
