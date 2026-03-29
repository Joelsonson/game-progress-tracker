import { openDB, normalizeGameRecord, normalizeSessionRecord } from "./data/db.js";
import { getAllGames } from "./data/gamesRepo.js";
import { getMeta } from "./data/metaRepo.js";
import { getAllSessions } from "./data/sessionsRepo.js";
import {
  bannerArtPickerInput,
  characterSkillModalRoot,
  characterContentEl,
  clearDataButton,
  clearJourneyButton,
  completionSpotlightEl,
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
  importDataButton,
  importDataInput,
  journeyContentEl,
  journeyEventCloseButton,
  journeyEventModal,
  journeyHistoryCloseButton,
  journeyHistoryModal,
  languagePreferenceInput,
  journeyOutcomeCloseButton,
  journeyOutcomeModal,
  mobileQuickSwitchEl,
  openSettingsButton,
  screenNavButtons,
  sessionsTabButtons,
  settingsModal,
  settingsModalCloseButton,
  sessionForm,
  themePreferenceInput,
  artCropModal,
} from "./core/dom.js";
import { IDLE_JOURNEY_META_KEY } from "./core/constants.js";
import { buildSessionStats, buildXpSummary, enforceMainGameRules, sortGames } from "./core/formatters.js";
import { applyStaticTranslations, normalizeLocale, setActiveLocale, t } from "./core/i18n.js";
import { appState } from "./core/state.js";
import { closeSettingsModal, openSettingsModal, showMessage } from "./core/ui.js";
import { handleClearData, handleExportData, handleImportData, handleResetJourneyData } from "./features/backup/backupController.js";
import { cancelCropSelection, confirmCropSelection, handleCropControlInput, handleCropModalClick, resetCropControls } from "./features/art/imageCropper.js";
import {
  closeGameActionsSheet,
  handleAddGame,
  handleArtPickerChange,
  handleGameActionsModalClick,
  handleListClick,
  repairGamesIfNeeded,
  syncGameDifficultyPresentation,
} from "./features/games/gamesController.js";
import { renderCompletionSpotlight, renderGames, renderMainQuest, renderPlayerProgress, renderStats } from "./features/games/gamesView.js";
import { handleHomeJourneyClick, handleJourneyClick, handleJourneyEventModalClick, handleJourneyOutcomeModalClick } from "./features/journey/journeyController.js";
import { buildJourneySupplies, syncJourneyState } from "./features/journey/journeyEngine.js";
import {
  closeJourneyEventModal,
  closeJourneyHistoryModal,
  closeJourneyOutcomeModal,
  handleJourneyHistoryModalClick,
  initializeJourneySpritePreviews,
  renderCharacterSheet,
  renderHomeJourney,
  renderIdleJourney,
} from "./features/journey/journeyView.js";
import { getPreferredScreenId, handleScreenNavClick, handleViewportResize, setActiveScreen } from "./features/navigation/navigation.js";
import { handleAddSession } from "./features/sessions/sessionsController.js";
import {
  handleSessionsTabClick,
  renderRecentSessions,
  renderSessionGameOptions,
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
    bindEvents();
    setActiveScreen(getPreferredScreenId());
    await renderApp();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showMessage(formMessage, t("messages.initError"), true);
  }
}

function bindEvents() {
  gameForm.addEventListener("submit", handleAddGame);
  sessionForm.addEventListener("submit", handleAddSession);
  gamesListEl.addEventListener("click", handleListClick);
  completionSpotlightEl.addEventListener("click", handleListClick);
  gameActionsBodyEl?.addEventListener("click", handleListClick);
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
  openSettingsButton?.addEventListener("click", openSettingsModal);
  settingsModal?.addEventListener("click", handleSettingsModalClick);
  settingsModalCloseButton?.addEventListener("click", closeSettingsModal);
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
  characterSkillModalRoot?.addEventListener("click", handleJourneyClick);
  document.addEventListener("keydown", handleGlobalKeyDown);

  for (const button of screenNavButtons) {
    button.addEventListener("click", handleScreenNavClick);
  }

  for (const button of sessionsTabButtons) {
    button.addEventListener("click", handleSessionsTabClick);
  }

  window.addEventListener("resize", handleViewportResize);
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  syncQuickSwitchChrome();
}

function handleGlobalKeyDown(event) {
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
  }
}

function handleSettingsModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-settings-modal]")) {
    closeSettingsModal();
  }
}

function handleWindowScroll() {
  if (quickSwitchFramePending) return;

  quickSwitchFramePending = true;
  window.requestAnimationFrame(() => {
    quickSwitchFramePending = false;
    syncQuickSwitchChrome();
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

export async function renderApp() {
  const [gamesRaw, sessionsRaw, idleJourneyRaw] = await Promise.all([
    getAllGames(appState.db),
    getAllSessions(appState.db),
    getMeta(appState.db, IDLE_JOURNEY_META_KEY),
  ]);

  const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
  const games = enforceMainGameRules(gamesRaw.map((game) => normalizeGameRecord(game)));
  const sortedGames = sortGames(games);
  const sessionStats = buildSessionStats(sessions);
  const xpSummary = buildXpSummary(sortedGames, sessions);
  const idleJourney = await syncJourneyState(idleJourneyRaw, sortedGames, sessions, xpSummary);
  const journeySupplies = buildJourneySupplies(sortedGames, sessions, idleJourney);

  renderHomeJourney(idleJourney, xpSummary, journeySupplies);
  renderPlayerProgress(xpSummary);
  renderStats(sortedGames, sessions);
  renderIdleJourney(idleJourney, sortedGames, sessions, xpSummary);
  renderCharacterSheet(idleJourney, sortedGames, sessions, xpSummary);
  initializeJourneySpritePreviews();
  renderCompletionSpotlight(sortedGames, sessionStats);
  renderMainQuest(sortedGames, sessionStats);
  renderSessionGameOptions(sortedGames);
  renderGames(sortedGames, sessionStats);
  renderRecentSessions(sortedGames, sessions);
  syncSessionsTabUi();
  syncThemePreferenceInput();
  syncLanguagePreferenceInput();
  syncGameDifficultyPresentation();
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

function getStoredThemePreference() {
  try {
    return normalizeThemePreference(
      window.localStorage.getItem("gameTracker.themePreference")
    );
  } catch (error) {
    return "system";
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
