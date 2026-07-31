import { useCallback, useRef, useState } from "react";

function useActionPopup() {
  const [popup, setPopup] = useState(null);
  const resolverRef = useRef(null);

  const showConfirm = useCallback((message, options = {}) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setPopup({
        type: "confirm",
        title: options.title || "Are you sure?",
        message,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
      });
    }), []);

  const showPrompt = useCallback((message, defaultValue = "", options = {}) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setPopup({
        type: "prompt",
        title: options.title || "Enter a name",
        message,
        value: defaultValue,
        placeholder: options.placeholder || "Type here...",
        confirmText: options.confirmText || "Save",
        cancelText: options.cancelText || "Cancel",
      });
    }), []);

  const updatePromptValue = useCallback((value) => {
    setPopup((current) => current ? { ...current, value } : current);
  }, []);

  const resolvePopup = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPopup(null);
    resolve?.(result);
  }, []);

  return {
    popup: popup ? { ...popup, onValueChange: updatePromptValue } : null,
    showConfirm,
    showPrompt,
    resolvePopup,
  };
}

export default useActionPopup;
