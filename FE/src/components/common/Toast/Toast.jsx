import { useEffect } from "react";
import { HiOutlineXMark, HiOutlineExclamationTriangle, HiOutlineCheckCircle, HiOutlineInformationCircle } from "react-icons/hi2";
import "./Toast.css";

/**
 * Toast Notification Component
 * Renders custom, sleek English toast popups instead of native browser alert boxes.
 */
export default function Toast({ type = "error", title = "Notification", message, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const icons = {
    error: <HiOutlineExclamationTriangle className="toast_icon error" />,
    success: <HiOutlineCheckCircle className="toast_icon success" />,
    info: <HiOutlineInformationCircle className="toast_icon info" />,
  };

  return (
    <div className={`custom_toast_container ${type}`}>
      <div className="toast_content">
        {icons[type] || icons.info}
        <div className="toast_text">
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
      </div>
      <button type="button" className="toast_close_btn" onClick={onClose} aria-label="Close notification">
        <HiOutlineXMark />
      </button>
    </div>
  );
}
