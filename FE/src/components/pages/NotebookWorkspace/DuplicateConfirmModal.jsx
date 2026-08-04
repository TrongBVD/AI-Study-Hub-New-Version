/**
 * Reusable modal for confirming file replacement when uploading duplicates.
 */
export default function DuplicateConfirmModal({ isOpen, filename, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal_overlay duplicate_confirm_overlay">
      <div className="duplicate_confirm_modal">
        <div className="duplicate_confirm_header">
          <h2>Duplicate File Detected</h2>
        </div>

        <div className="duplicate_confirm_body">
          <p>
            File
            <strong className="duplicate_filename" title={filename}>
              &quot;{filename}&quot;
            </strong>
            already exists in this library. Do you want to replace it?
          </p>
        </div>

        <div className="duplicate_confirm_footer">
          <button type="button" onClick={onClose} className="duplicate_cancel_btn">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="duplicate_replace_btn">
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
