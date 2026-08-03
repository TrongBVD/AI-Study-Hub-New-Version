import { useCallback, useEffect, useRef, useState } from "react";
import ActionPopup from "./ActionPopup.jsx";
import { ACTION_POPUP_EVENT, showPopupAlert } from "./actionPopupService.js";

function buildPopup(request, onValueChange) {
  const { type, message, options = {} } = request;
  return {
    type,
    title:
      options.title ||
      (type === "confirm" ? "Are you sure?" : type === "prompt" ? "Enter information" : "Notice"),
    message,
    value: options.defaultValue || "",
    placeholder: options.placeholder || "Type here...",
    confirmText: options.confirmText || (type === "alert" ? "Got it" : type === "prompt" ? "Save" : "Confirm"),
    cancelText: options.cancelText || "Cancel",
    tone: options.tone || (type === "confirm" ? "danger" : "info"),
    onValueChange,
  };
}

export default function GlobalActionPopup() {
  const [request, setRequest] = useState(null);
  const [value, setValue] = useState("");
  const queueRef = useRef([]);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    setValue(next?.options?.defaultValue || "");
    setRequest(next);
  }, []);

  useEffect(() => {
    const nativeAlert = window.alert;
    const handleRequest = (event) => {
      const next = event.detail;
      setRequest((current) => {
        if (current) {
          queueRef.current.push(next);
          return current;
        }
        setValue(next?.options?.defaultValue || "");
        return next;
      });
    };
    window.alert = (message) => showPopupAlert(message);
    window.addEventListener(ACTION_POPUP_EVENT, handleRequest);
    return () => {
      window.alert = nativeAlert;
      window.removeEventListener(ACTION_POPUP_EVENT, handleRequest);
    };
  }, []);

  const resolve = useCallback((result) => {
    if (!request) return;
    request.resolve(result);
    showNext();
  }, [request, showNext]);

  if (!request) return null;
  const popup = buildPopup(request, setValue);
  popup.value = value;

  return <ActionPopup popup={popup} onResolve={resolve} />;
}
