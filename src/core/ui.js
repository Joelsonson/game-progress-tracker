import { artCropModal, journeyEventModal, journeyOutcomeModal } from "./dom.js";
import { appState } from "./state.js";

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

export function syncBodyScrollLock() {
  document.body.style.overflow =
    appState.cropSession ||
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
