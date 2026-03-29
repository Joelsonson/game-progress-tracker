import {
  artCropModal,
  characterSkillModalRoot,
  journeyEventModal,
  journeyOutcomeModal,
  settingsModal,
  toastViewport,
} from "./dom.js";
import { appState } from "./state.js";

const TOAST_VISIBLE_CLASS = "is-visible";
const TOAST_MAX_VISIBLE = 3;
const TOAST_HIDE_DELAY_MS = 180;

export function openFilePicker(input) {
  if (!(input instanceof HTMLInputElement)) return;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {
      // Fall back to click for browsers that reject showPicker.
    }
  }

  input.click();
}

export function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#f87171" : "#34d399";
}

export function showToast(message, options = {}) {
  const safeMessage = String(message || "").trim();
  if (!toastViewport || !safeMessage) return;

  const {
    title = "",
    tone = "success",
    duration = 3200,
  } = options;

  const toast = document.createElement("article");
  toast.className = `app-toast is-${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");

  if (title) {
    const titleEl = document.createElement("p");
    titleEl.className = "app-toast-title";
    titleEl.textContent = String(title);
    toast.append(titleEl);
  }

  const messageEl = document.createElement("p");
  messageEl.className = "app-toast-message";
  messageEl.textContent = safeMessage;
  toast.append(messageEl);

  toastViewport.append(toast);

  while (toastViewport.childElementCount > TOAST_MAX_VISIBLE) {
    const staleToast = toastViewport.firstElementChild;
    if (!(staleToast instanceof HTMLElement)) break;
    staleToast.remove();
  }

  window.requestAnimationFrame(() => {
    toast.classList.add(TOAST_VISIBLE_CLASS);
  });

  window.setTimeout(() => {
    dismissToast(toast);
  }, Math.max(1200, duration));
}

export function openSettingsModal() {
  if (!settingsModal) return;
  settingsModal.hidden = false;
  syncBodyScrollLock();
}

export function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.hidden = true;
  syncBodyScrollLock();
}

export function syncBodyScrollLock() {
  document.body.style.overflow =
    appState.cropSession ||
    characterSkillModalRoot?.firstElementChild ||
    (settingsModal && !settingsModal.hidden) ||
    (journeyEventModal && !journeyEventModal.hidden) ||
    (journeyOutcomeModal && !journeyOutcomeModal.hidden) ||
    (artCropModal && !artCropModal.hidden)
      ? "hidden"
      : "";
}

export function scrollDeck(targetId, direction = "right") {
  const element = document.getElementById(targetId);
  if (!element) return;

  const distance = Math.max(element.clientWidth * 0.9, 340);
  const delta = direction === "left" ? -distance : distance;

  element.scrollBy({
    left: delta,
    behavior: "smooth",
  });
}

function dismissToast(toast) {
  if (!(toast instanceof HTMLElement) || !toast.isConnected) return;

  toast.classList.remove(TOAST_VISIBLE_CLASS);
  window.setTimeout(() => {
    toast.remove();
  }, TOAST_HIDE_DELAY_MS);
}
