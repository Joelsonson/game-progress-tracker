import { openDB, normalizeGameRecord, normalizeSessionRecord } from "./data/db.js";
import { getAllGames } from "./data/gamesRepo.js";
import { getMeta, setMeta } from "./data/metaRepo.js";
import { getAllSessions } from "./data/sessionsRepo.js";
import {
  appBootSplash,
  bannerArtPickerInput,
  characterSkillModalRoot,
  characterContentEl,
  clearDataButton,
  clearJourneyButton,
  coverArtPickerInput,
  cropCancelButton,
  cropConfirmButton,
  cropFocusXRange,
  cropFocusYRange,
  cropResetButton,
  cropZoomRange,
  exportDataButton,
  formMessage,
  gameForm,
  gameActionsBodyEl,
  gameActionsCloseButton,
  gameActionsModal,
  gamesListEl,
  homeJourneyContentEl,
  homeOverviewEl,
  importDataButton,
  importDataInput,
  journeyContentEl,
  journeyEventDockRoot,
  journeyEventCloseButton,
  journeyEventModal,
  journeyHistoryCloseButton,
  journeyHistoryModal,
  languagePreferenceInput,
  focusedGoalsPreferenceInput,
  journeyOutcomeCloseButton,
  journeyOutcomeModal,
  mobileQuickSwitchEl,
  onboardingOverlay,
  openSettingsButton,
  replayOnboardingButton,
  screenNavButtons,
  sessionsTabButtons,
  settingsModal,
  settingsModalCloseButton,
  sessionForm,
  themePreferenceInput,
  artCropModal,
} from "./core/dom.js";
import {
  DEFAULT_FOCUSED_GOALS_ENABLED,
  FOCUSED_GOALS_META_KEY,
  IDLE_JOURNEY_META_KEY,
  SESSIONS_TABS,
} from "./core/constants.js";
import {
  buildSessionStats,
  buildXpSummary,
  enforceMainGameRules,
  isValidStatus,
  sortGames,
} from "./core/formatters.js";
import { applyStaticTranslations, normalizeLocale, setActiveLocale, t } from "./core/i18n.js";
import { appState } from "./core/state.js";
import { closeSettingsModal, openSettingsModal, showMessage, syncBodyScrollLock } from "./core/ui.js";
import { handleClearData, handleExportData, handleImportData, handleResetJourneyData } from "./features/backup/backupController.js";
import { cancelCropSelection, confirmCropSelection, handleCropControlInput, handleCropModalClick, resetCropControls } from "./features/art/imageCropper.js";
import {
  closeGameActionsSheet,
  handleAddGame,
  handleArtPickerChange,
  handleGameActionsModalClick,
  handleGameActionsSubmit,
  handleListClick,
  primeBuiltInCoverImageOptions,
  repairGamesIfNeeded,
  syncGameDifficultyPresentation,
} from "./features/games/gamesController.js";
import {
  renderBuiltInCoverPicker,
  renderGames,
  renderHomeOverview,
  renderPlayerProgress,
  renderStats,
} from "./features/games/gamesView.js";
import {
  handleHomeJourneyClick,
  handleJourneyClick,
  handleJourneyEventDockClick,
  handleJourneyEventModalClick,
  handleJourneyOutcomeModalClick,
} from "./features/journey/journeyController.js";
import { buildJourneySupplies, syncJourneyState } from "./features/journey/journeyEngine.js";
import {
  closeJourneyEventModal,
  closeJourneyOutcomeModal,
  initializeJourneySpritePreviews,
  renderJourneyEventDock,
  renderCharacterSheet,
  renderHomeJourney,
  renderIdleJourney,
} from "./features/journey/journeyView.js";
import { getPreferredScreenId, handleScreenNavClick, handleViewportResize, setActiveScreen } from "./features/navigation/navigation.js";
import {
  handleOnboardingAppRendered,
  handleOnboardingFormInteraction,
  handleOnboardingKeydown,
  handleOnboardingOverlayClick,
  maybeAutoStartOnboarding,
  startOnboardingReplay,
  syncOnboardingLayout,
} from "./features/onboarding/onboardingController.js";
import { handleAddSession } from "./features/sessions/sessionsController.js";
import {
  handleSessionsTabClick,
  renderRecentSessions,
  renderSessionGameOptions,
  setActiveSessionsTab,
  syncSessionsTabUi,
} from "./features/sessions/sessionsView.js";

