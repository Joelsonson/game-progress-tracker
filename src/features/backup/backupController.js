import { normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { getAllGames } from "../../data/gamesRepo.js";
import { clearAllData, getMeta, replaceAllData, setMeta } from "../../data/metaRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import { gameForm, meaningfulProgressInput, sessionForm, settingsMessage } from "../../core/dom.js";
import { IDLE_JOURNEY_META_KEY, IMPORT_FILE_ACCEPT, IMPORT_SCHEMA_VERSION } from "../../core/constants.js";
import { enforceMainGameRules, getErrorMessage } from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { showMessage } from "../../core/ui.js";
import { createSafeFilename, downloadBlob } from "../art/completionCard.js";
import { readFileAsText } from "../art/imageCropper.js";
import { normalizeJourneyState } from "../journey/journeyEngine.js";

export async function handleExportData() {
  try {
    const [games, sessions, idleJourney] = await Promise.all([
      getAllGames(appState.db),
      getAllSessions(appState.db),
      getMeta(appState.db, IDLE_JOURNEY_META_KEY),
    ]);

    const payload = {
      app: "game-progress-tracker",
      schemaVersion: IMPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      games: games.map((game) => normalizeGameRecord(game)),
      sessions: sessions.map((session) => normalizeSessionRecord(session)),
      meta: {
        [IDLE_JOURNEY_META_KEY]: normalizeJourneyState(idleJourney),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    downloadBlob(blob, createBackupFilename(payload.exportedAt));
    showMessage(
      settingsMessage,
      `Exported ${payload.games.length} games, ${payload.sessions.length} sessions, and your idle journey.`
    );
  } catch (error) {
    console.error("Failed to export data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not export your progress."),
      true
    );
  }
}

function createBackupFilename(isoDate) {
  const safeDate = String(isoDate || new Date().toISOString())
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  return createSafeFilename(`game progress backup ${safeDate}.json`);
}

export async function handleImportData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) return;

  if (!IMPORT_FILE_ACCEPT.includes(file.type)) {
    showMessage(
      settingsMessage,
      "Please choose a valid exported JSON backup.",
      true
    );
    return;
  }

  try {
    const rawText = await readFileAsText(file);
    const parsed = JSON.parse(rawText);
    const { games, sessions, meta } = prepareImportPayload(parsed);

    await replaceAllData(appState.db, { games, sessions, meta });
    gameForm.reset();
    sessionForm.reset();
    meaningfulProgressInput.checked = false;

    showMessage(
      settingsMessage,
      `Imported ${games.length} games, ${sessions.length} sessions, and your idle journey.`
    );
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to import data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not import that backup file."),
      true
    );
  }
}

export async function handleClearData() {
  const confirmed = window.confirm(
    "Clear all games, sessions, art, XP progress, and idle journey data from this device?"
  );

  if (!confirmed) return;

  try {
    await clearAllData(appState.db);
    gameForm.reset();
    sessionForm.reset();
    meaningfulProgressInput.checked = false;
    showMessage(settingsMessage, "Cleared all local tracker data.");
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to clear data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not clear your local data."),
      true
    );
  }
}

export async function handleResetJourneyData() {
  const confirmed = window.confirm(
    "Reset only the idle journey and keep your games, sessions, and records?"
  );

  if (!confirmed) return;

  try {
    await setMeta(appState.db, IDLE_JOURNEY_META_KEY, null);
    showMessage(settingsMessage, "Idle journey reset. Tracker history kept.");
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to reset journey data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not reset the idle journey."),
      true
    );
  }
}

export function prepareImportPayload(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.games) ||
    !Array.isArray(parsed.sessions)
  ) {
    throw new Error("That file does not look like a valid tracker export.");
  }

  const normalizedGames = enforceMainGameRules(
    parsed.games.map((game) => normalizeGameRecord(game))
  );
  const gameIds = new Set(normalizedGames.map((game) => game.id));

  const normalizedSessions = parsed.sessions
    .map((session) => normalizeSessionRecord(session))
    .filter((session) => session.gameId && gameIds.has(session.gameId))
    .filter((session) => Number.isFinite(session.minutes) && session.minutes > 0);

  const idleJourney = normalizeJourneyState(
    parsed.meta?.[IDLE_JOURNEY_META_KEY] || parsed.idleJourney || null
  );

  return {
    games: normalizedGames,
    sessions: normalizedSessions,
    meta: {
      [IDLE_JOURNEY_META_KEY]: idleJourney,
    },
  };
}
