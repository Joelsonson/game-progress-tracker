import { isMainEligibleStatus, normalizeGameRecord } from "../../data/db.js";
import { addGame, getAllGames, setMainGame, updateGame, updateGames } from "../../data/gamesRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import {
  bannerArtPickerInput,
  bannerImageInput,
  coverArtPickerInput,
  coverImageInput,
  defaultCoverImageInputs,
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
  getDifficultyPreviewText,
  getErrorMessage,
  getGameCompletionXp,
  getStatusLabel,
  hasGameChanged,
  isCropCancelError,
  isGameCompletable,
  isValidStatus,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { openFilePicker, scrollDeck, showMessage, showToast } from "../../core/ui.js";
import { downloadCompletionCard } from "../art/completionCard.js";
import { optimizeUploadedImage } from "../art/imageCropper.js";
import { notifyOnboardingGoalSaved } from "../onboarding/onboardingController.js";
import { saveSessionEntry } from "../sessions/sessionsController.js";
import { renderGameActionSheet } from "./gamesView.js";

export function openGameActionsSheet(game) {
  if (!gameActionsModal || !gameActionsBodyEl || !gameActionsTitleEl || !gameActionsMetaEl) {
    return;
  }

  gameActionsTitleEl.textContent = t("tracker.manageCard");
  gameActionsMetaEl.textContent = t("tracker.actionSheetBody");
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

export async function handleGameActionsSubmit(event) {
  event.preventDefault();

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  const feedbackEl = form.querySelector("[data-game-action-feedback]");
  if (feedbackEl instanceof HTMLElement) {
    feedbackEl.textContent = "";
  }

  if (form.matches("[data-game-session-form]")) {
    const formData = new FormData(form);

    try {
      const result = await saveSessionEntry({
        gameId: formData.get("gameId"),
        minutes: formData.get("minutes"),
        note: formData.get("note"),
        meaningfulProgress: formData.get("meaningfulProgress") === "on",
      });

      closeGameActionsSheet();
      await appState.renderApp();
      await notifyOnboardingSessionSaved();
      showToast(result.toastMessage, {
        placement: "top",
        replace: true,
      });

      if (result.levelUpMessage) {
        showToast(result.levelUpMessage, {
          title: "Level up",
          tone: "info",
          duration: 4200,
        });
      }
    } catch (error) {
      console.error("Failed to save session from action sheet:", error);
      showMessage(
        feedbackEl,
        getErrorMessage(error, t("sessions.messages.saveFailed")),
        true
      );
    }

    return;
  }

  if (form.matches("[data-game-edit-form]")) {
    const formData = new FormData(form);
    const gameId = String(formData.get("gameId") || "").trim();
    const nextTitle = String(formData.get("title") || "").trim();
    const nextObjective = String(formData.get("currentObjective") || "").trim();

    if (!nextTitle) {
      showMessage(feedbackEl, t("games.add.titleMissing"), true);
      return;
    }

    try {
      const game = await getGameById(gameId);

      if (!game) {
        showMessage(feedbackEl, t("games.messages.notFound"), true);
        return;
      }

      const now = new Date().toISOString();
      const updatedGame = normalizeGameRecord({
        ...game,
        title: nextTitle,
        currentObjective: nextObjective,
        updatedAt: now,
      });

      await updateGame(appState.db, updatedGame);
      closeGameActionsSheet();
      await appState.renderApp();
      showToast(
        t("games.messages.detailsUpdated", { title: updatedGame.title }),
        {
          placement: "top",
          replace: true,
        }
      );
    } catch (error) {
      console.error("Failed to update goal details:", error);
      showMessage(
        feedbackEl,
        getErrorMessage(error, t("games.messages.updateFailed")),
        true
      );
    }
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

  if (status === GAME_STATUSES.COMPLETED && !isGameCompletable(difficulty)) {
    showMessage(formMessage, t("games.messages.cannotComplete"), true);
    return;
  }

  try {
    const uploadedCoverImage = await optimizeUploadedImage(
      coverImageInput.files?.[0],
      "cover"
    );
    const bannerImage = await optimizeUploadedImage(
      bannerImageInput.files?.[0],
      "banner"
    );
    const coverImage =
      uploadedCoverImage || getSelectedBundledCoverImage();

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
      isMain: false,
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

    if (newGame.status === GAME_STATUSES.COMPLETED) {
      showMessage(
        formMessage,
        t("games.add.addedCompleted", {
          title,
          rewardXp: getGameCompletionXp(newGame),
        })
      );
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
    await notifyOnboardingGoalSaved();
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
  const completedOption = gameStatusInput?.querySelector('option[value="completed"]');
  const canComplete = isGameCompletable(difficulty);

  if (completedOption instanceof HTMLOptionElement) {
    completedOption.disabled = !canComplete;
  }

  if (!canComplete && gameStatusInput?.value === GAME_STATUSES.COMPLETED) {
    gameStatusInput.value = DEFAULT_GAME_STATUS;
  }

  difficultyRewardPreview.textContent = getDifficultyPreviewText(difficulty);
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

function getSelectedBundledCoverImage() {
  const selectedInput = defaultCoverImageInputs.find((input) => input.checked);
  const selectedValue = selectedInput?.value || "";

  return String(selectedValue || "").trim();
}

export async function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id, status, target, direction, coverSrc } = button.dataset;
  const triggeredFromActionSheet = Boolean(button.closest("#gameActionsModal"));
  const shouldToast = triggeredFromActionSheet;

  try {
    if (action === "scroll-deck") {
      scrollDeck(target, direction);
      return;
    }

    const game = await getGameById(id);

    if (!game) {
      showFeedback(t("games.messages.notFound"), {
        isError: true,
        toast: shouldToast,
      });
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
        showFeedback(t("games.messages.makeMainRestricted"), {
          isError: true,
          toast: shouldToast,
        });
        return;
      }

      await setMainGame(appState.db, id);
      showFeedback(t("games.messages.nowMain", { title: game.title }), {
        toast: shouldToast,
      });
      await appState.renderApp();
      return;
    }

    if (action === "pick-cover-art") {
      appState.pendingArtTarget = {
        gameId: id,
        kind: "cover",
        toast: shouldToast,
      };
      openFilePicker(coverArtPickerInput);
      return;
    }

    if (action === "pick-banner-art") {
      appState.pendingArtTarget = {
        gameId: id,
        kind: "banner",
        toast: shouldToast,
      };
      openFilePicker(bannerArtPickerInput);
      return;
    }

    if (action === "set-built-in-cover") {
      const nextCoverImage = String(coverSrc || "").trim();
      if (!nextCoverImage) {
        showFeedback(t("games.messages.artUpdateFailed"), {
          isError: true,
          toast: shouldToast,
        });
        return;
      }

      const now = new Date().toISOString();
      await updateGame(appState.db, {
        ...game,
        coverImage: nextCoverImage,
        artUpdatedAt: now,
        updatedAt: now,
      });
      showFeedback(
        t("games.messages.artUpdated", {
          kindLabel: t("games.add.coverLabel"),
          title: game.title,
        }),
        { toast: shouldToast }
      );
      await appState.renderApp();
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
      showFeedback(t("games.messages.clearedArt", { title: game.title }), {
        toast: shouldToast,
      });
      await appState.renderApp();
      return;
    }

    if (action === "download-card") {
      await downloadCompletionCard(game);
      showFeedback(t("games.messages.savedCard", { title: game.title }), {
        toast: shouldToast,
      });
      return;
    }

    if (action === "set-status") {
      if (!isValidStatus(status)) {
        showFeedback(t("games.messages.statusNotSupported"), {
          isError: true,
          toast: shouldToast,
        });
        return;
      }

      if (status === GAME_STATUSES.COMPLETED && !isGameCompletable(game)) {
        showFeedback(t("games.messages.cannotComplete"), {
          isError: true,
          toast: shouldToast,
        });
        return;
      }

      const updatedGame = buildGameForStatus(game, status);
      await updateGame(appState.db, updatedGame);

      if (status === GAME_STATUSES.COMPLETED) {
        const sessions = await getAllSessions(appState.db);
        const sessionStats = buildSessionStats(sessions);
        showFeedback(buildCompletionMessage(updatedGame, sessionStats), {
          toast: shouldToast,
        });
      } else {
        showFeedback(
          t("games.messages.movedStatus", {
            title: game.title,
            statusLabel: getStatusLabel(updatedGame.status),
          }),
          { toast: shouldToast }
        );
      }

      await appState.renderApp();
    }
  } catch (error) {
    if (isCropCancelError(error)) {
      showFeedback(t("games.add.cropCancelled"), {
        isError: true,
        toast: shouldToast,
      });
      return;
    }

    console.error("Failed to update game:", error);
    showFeedback(getErrorMessage(error, t("games.messages.updateFailed")), {
      isError: true,
      toast: shouldToast,
    });
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
      showFeedback(t("games.messages.notFound"), {
        isError: true,
        toast: Boolean(activeTarget?.toast),
      });
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

    showFeedback(
      t("games.messages.artUpdated", {
        kindLabel:
          kind === "cover"
            ? t("games.add.coverLabel")
            : t("games.add.bannerLabel"),
        title: game.title,
      }),
      { toast: Boolean(activeTarget?.toast) }
    );
    await appState.renderApp();
  } catch (error) {
    if (isCropCancelError(error)) {
      showFeedback(t("games.add.cropCancelled"), {
        isError: true,
        toast: Boolean(activeTarget?.toast),
      });
      return;
    }

    console.error("Failed to update art:", error);
    showFeedback(getErrorMessage(error, t("games.messages.artUpdateFailed")), {
      isError: true,
      toast: Boolean(activeTarget?.toast),
    });
  }
}

async function getGameById(gameId) {
  const safeGameId = String(gameId || "").trim();
  if (!safeGameId) return null;

  const games = (await getAllGames(appState.db)).map((game) =>
    normalizeGameRecord(game)
  );
  return games.find((entry) => entry.id === safeGameId) || null;
}

function showFeedback(message, { isError = false, toast = false } = {}) {
  if (toast) {
    showToast(message, {
      tone: isError ? "error" : "success",
      placement: "top",
      replace: true,
    });
    return;
  }

  showMessage(formMessage, message, isError);
}
