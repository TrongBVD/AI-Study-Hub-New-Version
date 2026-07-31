import { useEffect, useRef } from "react";
import "./ActionPopup.css";

function ActionPopup({ popup, onResolve }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!popup) return undefined;

    if (popup.type === "prompt") inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onResolve(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onResolve, popup]);

  if (!popup) return null;

  return (
    <div
      className="action_popup_overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(null);
      }}
    >
      <section
        className={`action_popup action_popup--${popup.type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-popup-title"
        aria-describedby="action-popup-message"
      >
        <button
          type="button"
          className="action_popup_close"
          aria-label="Close popup"
          onClick={() => onResolve(null)}
        >
          <i className="ti-close"></i>
        </button>

        <div className="action_popup_icon" aria-hidden="true">
          <i className={popup.type === "prompt" ? "ti-pencil-alt" : "ti-alert"}></i>
        </div>

        <span className="action_popup_eyebrow">
          {popup.type === "prompt" ? "Enter information" : "Confirmation required"}
        </span>
        <h2 id="action-popup-title">{popup.title}</h2>
        <p id="action-popup-message">{popup.message}</p>

        {popup.type === "prompt" && (
          <input
            ref={inputRef}
            className="action_popup_input"
            value={popup.value}
            placeholder={popup.placeholder}
            onChange={(event) => popup.onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onResolve(popup.value);
            }}
          />
        )}

        <div className="action_popup_actions">
          <button
            type="button"
            className="action_popup_cancel"
            onClick={() => onResolve(null)}
          >
            {popup.cancelText}
          </button>
          <button
            type="button"
            className="action_popup_confirm"
            autoFocus={popup.type !== "prompt"}
            onClick={() => onResolve(popup.type === "prompt" ? popup.value : true)}
          >
            {popup.confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ActionPopup;
