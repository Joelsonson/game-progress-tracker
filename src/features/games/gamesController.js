import { isMainEligibleStatus, normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { addGame, getAllGames, setMainGame, updateGame, updateGames } from "../../data/gamesRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import {
  addGamePanel,
  bannerArtPickerInput,
  bannerImageInput,
  coverArtPickerInput,
  coverImageInput,
  difficultyRewardPreview,
  formMessage,
  gameActionsBodyEl,
  gameActionsMetaEl,
  gameActionsModal,
  gameActionsTitleEl,
  gameForm,
  gameDifficultyInputs,
  gameStatusInput,
  notesInput,
  platformInput,
  titleInput,
} from "../../core/dom.js";
import {
  DEFAULT_GAME_DIFFICULTY,
  DEFAULT_GAME_STATUS,
  GAME_DIFFICULTIES,
  GAME_STATUSES,
} from "../../core/constants.js";
import {
  buildCompletionMessage,
  buildGameForStatus,
  buildSessionStats,
  enforceMainGameRules,
  getErrorMessage,
  getGameCompletionXp,
  getGameDifficultyLabel,
  getStatusLabel,
  hasGameChanged,
  isCropCancelError,
  isValidStatus,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { openFilePicker, scrollDeck, showMessage } from "../../core/ui.js";
import { downloadCompletionCard } from "../art/completionCard.js";
import { optimizeUploadedImage } from "../art/imageCropper.js";
import { renderGameActionSheet } from "./gamesView.js";

export function openGameActionsSheet(game) {
  if (!gameActionsModal || !gameActionsBodyEl || !gameActionsTitleEl || !gameActionsMetaEl) {
    return;
  }

  const platformLabel =
    game.platform && game.platform !== "Unspecified"
      ? game.platform
      : t("common.unspecified");
  gameActionsTitleEl.textContent = game.title;
  gameActionsMetaEl.textContent = t("tracker.actionSheetMeta", {
    platform: platformLabel,
    difficulty: getGameDifficultyLabel(game.difficulty),
    rewardXp: getGameCompletionXp(game),
  });
  gameActionsBodyEl.innerHTML = renderGameActionSheet(game);
  gameActionsModal.hidden = false;
  document.body.classList.add("has-overlay");
}

export function closeGameActionsSheet() {
  if (!gameActionsModal || !gameActionsBodyEl) return;

  gameActionsModal.hidden = true;
  gameActionsBodyEl.innerHTML = "";
  document.body.classList.remove("has-overlay");
}

export function handleGameActionsModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-game-actions]")) {
    closeGameActionsSheet();
  }
}

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
  const difficulty = getSelectedGameDifficulty();
  const status = isValidStatus(gameStatusInput.value)
    ? gameStatusInput.value
    : DEFAULT_GAME_STATUS;

  if (!title) {
    showMessage(formMessage, t("games.add.titleMissing"), true);
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
      difficulty,
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
    resetGameDifficultySelection();
    syncGameDifficultyPresentation();
    if (addGamePanel) addGamePanel.open = false;

    if (newGame.status === GAME_STATUSES.COMPLETED) {
      showMessage(
        formMessage,
        t("games.add.addedCompleted", {
          title,
          rewardXp: getGameCompletionXp(newGame),
        })
      );
    } else if (newGame.isMain) {
      showMessage(formMessage, t("games.add.addedMain", { title }));
    } else {
      showMessage(
        formMessage,
        t("games.add.addedToStatus", {
          title,
          statusLabel: getStatusLabel(newGame.status),
        })
      );
    }

    await appState.renderApp();
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, t("games.add.cropCancelled"), true);
      return;
    }

    console.error("Failed to save game:", error);
    showMessage(
      formMessage,
      getErrorMessage(error, t("games.add.saveFailed")),
      true
    );
  }
}

export function syncGameDifficultyPresentation() {
  if (!difficultyRewardPreview) return;

  const difficulty = getSelectedGameDifficulty();
  difficultyRewardPreview.textContent = t("difficulty.preview", {
    difficulty: getGameDifficultyLabel(difficulty),
    rewardXp: getGameCompletionXp({ difficulty }),
  });
}

function getSelectedGameDifficulty() {
  const selectedInput = gameForm?.querySelector('input[name="gameDifficulty"]:checked');
  return isValidGameDifficulty(selectedInput?.value)
    ? selectedInput.value
    : DEFAULT_GAME_DIFFICULTY;
}

function resetGameDifficultySelection() {
  for (const input of gameDifficultyInputs) {
    input.checked = input.value === DEFAULT_GAME_DIFFICULTY;
  }
}

function isValidGameDifficulty(value) {
  return Object.values(GAME_DIFFICULTIES).includes(value);
}

export async function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id, status, target, direction } = button.dataset;
  const triggeredFromActionSheet = Boolean(button.closest("#gameActionsModal"));

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
      showMessage(formMessage, t("games.messages.notFound"), true);
      return;
    }

    if (action === "open-game-actions") {
      openGameActionsSheet(game);
      return;
    }

    if (triggeredFromActionSheet) {
      closeGameActionsSheet();
    }

    if (action === "make-main") {
      if (!isMainEligibleStatus(game.status)) {
        showMessage(
          formMessage,
          t("games.messages.makeMainRestricted"),
          true
        );
        return;
      }

      await setMainGame(appState.db, id);
      showMessage(formMessage, t("games.messages.nowMain", { title: game.title }));
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
      showMessage(formMessage, t("games.messages.clearedArt", { title: game.title }));
      await appState.renderApp();
      return;
    }

    if (action === "download-card") {
      await downloadCompletionCard(game);
      showMessage(formMessage, t("games.messages.savedCard", { title: game.title }));
      return;
    }

    if (action === "set-status") {
      if (!isValidStatus(status)) {
        showMessage(formMessage, t("games.messages.statusNotSupported"), true);
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
          t("games.messages.movedStatus", {
            title: game.title,
            statusLabel: getStatusLabel(updatedGame.status),
          })
        );
      }

      await appState.renderApp();
    }
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, t("games.add.cropCancelled"), true);
      return;
    }

    console.error("Failed to update game:", error);
    showMessage(
      formMessage,
      getErrorMessage(error, t("games.messages.updateFailed")),
      true
    );
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
      showMessage(formMessage, t("games.messages.notFound"), true);
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
      t("games.messages.artUpdated", {
        kindLabel:
          kind === "cover"
            ? t("games.add.coverLabel")
            : t("games.add.bannerLabel"),
        title: game.title,
      })
    );
    await appState.renderApp();
  } catch (error) {
    if (isCropCancelError(error)) {
      showMessage(formMessage, t("games.add.cropCancelled"), true);
      return;
    }

    console.error("Failed to update art:", error);
    showMessage(
      formMessage,
      getErrorMessage(error, t("games.messages.artUpdateFailed")),
      true
    );
  }
}