document.addEventListener("DOMContentLoaded", init);

let lastQuickSwitchScrollY = 0;
let quickSwitchFramePending = false;

async function init() {
  try {
    appState.db = await openDB();
    appState.renderApp = renderApp;
    appState.themePreference = getStoredThemePreference();
    appState.locale = getStoredLocalePreference();
    applyLanguagePreference(appState.locale);
    applyThemePreference(appState.themePreference);
    await repairGamesIfNeeded();
    void primeBuiltInCoverImageOptions();
    bindEvents();
    setActiveScreen(getPreferredScreenId());
    await renderApp();
    dismissAppBootSplash();
    await maybeAutoStartOnboarding();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    dismissAppBootSplash({ immediate: true });
    showMessage(formMessage, t("messages.initError"), true);
  }
}

function bindEvents() {
  gameForm.addEventListener("submit", handleAddGame);
  sessionForm.addEventListener("submit", handleAddSession);
  gameForm.addEventListener("input", handleOnboardingFormInteraction);
  gameForm.addEventListener("change", handleOnboardingFormInteraction);
  sessionForm.addEventListener("input", handleOnboardingFormInteraction);
  sessionForm.addEventListener("change", handleOnboardingFormInteraction);
  gamesListEl.addEventListener("click", handleListClick);
  homeOverviewEl?.addEventListener("click", handleListClick);
  homeOverviewEl?.addEventListener("click", handleHomeOverviewClick);
  homeOverviewEl?.addEventListener("change", handleHomeOverviewChange);
  gameActionsBodyEl?.addEventListener("click", handleListClick);
  gameActionsBodyEl?.addEventListener("submit", handleGameActionsSubmit);
  journeyContentEl?.addEventListener("click", handleJourneyClick);
  characterContentEl?.addEventListener("click", handleJourneyClick);
  homeJourneyContentEl?.addEventListener("click", handleHomeJourneyClick);
  coverArtPickerInput.addEventListener("change", () => handleArtPickerChange("cover"));
  bannerArtPickerInput.addEventListener("change", () => handleArtPickerChange("banner"));

  exportDataButton?.addEventListener("click", handleExportData);
  importDataButton?.addEventListener("click", () => importDataInput?.click());
  clearJourneyButton?.addEventListener("click", handleResetJourneyData);
  clearDataButton?.addEventListener("click", handleClearData);
  importDataInput?.addEventListener("change", handleImportData);
  themePreferenceInput?.addEventListener("change", handleThemePreferenceChange);
  languagePreferenceInput?.addEventListener("change", handleLanguagePreferenceChange);
  focusedGoalsPreferenceInput?.addEventListener("change", handleFocusedGoalsPreferenceChange);
  openSettingsButton?.addEventListener("click", openSettingsModal);
  replayOnboardingButton?.addEventListener("click", () => {
    void startOnboardingReplay();
  });
  settingsModal?.addEventListener("click", handleSettingsModalClick);
  settingsModalCloseButton?.addEventListener("click", closeSettingsModal);
  onboardingOverlay?.addEventListener("click", (event) => {
    void handleOnboardingOverlayClick(event);
  });
  document
    .querySelector("#gameDifficultySelector")
    ?.addEventListener("change", syncGameDifficultyPresentation);

  cropZoomRange?.addEventListener("input", handleCropControlInput);
  cropFocusXRange?.addEventListener("input", handleCropControlInput);
  cropFocusYRange?.addEventListener("input", handleCropControlInput);
  cropResetButton?.addEventListener("click", resetCropControls);
  cropCancelButton?.addEventListener("click", cancelCropSelection);
  cropConfirmButton?.addEventListener("click", confirmCropSelection);
  artCropModal?.addEventListener("click", handleCropModalClick);
  gameActionsModal?.addEventListener("click", handleGameActionsModalClick);
  gameActionsCloseButton?.addEventListener("click", closeGameActionsSheet);
  journeyEventModal?.addEventListener("click", handleJourneyEventModalClick);
  journeyEventCloseButton?.addEventListener("click", closeJourneyEventModal);
  journeyOutcomeModal?.addEventListener("click", handleJourneyOutcomeModalClick);
  journeyOutcomeCloseButton?.addEventListener("click", closeJourneyOutcomeModal);
  journeyHistoryModal?.addEventListener("click", handleJourneyHistoryModalClick);
  journeyHistoryCloseButton?.addEventListener("click", closeJourneyHistoryModal);
  journeyEventDockRoot?.addEventListener("click", (event) => {
    void handleJourneyEventDockClick(event);
  });
  characterSkillModalRoot?.addEventListener("click", handleJourneyClick);
  document.addEventListener("keydown", handleGlobalKeyDown);

  for (const button of screenNavButtons) {
    button.addEventListener("click", handleScreenNavClick);
  }

  for (const button of sessionsTabButtons) {
    button.addEventListener("click", handleSessionsTabClick);
  }

  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  syncQuickSwitchChrome();
}

