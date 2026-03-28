import { normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { getAllGames, updateGame } from "../../data/gamesRepo.js";
import { addSession } from "../../data/sessionsRepo.js";
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
  canLogSessionForGame,
  formatMinutes,
  getErrorMessage,
  getSessionXpBreakdown,
  rollFocusPenalty,
} from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { showMessage } from "../../core/ui.js";

export async function handleAddSession(event) {
  event.preventDefault();

  const gameId = sessionGameSelect.value;
  const minutes = Number(sessionMinutesInput.value);
  const note = sessionNoteInput.value.trim();
  const updatedObjective = sessionObjectiveInput.value.trim();
  const meaningfulProgress = meaningfulProgressInput.checked;

  if (!gameId) {
    showMessage(
      sessionMessage,
      "Move a game into progress before logging sessions.",
      true
    );
    return;
  }

  if (!Number.isFinite(minutes) || minutes <= 0) {
    showMessage(
      sessionMessage,
      "Please enter a valid number of minutes.",
      true
    );
    return;
  }

  try {
    const games = (await getAllGames(appState.db)).map((game) =>
      normalizeGameRecord(game)
    );
    const selectedGame = games.find((game) => game.id === gameId);

    if (!selectedGame) {
      showMessage(sessionMessage, "That game could not be found.", true);
      return;
    }

    if (!canLogSessionForGame(selectedGame)) {
      showMessage(
        sessionMessage,
        `${selectedGame.title} needs to be In Progress before you log another session.`,
        true
      );
      return;
    }

    const focusTax = rollFocusPenalty({
      selectedGame,
      allGames: games,
      meaningfulProgress,
      minutes,
    });

    const now = new Date().toISOString();

    const newSession = normalizeSessionRecord({
      id: crypto.randomUUID(),
      gameId,
      minutes,
      note,
      meaningfulProgress,
      focusPenaltyXp: focusTax.penaltyXp,
      focusPenaltyReason: focusTax.reason,
      playedAt: now,
      createdAt: now,
    });

    await addSession(appState.db, newSession);
    await updateGame(appState.db, {
      ...selectedGame,
      currentObjective:
        updatedObjective || selectedGame.currentObjective || selectedGame.notes || "",
      updatedAt: now,
    });

    sessionForm.reset();
    meaningfulProgressInput.checked = false;

    const replayText =
      selectedGame.status === GAME_STATUSES.COMPLETED ? " replay" : "";
    const xpBreakdown = getSessionXpBreakdown(newSession);
    const focusText = xpBreakdown.focusPenalty
      ? ` • Focus tax ${xpBreakdown.focusPenalty}`
      : "";

    showMessage(
      sessionMessage,
      `Logged ${formatMinutes(minutes)}${replayText} for "${
        selectedGame.title
      }" • ${xpBreakdown.totalText}${focusText}${
        updatedObjective ? " • Objective updated." : ""
      }.`
    );

    await appState.renderApp();
    sessionGameSelect.value = gameId;
  } catch (error) {
    console.error("Failed to save session:", error);
    showMessage(sessionMessage, "Could not save session.", true);
  }
}
