import { openDB, normalizeGameRecord, normalizeSessionRecord } from "./data/db.js";
import { getAllGames } from "./data/gamesRepo.js";
import { getMeta } from "./data/metaRepo.js";
import { getAllSessions } from "./data/sessionsRepo.js";
import {
  bannerArtPickerInput,
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
  journeyOutcomeCloseButton,
  journeyOutcomeModal,
  screenNavButtons,
  sessionForm,
  themePreferenceInput,
  artCropModal,
} from "./core/dom.js";
import { IDLE_JOURNEY_META_KEY } from "./core/constants.js";
import { buildSessionStats, buildXpSummary, enforceMainGameRules, sortGames } from "./core/formatters.js";
import { appState } from "./core/state.js";
import { showMessage } from "./core/ui.js";
import { handleClearData, handleExportData, handleImportData, handleResetJourneyData } from "./features/backup/backupController.js";
import { cancelCropSelection, confirmCropSelection, handleCropControlInput, handleCropModalClick, resetCropControls } from "./features/art/imageCropper.js";
import { closeGameActionsSheet, handleAddGame, handleArtPickerChange, handleGameActionsModalClick, handleListClick, repairGamesIfNeeded } from "./features/games/gamesController.js";
import { renderCompletionSpotlight, renderGames, renderMainQuest, renderPlayerProgress, renderStats } from "./features/games/gamesView.js";
import { handleHomeJourneyClick, handleJourneyClick, handleJourneyEventModalClick, handleJourneyOutcomeModalClick } from "./features/journey/journeyController.js";
import { syncJourneyState } from "./features/journey/journeyEngine.js";
import {
  closeJourneyEventModal,
  closeJourneyOutcomeModal,
  initializeJourneySpritePreviews,
  renderCharacterSheet,
  renderHomeJourney,
  renderIdleJourney,
} from "./features/journey/journeyView.js";
import { getPreferredScreenId, handleScreenNavClick, handleViewportResize, setActiveScreen } from "./features/navigation/navigation.js";
import { handleAddSession } from "./features/sessions/sessionsController.js";
import { renderRecentSessions, renderSessionGameOptions } from "./features/sessions/sessionsView.js";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    appState.db = await openDB();
    appState.renderApp = renderApp;
    appState.themePreference = getStoredThemePreference();
    applyThemePreference(appState.themePreference);
    await repairGamesIfNeeded();
    bindEvents();
    setActiveScreen(getPreferredScreenId());
    await renderApp();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showMessage(formMessage, "Could not initialize the app.", true);
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
  document.addEventListener("keydown", handleGlobalKeyDown);

  for (const button of screenNavButtons) {
    button.addEventListener("click", handleScreenNavClick);
  }

  window.addEventListener("resize", handleViewportResize);
}

function handleGlobalKeyDown(event) {
  if (event.key === "Escape" && appState.cropSession) {
    cancelCropSelection();
    return;
  }

  if (event.key === "Escape" && gameActionsModal && !gameActionsModal.hidden) {
    closeGameActionsSheet();
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

  renderHomeJourney(idleJourney, xpSummary);
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
  syncThemePreferenceInput();
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

function getStoredThemePreference() {
  try {
    return normalizeThemePreference(
      window.localStorage.getItem("gameTracker.themePreference")
    );
  } catch (error) {
    return "system";
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

function syncThemePreferenceInput() {
  if (!themePreferenceInput) return;
  themePreferenceInput.value = appState.themePreference;
}
