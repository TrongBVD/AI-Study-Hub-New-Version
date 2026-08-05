
/**
 * DeleteConfirmModal Component
 * Reusable modal for confirming file deletion in English UI
 */
export default function DeleteConfirmModal({ isOpen, filename, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal_overlay">
      <div
        className="sleek_modal"
        style={{
          maxWidth: "440px",
          padding: "24px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
        }}
      >
        <div className="sleek_modal_header" style={{ marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#f87171" }}>
            Delete File
          </h2>
        </div>
        <div className="sleek_modal_body">
          <p style={{ color: "#334155", fontSize: "14px", lineHeight: "1.6" }}>
            Are you sure you want to delete <strong style={{ color: "#0284c7" }}>"{filename}"</strong>? This action will permanently remove the file from your library and storage.
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
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
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
              background: "#ef4444",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
