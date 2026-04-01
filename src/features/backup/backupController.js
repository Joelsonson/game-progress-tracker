import { normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { getAllGames } from "../../data/gamesRepo.js";
import { clearAllData, getMeta, replaceAllData, setMeta } from "../../data/metaRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import { gameForm, meaningfulProgressInput, sessionForm, settingsMessage } from "../../core/dom.js";
import {
  DEFAULT_FOCUSED_GOALS_ENABLED,
  FOCUSED_GOALS_META_KEY,
  IDLE_JOURNEY_META_KEY,
  IMPORT_FILE_ACCEPT,
  IMPORT_SCHEMA_VERSION,
  ONBOARDING_META_KEY,
} from "../../core/constants.js";
import { enforceMainGameRules, getErrorMessage } from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { showMessage } from "../../core/ui.js";
import { createSafeFilename, downloadBlob } from "../art/completionCard.js";
import { readFileAsText } from "../art/imageCropper.js";
import { normalizeOnboardingMeta } from "../onboarding/onboardingService.js";
import { normalizeJourneyState } from "../journey/journeyEngine.js";

export async function handleExportData() {
  try {
    const [games, sessions, idleJourney, focusedGoalsEnabled, onboardingMeta] = await Promise.all([
      getAllGames(appState.db),
      getAllSessions(appState.db),
      getMeta(appState.db, IDLE_JOURNEY_META_KEY),
      getMeta(appState.db, FOCUSED_GOALS_META_KEY),
      getMeta(appState.db, ONBOARDING_META_KEY),
    ]);
    const normalizedOnboardingMeta = normalizeOnboardingMeta(onboardingMeta);

    const payload = {
      app: "goal-progress-tracker",
      schemaVersion: IMPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      games: games.map((game) => normalizeGameRecord(game)),
      sessions: sessions.map((session) => normalizeSessionRecord(session)),
      meta: {
        [IDLE_JOURNEY_META_KEY]: normalizeJourneyState(idleJourney),
        [FOCUSED_GOALS_META_KEY]:
          typeof focusedGoalsEnabled === "boolean"
            ? focusedGoalsEnabled
            : DEFAULT_FOCUSED_GOALS_ENABLED,
        ...(normalizedOnboardingMeta
          ? { [ONBOARDING_META_KEY]: normalizedOnboardingMeta }
          : {}),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    downloadBlob(blob, createBackupFilename(payload.exportedAt));
    showMessage(
      settingsMessage,
      t("settings.exportSuccess", {
        games: payload.games.length,
        sessions: payload.sessions.length,
      })
    );
  } catch (error) {
    console.error("Failed to export data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, t("settings.exportFailed")),
      true
    );
  }
}

function createBackupFilename(isoDate) {
  const safeDate = String(isoDate || new Date().toISOString())
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  return createSafeFilename(`goal tracker backup ${safeDate}.json`);
}

export async function handleImportData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) return;

  if (!IMPORT_FILE_ACCEPT.includes(file.type)) {
    showMessage(
      settingsMessage,
      t("settings.invalidImport"),
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
      t("settings.importSuccess", {
        games: games.length,
        sessions: sessions.length,
      })
    );
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to import data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, t("settings.importFailed")),
      true
    );
  }
}

export async function handleClearData() {
  const confirmed = window.confirm(t("settings.clearConfirm"));

  if (!confirmed) return;

  try {
    await clearAllData(appState.db);
    gameForm.reset();
    sessionForm.reset();
    meaningfulProgressInput.checked = false;
    showMessage(settingsMessage, t("settings.clearSuccess"));
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to clear data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, t("settings.clearFailed")),
      true
    );
  }
}

export async function handleResetJourneyData() {
  const confirmed = window.confirm(t("settings.resetJourneyConfirm"));

  if (!confirmed) return;

  try {
    await setMeta(appState.db, IDLE_JOURNEY_META_KEY, null);
    showMessage(settingsMessage, t("settings.resetJourneySuccess"));
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to reset journey data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, t("settings.resetJourneyFailed")),
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
    throw new Error("That file does not look like a valid goal tracker export.");
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
  const focusedGoalsEnabled =
    typeof parsed.meta?.[FOCUSED_GOALS_META_KEY] === "boolean"
      ? parsed.meta[FOCUSED_GOALS_META_KEY]
      : DEFAULT_FOCUSED_GOALS_ENABLED;
  const onboarding = normalizeOnboardingMeta(
    parsed.meta?.[ONBOARDING_META_KEY] || parsed.onboarding || null
  );

  return {
    games: normalizedGames,
    sessions: normalizedSessions,
    meta: {
      [IDLE_JOURNEY_META_KEY]: idleJourney,
      [FOCUSED_GOALS_META_KEY]: focusedGoalsEnabled,
      ...(onboarding ? { [ONBOARDING_META_KEY]: onboarding } : {}),
    },
  };
}
