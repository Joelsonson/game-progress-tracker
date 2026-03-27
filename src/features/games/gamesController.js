import { isMainEligibleStatus, normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { addGame, getAllGames, setMainGame, updateGame, updateGames } from "../../data/gamesRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import {
  addGamePanel,
  bannerArtPickerInput,
  bannerImageInput,
  coverArtPickerInput,
  coverImageInput,
  formMessage,
  gameForm,
  gameStatusInput,
  notesInput,
  platformInput,
  titleInput,
} from "../../core/dom.js";
import { DEFAULT_GAME_STATUS, GAME_STATUSES, IMAGE_PRESET, XP_RULES } from "../../core/constants.js";
import {
  buildCompletionMessage,
  buildGameForStatus,
  buildSessionStats,
  enforceMainGameRules,
  getErrorMessage,
  getStatusLabel,
  hasGameChanged,
  isCropCancelError,
  isValidStatus,
} from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { openFilePicker, scrollDeck, showMessage } from "../../core/ui.js";
import { downloadCompletionCard } from "../art/completionCard.js";
import { optimizeUploadedImage } from "../art/imageCropper.js";
import { isMobileViewport, setActiveScreen } from "../navigation/navigation.js";

export async function repairGamesIfNeeded() {
  const games = await getAllGames(appState.db);
  if (!games.length) return;

  const normalizedGames = games.map((game) => normalizeGameRecord(game));
  const repairedGames = enforceMainGameRules(normalizedGames);
  const changedGames = repairedGames.filter((game, index) =>
    hasGameChanged(games[index], game)
  );

  if (changedGames.length) {
    await updateGames(appState.db, changedGames);
  }
}

export async function handleAddGame(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const platform = platformInput.value.trim();
  const currentObjective = notesInput.value.trim();
  const status = isValidStatus(gameStatusInput.value)
    ? gameStatusInput.value
    : DEFAULT_GAME_STATUS;

  if (!title) {
    showMessage(formMessage, "Please enter a game title.", true);
    return;
  }

  try {
    const existingGames = await getAllGames(appState.db);
    const coverImage = await optimizeUploadedImage(
      coverImageInput.files?.[0],
      "cover"
    );
    const bannerImage = await optimizeUploadedImage(
      bannerImageInput.files?.[0],
      "banner"
    );

    const normalizedGames = enforceMainGameRules(
      existingGames.map((game) => normalizeGameRecord(game))
    );
    const hasMainGame = normalizedGames.some((game) => game.isMain);
    const now = new Date().toISOString();

    const newGame = normalizeGameRecord({
      id: crypto.randomUUID(),
      title,
      platform: platform || "Unspecified",
      currentObjective,
      notes: "",
      coverImage,
      bannerImage,
      artUpdatedAt: coverImage || bannerImage ? now : null,
      status,
      isMain: isMainEligibleStatus(status) && !hasMainGame,
      completedAt: status === GAME_STATUSES.COMPLETED ? now : null,
      pausedAt: status === GAME_STATUSES.PAUSED ? now : null,
      droppedAt: status === GAME_STATUSES.DROPPED ? now : null,
      createdAt: now,
      updatedAt: now,
    });

    await addGame(appState.db, newGame);
    gameForm.reset();
    gameStatusInput.value = DEFAULT_GAME_STATUS;
    if (addGamePanel) addGamePanel.open = false;

    if (newGame.status === GAME_STATUSES.COMPLETED) {
      showMessage(
        formMessage,
        `Added and finished "${title}". Nice. +${XP_RULES.completionBonus} XP.`
      );
    } else if (newGame.isMain) {
      showMessage(formMessage, `Added "${title}" as your Main Game.`);
    } else {
      showMessage(
        formMessage,
        `Added "${title}" to ${getStatusLabel(newGame.status)}.`
      );
    }

    await appState.renderApp();
    setActiveScreen("tracker", {
      store: true,
      scrollToTop: isMobileViewport(),
    });
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, "Image crop cancelled.", true);
      return;
    }

    console.error("Failed to save game:", error);
    showMessage(formMessage, getErrorMessage(error, "Could not save game."), true);
  }
}