function handleGlobalKeyDown(event) {
  if (handleOnboardingKeydown(event)) {
    return;
  }

  if (event.key === "Escape" && settingsModal && !settingsModal.hidden) {
    closeSettingsModal();
    return;
  }

  if (event.key === "Escape" && appState.cropSession) {
    cancelCropSelection();
    return;
  }

  if (event.key === "Escape" && gameActionsModal && !gameActionsModal.hidden) {
    closeGameActionsSheet();
    return;
  }

  if (event.key === "Escape" && journeyHistoryModal && !journeyHistoryModal.hidden) {
    closeJourneyHistoryModal();
    return;
  }

  if (event.key === "Escape" && appState.showCharacterSkillModal) {
    appState.showCharacterSkillModal = false;
    void appState.renderApp();
    return;
  }

  if (event.key === "Escape" && journeyOutcomeModal && !journeyOutcomeModal.hidden) {
    closeJourneyOutcomeModal();
    return;
  }

  if (event.key === "Escape" && journeyEventModal && !journeyEventModal.hidden) {
    closeJourneyEventModal();
    return;
  }

  if (event.key === "Escape" && appState.journeyEventDockExpanded) {
    appState.journeyEventDockExpanded = false;
    renderJourneyEventDock(appState.latestIdleJourney);
  }
}

function handleWindowResize() {
  handleViewportResize();
  syncOnboardingLayout();
  syncHomeCapsuleChrome();
}

function handleSettingsModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-settings-modal]")) {
    closeSettingsModal();
  }
}

function handleJourneyHistoryModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-journey-history]")) {
    closeJourneyHistoryModal();
  }
}

function closeJourneyHistoryModal() {
  if (!journeyHistoryModal) return;
  journeyHistoryModal.hidden = true;
  const historyBody = journeyHistoryModal.querySelector("#journeyHistoryBody");
  if (historyBody) {
    historyBody.innerHTML = "";
  }
  syncBodyScrollLock();
}

function handleWindowScroll() {
  if (quickSwitchFramePending) return;

  quickSwitchFramePending = true;
  window.requestAnimationFrame(() => {
    quickSwitchFramePending = false;
    syncQuickSwitchChrome();
    syncHomeCapsuleChrome();
    syncOnboardingLayout();
  });
}

function syncQuickSwitchChrome() {
  if (!mobileQuickSwitchEl) return;

  const nextScrollY = Math.max(window.scrollY || 0, 0);
  const scrollDelta = nextScrollY - lastQuickSwitchScrollY;
  const scrollProgress = Math.min(nextScrollY / 220, 1);
  let scrollState = mobileQuickSwitchEl.dataset.scrollState || "top";

  if (nextScrollY <= 12) {
    scrollState = "top";
  } else if (scrollDelta > 4) {
    scrollState = "hidden";
  } else if (scrollDelta < -4) {
    scrollState = "visible";
  }

  mobileQuickSwitchEl.dataset.scrollState = scrollState;
  mobileQuickSwitchEl.style.setProperty(
    "--quick-nav-scroll-progress",
    scrollProgress.toFixed(3)
  );
  lastQuickSwitchScrollY = nextScrollY;
}

