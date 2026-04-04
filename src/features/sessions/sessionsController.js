import { normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { getAllGames, updateGame } from "../../data/gamesRepo.js";
import { addSession, getAllSessions } from "../../data/sessionsRepo.js";
import {
  meaningfulProgressInput,
  sessionForm,
  sessionGameSelect,
  sessionMessage,
  sessionMinutesInput,
  sessionNoteInput,
  sessionObjectiveInput,
} from "../../core/dom.js";
import { GAME_STATUSES } from "../../core/constants.js";
import {
  buildXpSummary,
  canLogSessionForGame,
  formatMinutes,
  getErrorMessage,
  getSessionXpBreakdown,
  rollFocusPenalty,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { showMessage, showToast } from "../../core/ui.js";
import { notifyOnboardingSessionSaved } from "../onboarding/onboardingController.js";

export async function handleAddSession(event) {
  event.preventDefault();

  try {
    const result = await saveSessionEntry({
      gameId: sessionGameSelect.value,
      minutes: sessionMinutesInput.value,
      note: sessionNoteInput.value.trim(),
      updatedObjective: sessionObjectiveInput.value.trim(),
      meaningfulProgress: meaningfulProgressInput.checked,
    });

    sessionForm.reset();
    meaningfulProgressInput.checked = false;

    showMessage(
      sessionMessage,
      result.successMessage
    );

    await appState.renderApp();
    await notifyOnboardingSessionSaved();
    sessionGameSelect.value = result.selectedGame.id;
    showToast(result.toastMessage, {
      title: "Progress logged",
    });

    if (result.levelUpMessage) {
      showToast(result.levelUpMessage, {
        title: "Level up",
        tone: "info",
        duration: 4200,
      });
    }
  } catch (error) {
    console.error("Failed to save session:", error);
    showMessage(
      sessionMessage,
      getErrorMessage(error, t("sessions.messages.saveFailed")),
      true
    );
  }
}

export async function saveSessionEntry({
  gameId,
  minutes,
  note = "",
  updatedObjective = "",
  meaningfulProgress = false,
}) {
  const safeGameId = String(gameId || "").trim();
  const numericMinutes = Number(minutes);
  const safeNote = String(note || "").trim();
  const safeObjective = String(updatedObjective || "").trim();

  if (!safeGameId) {
    throw new Error(t("sessions.messages.noGameSelected"));
  }

  if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    throw new Error(t("sessions.messages.invalidMinutes"));
  }

  const [gamesRaw, sessionsRaw] = await Promise.all([
    getAllGames(appState.db),
    getAllSessions(appState.db),
  ]);
  const games = gamesRaw.map((game) => normalizeGameRecord(game));
  const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
  const selectedGame = games.find((game) => game.id === safeGameId);

  if (!selectedGame) {
    throw new Error(t("sessions.messages.gameNotFound"));
  }

  if (!canLogSessionForGame(selectedGame)) {
    throw new Error(
      t("sessions.messages.needsInProgress", { title: selectedGame.title })
    );
  }

  const focusTax = rollFocusPenalty({
    selectedGame,
    allGames: games,
    meaningfulProgress,
    minutes: numericMinutes,
    focusedGoalsEnabled: appState.focusedGoalsEnabled,
  });

  const now = new Date().toISOString();

  const newSession = normalizeSessionRecord({
    id: crypto.randomUUID(),
    gameId: safeGameId,
    minutes: numericMinutes,
    note: safeNote,
    meaningfulProgress,
    focusPenaltyXp: focusTax.penaltyXp,
    focusPenaltyReason: focusTax.reason,
    playedAt: now,
    createdAt: now,
  });
  const previousXpSummary = buildXpSummary(games, sessions);
  const nextXpSummary = buildXpSummary(games, [...sessions, newSession]);

  await addSession(appState.db, newSession);
  await updateGame(appState.db, {
    ...selectedGame,
    currentObjective:
      safeObjective || selectedGame.currentObjective || selectedGame.notes || "",
    updatedAt: now,
  });

  const replayText =
    selectedGame.status === GAME_STATUSES.COMPLETED
      ? t("sessions.messages.replaySuffix")
      : "";
  const xpBreakdown = getSessionXpBreakdown(newSession);
  const focusText = xpBreakdown.focusPenalty
    ? t("sessions.messages.focusTaxSuffix", {
        value: xpBreakdown.focusPenalty,
      })
    : "";
  const objectiveText = safeObjective
    ? t("sessions.messages.objectiveUpdatedSuffix")
    : "";

  return {
    selectedGame,
    successMessage: t("sessions.messages.logged", {
      duration: formatMinutes(numericMinutes),
      replayText,
      title: selectedGame.title,
      totalText: xpBreakdown.totalText,
      focusText,
      objectiveText,
    }),
    toastMessage: `Logged ${formatMinutes(numericMinutes)} for ${selectedGame.title}. ${xpBreakdown.totalText}.`,
    levelUpMessage:
      nextXpSummary.level > previousXpSummary.level
        ? buildLevelUpToast(previousXpSummary.level, nextXpSummary.level)
        : "",
  };
}

function buildLevelUpToast(previousLevel, nextLevel) {
  const levelGain = Math.max(1, nextLevel - previousLevel);
  const pointLabel = levelGain === 1 ? "point" : "points";

  return `Reached goal tracker level ${nextLevel}. ${levelGain} skill ${pointLabel} ready to spend.`;
}