export async function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id, status, target, direction } = button.dataset;

  try {
    if (action === "scroll-deck") {
      scrollDeck(target, direction);
      return;
    }

    const games = (await getAllGames(appState.db)).map((game) =>
      normalizeGameRecord(game)
    );
    const game = games.find((entry) => entry.id === id);

    if (!game) {
      showMessage(formMessage, "That game could not be found.", true);
      return;
    }

    if (action === "make-main") {
      if (!isMainEligibleStatus(game.status)) {
        showMessage(
          formMessage,
          "Only in-progress games can be your Main Game.",
          true
        );
        return;
      }

      await setMainGame(appState.db, id);
      showMessage(formMessage, `"${game.title}" is now your Main Game.`);
      await appState.renderApp();
      return;
    }

    if (action === "pick-cover-art") {
      appState.pendingArtTarget = { gameId: id, kind: "cover" };
      openFilePicker(coverArtPickerInput);
      return;
    }

    if (action === "pick-banner-art") {
      appState.pendingArtTarget = { gameId: id, kind: "banner" };
      openFilePicker(bannerArtPickerInput);
      return;
    }

    if (action === "clear-art") {
      const now = new Date().toISOString();
      await updateGame(appState.db, {
        ...game,
        coverImage: "",
        bannerImage: "",
        artUpdatedAt: now,
        updatedAt: now,
      });
      showMessage(formMessage, `Cleared artwork for "${game.title}".`);
      await appState.renderApp();
      return;
    }

    if (action === "download-card") {
      await downloadCompletionCard(game);
      showMessage(formMessage, `Saved a completion card for "${game.title}".`);
      return;
    }

    if (action === "set-status") {
      if (!isValidStatus(status)) {
        showMessage(formMessage, "That status change is not supported.", true);
        return;
      }

      const updatedGame = buildGameForStatus(game, status);
      await updateGame(appState.db, updatedGame);

      if (status === GAME_STATUSES.COMPLETED) {
        const sessions = await getAllSessions(appState.db);
        const sessionStats = buildSessionStats(sessions);
        showMessage(
          formMessage,
          buildCompletionMessage(updatedGame, sessionStats)
        );
      } else {
        showMessage(
          formMessage,
          `Moved "${game.title}" to ${getStatusLabel(updatedGame.status)}.`
        );
      }

      await appState.renderApp();
    }
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, "Image crop cancelled.", true);
      return;
    }

    console.error("Failed to update game:", error);
    showMessage(formMessage, getErrorMessage(error, "Could not update game."), true);
  }
}

export async function handleArtPickerChange(kind) {
  const input = kind === "cover" ? coverArtPickerInput : bannerArtPickerInput;
  const file = input.files?.[0];
  const activeTarget = appState.pendingArtTarget;

  input.value = "";
  appState.pendingArtTarget = null;

  if (!file || !activeTarget || activeTarget.kind !== kind) {
    return;
  }

  try {
    const games = (await getAllGames(appState.db)).map((game) => normalizeGameRecord(game));
    const game = games.find((entry) => entry.id === activeTarget.gameId);

    if (!game) {
      showMessage(formMessage, "That game could not be found.", true);
      return;
    }

    const optimizedImage = await optimizeUploadedImage(file, kind);
    const now = new Date().toISOString();

    await updateGame(appState.db, {
      ...game,
      coverImage: kind === "cover" ? optimizedImage : game.coverImage,
      bannerImage: kind === "banner" ? optimizedImage : game.bannerImage,
      artUpdatedAt: now,
      updatedAt: now,
    });

    showMessage(
      formMessage,
      `Updated ${IMAGE_PRESET[kind].label} for "${game.title}".`
    );
    await appState.renderApp();
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, "Image crop cancelled.", true);
      return;
    }

    console.error("Failed to update art:", error);
    showMessage(
      formMessage,
      getErrorMessage(error, "Could not update game art."),
      true
    );
  }
}
