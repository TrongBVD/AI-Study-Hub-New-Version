import "./InformPopup.css";

function InformPopup({
  isOpen,
  title,
  description,
  value,
  copiedMessage = "Copied successfully.",
  isCopied = false,
  primaryText = "Copy Link",
  secondaryText = "Close",
  onPrimaryClick,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="inform_popup_overlay">
      <div className="inform_popup">
        <div className="inform_popup_header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          <button
            type="button"
            className="inform_popup_close_btn"
            onClick={onClose}
            aria-label="Close popup"
          >
            ×
          </button>
        </div>

        {value && (
          <div className="inform_popup_value_box">
            <input type="text" value={value} readOnly />

            <button type="button" onClick={onPrimaryClick}>
              <i className="ti-clipboard"></i>
            </button>
          </div>
        )}

        {isCopied && <p className="inform_popup_message">{copiedMessage}</p>}

        <div className="inform_popup_actions">
          <button type="button" onClick={onPrimaryClick}>
            {primaryText}
          </button>

          <button type="button" onClick={onClose}>
            {secondaryText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InformPopup;