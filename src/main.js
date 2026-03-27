import { openDB, normalizeGameRecord, normalizeSessionRecord } from "./data/db.js";
import { getAllGames } from "./data/gamesRepo.js";
import { getMeta } from "./data/metaRepo.js";
import { getAllSessions } from "./data/sessionsRepo.js";
import {
  bannerArtPickerInput,
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
  artCropModal,
} from "./core/dom.js";
import { IDLE_JOURNEY_META_KEY } from "./core/constants.js";
import { buildSessionStats, buildXpSummary, enforceMainGameRules, sortGames } from "./core/formatters.js";
import { appState } from "./core/state.js";
import { showMessage } from "./core/ui.js";
import { handleClearData, handleExportData, handleImportData, handleResetJourneyData } from "./features/backup/backupController.js";
import { cancelCropSelection, confirmCropSelection, handleCropControlInput, handleCropModalClick, resetCropControls } from "./features/art/imageCropper.js";
import { handleAddGame, handleArtPickerChange, handleListClick, repairGamesIfNeeded } from "./features/games/gamesController.js";
import { renderCompletionSpotlight, renderGames, renderMainQuest, renderPlayerProgress, renderStats } from "./features/games/gamesView.js";
import { handleHomeJourneyClick, handleJourneyClick, handleJourneyEventModalClick, handleJourneyOutcomeModalClick } from "./features/journey/journeyController.js";
import { syncJourneyState } from "./features/journey/journeyEngine.js";
import { closeJourneyEventModal, closeJourneyOutcomeModal, renderHomeJourney, renderIdleJourney } from "./features/journey/journeyView.js";
import { getPreferredScreenId, handleScreenNavClick, handleViewportResize, setActiveScreen } from "./features/navigation/navigation.js";
import { handleAddSession } from "./features/sessions/sessionsController.js";
import { renderRecentSessions, renderSessionGameOptions } from "./features/sessions/sessionsView.js";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    appState.db = await openDB();
    appState.renderApp = renderApp;
    await repairGamesIfNeeded();
    bindEvents();
    setActiveScreen(getPreferredScreenId());
    await renderApp();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showMessage(formMessage, "Could not open local database.", true);
  }
}

function bindEvents() {
  gameForm.addEventListener("submit", handleAddGame);
  sessionForm.addEventListener("submit", handleAddSession);
  gamesListEl.addEventListener("click", handleListClick);
  completionSpotlightEl.addEventListener("click", handleListClick);
  journeyContentEl?.addEventListener("click", handleJourneyClick);
  homeJourneyContentEl?.addEventListener("click", handleHomeJourneyClick);
  coverArtPickerInput.addEventListener("change", () => handleArtPickerChange("cover"));
  bannerArtPickerInput.addEventListener("change", () => handleArtPickerChange("banner"));

  exportDataButton?.addEventListener("click", handleExportData);
  importDataButton?.addEventListener("click", () => importDataInput?.click());
  clearJourneyButton?.addEventListener("click", handleResetJourneyData);
  clearDataButton?.addEventListener("click", handleClearData);
  importDataInput?.addEventListener("change", handleImportData);

  cropZoomRange?.addEventListener("input", handleCropControlInput);
  cropFocusXRange?.addEventListener("input", handleCropControlInput);
  cropFocusYRange?.addEventListener("input", handleCropControlInput);
  cropResetButton?.addEventListener("click", resetCropControls);
  cropCancelButton?.addEventListener("click", cancelCropSelection);
  cropConfirmButton?.addEventListener("click", confirmCropSelection);
  artCropModal?.addEventListener("click", handleCropModalClick);
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
  renderCompletionSpotlight(sortedGames, sessionStats);
  renderMainQuest(sortedGames, sessionStats);
  renderSessionGameOptions(sortedGames);
  renderGames(sortedGames, sessionStats);
  renderRecentSessions(sortedGames, sessions);
}
