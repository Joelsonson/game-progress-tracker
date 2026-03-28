import { addGamePanel, appScreens, screenNavButtons } from "../../core/dom.js";
import { DEFAULT_SCREEN_ID, SCREEN_STORAGE_KEY } from "../../core/constants.js";
import { appState } from "../../core/state.js";

export function handleScreenNavClick(event) {
  const targetScreenId = event.currentTarget?.dataset.screenTarget;
  const openPanel = event.currentTarget?.dataset.openPanel;
  if (!targetScreenId) return;

  if (openPanel === "add-game" && addGamePanel) {
    addGamePanel.open = true;
  }

  setActiveScreen(targetScreenId, {
    store: true,
    scrollToTop: true,
  });

  if (openPanel === "add-game" && addGamePanel) {
    window.requestAnimationFrame(() => {
      addGamePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

export function handleViewportResize() {
  setActiveScreen(appState.activeScreenId || getPreferredScreenId());
}

export function getPreferredScreenId() {
  try {
    const storedScreenId = window.localStorage.getItem(SCREEN_STORAGE_KEY);
    return isValidScreenId(storedScreenId) ? storedScreenId : DEFAULT_SCREEN_ID;
  } catch (error) {
    return DEFAULT_SCREEN_ID;
  }
}

export function isValidScreenId(screenId) {
  return appScreens.some((screen) => screen.dataset.screen === screenId);
}

export function setActiveScreen(screenId, options = {}) {
  const { store = false, scrollToTop = false } = options;
  const nextScreenId = isValidScreenId(screenId) ? screenId : DEFAULT_SCREEN_ID;

  appState.activeScreenId = nextScreenId;

  for (const screen of appScreens) {
    screen.classList.toggle("is-active", screen.dataset.screen === nextScreenId);
  }

  for (const button of screenNavButtons) {
    const isActive = button.dataset.screenTarget === nextScreenId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  }

  if (store) {
    try {
      window.localStorage.setItem(SCREEN_STORAGE_KEY, nextScreenId);
    } catch (error) {
      // Ignore localStorage write failures.
    }
  }

  applyScreenHash(nextScreenId);

  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function applyScreenHash(screenId) {
  const screen = appScreens.find((entry) => entry.dataset.screen === screenId);
  if (!screen?.id) return;

  try {
    window.history.replaceState(null, "", `#${screen.id}`);
  } catch (error) {
    // Ignore history update failures.
  }
}
