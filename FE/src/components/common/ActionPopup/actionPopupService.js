const ACTION_POPUP_EVENT = "studyhub:action-popup";

function requestPopup(type, message, options = {}) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(ACTION_POPUP_EVENT, {
        detail: { type, message: String(message ?? ""), options, resolve },
      }),
    );
  });
}

export function showPopupAlert(message, options = {}) {
  return requestPopup("alert", message, options);
}

export function showPopupConfirm(message, options = {}) {
  return requestPopup("confirm", message, options);
}

export function showPopupPrompt(message, defaultValue = "", options = {}) {
  return requestPopup("prompt", message, { ...options, defaultValue });
}

export { ACTION_POPUP_EVENT };