function syncHomeCapsuleChrome() {
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) return;

  const scrollY = Math.max(window.scrollY || 0, 0);
  const wave = scrollY / 150;
  const tiltX = Math.sin(wave * 0.9) * 2.4;
  const tiltY = Math.cos(wave * 0.68) * 4.2;
  const shift = ((scrollY * 0.4) % 140) - 20;
  const glintX = Math.sin(wave * 1.1) * 9;
  const glintY = Math.cos(wave * 0.82) * 7;

  rootStyle.setProperty("--home-holo-tilt-x", `${tiltX.toFixed(2)}deg`);
  rootStyle.setProperty("--home-holo-tilt-y", `${tiltY.toFixed(2)}deg`);
  rootStyle.setProperty("--home-holo-shift", `${shift.toFixed(2)}%`);
  rootStyle.setProperty("--home-holo-glint-x", `${glintX.toFixed(2)}%`);
  rootStyle.setProperty("--home-holo-glint-y", `${glintY.toFixed(2)}%`);
}

function dismissAppBootSplash({ immediate = false } = {}) {
  if (!appBootSplash || appBootSplash.hidden) {
    return;
  }

  const finish = () => {
    appBootSplash.hidden = true;
  };

  if (immediate) {
    appBootSplash.classList.add("is-ready");
    finish();
    return;
  }

  window.requestAnimationFrame(() => {
    appBootSplash.classList.add("is-ready");
    window.setTimeout(finish, 420);
  });
}

export async function renderApp() {
  const [gamesRaw, sessionsRaw, idleJourneyRaw, focusedGoalsRaw] = await Promise.all([
    getAllGames(appState.db),
    getAllSessions(appState.db),
    getMeta(appState.db, IDLE_JOURNEY_META_KEY),
    getMeta(appState.db, FOCUSED_GOALS_META_KEY),
  ]);

  appState.focusedGoalsEnabled = normalizeFocusedGoalsPreference(focusedGoalsRaw);
  const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
  const games = enforceMainGameRules(gamesRaw.map((game) => normalizeGameRecord(game)));
  const sortedGames = sortGames(games);
  const sessionStats = buildSessionStats(sessions);
  const xpSummary = buildXpSummary(sortedGames, sessions);
  const idleJourney = await syncJourneyState(idleJourneyRaw, sortedGames, sessions, xpSummary);
  const journeySupplies = buildJourneySupplies(sortedGames, sessions, idleJourney);
  appState.latestIdleJourney = idleJourney;

  renderHomeOverview(
    sortedGames,
    sessions,
    sessionStats,
    xpSummary,
    appState.homeLibraryStatusFilter,
    appState.homeLibraryExpanded
  );
  renderHomeJourney(idleJourney, xpSummary, journeySupplies);
  renderPlayerProgress(xpSummary);
  renderStats(sortedGames, sessions);
  renderIdleJourney(idleJourney, sortedGames, sessions, xpSummary);
  renderJourneyEventDock(idleJourney);
  renderCharacterSheet(idleJourney, sortedGames, sessions, xpSummary);
  initializeJourneySpritePreviews();
  renderSessionGameOptions(sortedGames);
  renderGames(sortedGames, sessionStats);
  renderBuiltInCoverPicker();
  renderRecentSessions(sortedGames, sessions);
  syncSessionsTabUi();
  syncThemePreferenceInput();
  syncLanguagePreferenceInput();
  syncFocusedGoalsPreferenceInput();
  syncGameDifficultyPresentation();
  syncHomeCapsuleChrome();
  handleOnboardingAppRendered({
    games: sortedGames,
    sessions,
  });
}

function handleThemePreferenceChange(event) {
  const nextPreference = event.target instanceof HTMLSelectElement
    ? event.target.value
    : "system";
  appState.themePreference = normalizeThemePreference(nextPreference);
  applyThemePreference(appState.themePreference);
  syncThemePreferenceInput();

  try {
    window.localStorage.setItem("gameTracker.themePreference", appState.themePreference);
  } catch (error) {
    // Ignore localStorage write failures.
  }
}

