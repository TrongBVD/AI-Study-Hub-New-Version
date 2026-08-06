
/**
 * DeleteConfirmModal Component
 * Reusable modal for confirming file deletion in English UI
 */
export default function DeleteConfirmModal({ isOpen, filename, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="delete_confirm_overlay">
      <div className="delete_confirm_modal">
        <div className="delete_confirm_header">
          <h2>Delete File</h2>
        </div>
        <div className="delete_confirm_body">
          <p>
            Are you sure you want to delete{" "}
            <strong>
              "{filename}"
            </strong>
            ? This action will permanently remove the file from your library and storage.
          </p>
        </div>
        <div className="delete_confirm_footer">
          <button
            type="button"
            onClick={onClose}
            className="delete_confirm_cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="delete_confirm_delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