function handleHomeOverviewClick(event) {
  const expandButton = event.target instanceof HTMLElement
    ? event.target.closest("button[data-home-library-toggle]")
    : null;
  if (expandButton) {
    appState.homeLibraryExpanded = !appState.homeLibraryExpanded;
    void renderApp();
    return;
  }

  const button = event.target instanceof HTMLElement
    ? event.target.closest("button[data-home-shortcut]")
    : null;
  if (!button) return;

  const shortcut = button.dataset.homeShortcut;

  if (shortcut === "log-session") {
    setActiveSessionsTab(SESSIONS_TABS.LOG);
    setActiveScreen("sessions", { store: true, scrollToTop: true });
    return;
  }

  if (shortcut === "add-goal") {
    setActiveSessionsTab(SESSIONS_TABS.NEW_GAME);
    setActiveScreen("sessions", { store: true, scrollToTop: true });
    return;
  }

  if (shortcut === "tracker") {
    setActiveScreen("tracker", { store: true, scrollToTop: true });
  }
}

function handleHomeOverviewChange(event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  if (!event.target.matches("[data-home-filter-select]")) return;

  const nextFilter = String(event.target.value || "").trim();
  const normalizedFilter =
    nextFilter === "all" || isValidStatus(nextFilter) ? nextFilter : "all";

  if (appState.homeLibraryStatusFilter !== normalizedFilter) {
    appState.homeLibraryStatusFilter = normalizedFilter;
    appState.homeLibraryExpanded = false;
    void renderApp();
  }
}

async function handleLanguagePreferenceChange(event) {
  const nextLocale = event.target instanceof HTMLSelectElement
    ? event.target.value
    : "en";
  appState.locale = normalizeLocale(nextLocale);
  applyLanguagePreference(appState.locale);
  syncLanguagePreferenceInput();

  try {
    window.localStorage.setItem("gameTracker.localePreference", appState.locale);
  } catch (error) {
    // Ignore localStorage write failures.
  }

  await renderApp();
}

async function handleFocusedGoalsPreferenceChange(event) {
  const nextValue = event.target instanceof HTMLSelectElement
    ? event.target.value
    : DEFAULT_FOCUSED_GOALS_ENABLED;
  const nextPreference = normalizeFocusedGoalsPreference(nextValue);

  appState.focusedGoalsEnabled = nextPreference;
  syncFocusedGoalsPreferenceInput();

  try {
    await setMeta(appState.db, FOCUSED_GOALS_META_KEY, nextPreference);
  } catch (error) {
    console.error("Failed to save focused goals preference:", error);
  }

  await renderApp();
}

function getStoredThemePreference() {
  try {
    const storedPreference = window.localStorage.getItem("gameTracker.themePreference");
    return storedPreference === null
      ? "dark"
      : normalizeThemePreference(storedPreference);
  } catch (error) {
    return "dark";
  }
}

function getStoredLocalePreference() {
  try {
    return normalizeLocale(
      window.localStorage.getItem("gameTracker.localePreference")
    );
  } catch (error) {
    return "en";
  }
}

function normalizeThemePreference(value) {
  return value === "light" || value === "dark" ? value : "system";
}

function normalizeFocusedGoalsPreference(value) {
  if (typeof value === "boolean") return value;
  if (value === "on") return true;
  if (value === "off") return false;
  return DEFAULT_FOCUSED_GOALS_ENABLED;
}

function applyThemePreference(preference) {
  const root = document.documentElement;
  if (!root) return;

  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }

  const isDark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#242424" : "#f8f4f1");
}

function applyLanguagePreference(locale) {
  appState.locale = normalizeLocale(locale);
  setActiveLocale(appState.locale);
  applyStaticTranslations();
}

function syncThemePreferenceInput() {
  if (!themePreferenceInput) return;
  themePreferenceInput.value = appState.themePreference;
}

function syncLanguagePreferenceInput() {
  if (!languagePreferenceInput) return;
  languagePreferenceInput.value = appState.locale;
}

function syncFocusedGoalsPreferenceInput() {
  if (!focusedGoalsPreferenceInput) return;
  focusedGoalsPreferenceInput.value = appState.focusedGoalsEnabled ? "on" : "off";
}
