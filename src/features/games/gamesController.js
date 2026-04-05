import { isMainEligibleStatus, normalizeGameRecord } from "../../data/db.js";
import { addGame, getAllGames, setMainGame, updateGame, updateGames } from "../../data/gamesRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import {
  bannerImagePreviewEl,
  bannerImagePreviewImageEl,
  bannerArtPickerInput,
  bannerImageInput,
  builtInCoverLibraryModal,
  completionShowcaseBodyEl,
  completionShowcaseModal,
  coverArtPickerInput,
  coverImageInput,
  coverImagePreviewEl,
  coverImagePreviewImageEl,
  difficultyRewardPreview,
  formMessage,
  gameActionsBodyEl,
  gameActionsMetaEl,
  gameActionsModal,
  gameActionsTitleEl,
  gameForm,
  gameDifficultyRangeInput,
  gameDifficultySelectorEl,
  gameDifficultyValueInput,
  gameStatusInput,
  notesInput,
  platformInput,
  selectedBuiltInCoverImageInput,
  titleInput,
} from "../../core/dom.js";
import {
  BUILT_IN_COVER_IMAGE_DIRECTORY,
  BUILT_IN_COVER_IMAGE_DISCOVERY_MAX,
  BUILT_IN_COVER_IMAGE_EXTENSION,
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
  isGameCompletable,
  isValidStatus,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import {
  openFilePicker,
  scrollDeck,
  showMessage,
  showToast,
  syncBodyScrollLock,
} from "../../core/ui.js";
import { downloadCompletionCard } from "../art/completionCard.js";
import { optimizeUploadedImage } from "../art/imageCropper.js";
import {
  notifyOnboardingGoalSaved,
  notifyOnboardingSessionSaved,
} from "../onboarding/onboardingController.js";
import { saveSessionEntry } from "../sessions/sessionsController.js";
import {
  renderBuiltInCoverPicker,
  renderCompletionShowcase,
  renderGameActionSheet,
} from "./gamesView.js";

let builtInCoverDiscoveryPromise = null;
const GAME_DIFFICULTY_ORDER = [
  GAME_DIFFICULTIES.NOT_APPLICABLE,
  GAME_DIFFICULTIES.VERY_EASY,
  GAME_DIFFICULTIES.EASY,
  GAME_DIFFICULTIES.STANDARD,
  GAME_DIFFICULTIES.HARD,
  GAME_DIFFICULTIES.VERY_HARD,
];
const addGoalPreviewObjectUrls = {
  cover: "",
  banner: "",
};

export function openGameActionsSheet(game) {
  if (!gameActionsModal || !gameActionsBodyEl || !gameActionsTitleEl || !gameActionsMetaEl) {
    return;
  }

  gameActionsTitleEl.textContent = t("tracker.manageCard");
  gameActionsMetaEl.textContent = "";
  gameActionsMetaEl.hidden = true;
  gameActionsBodyEl.innerHTML = renderGameActionSheet(game);
  gameActionsModal.hidden = false;
  syncBodyScrollLock();
}

export function closeGameActionsSheet() {
  if (!gameActionsModal || !gameActionsBodyEl) return;

  gameActionsModal.hidden = true;
  gameActionsBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export async function openCompletionShowcaseModal(game) {
  if (!completionShowcaseModal || !completionShowcaseBodyEl) {
    return;
  }

  const sessions = await getAllSessions(appState.db);
  const sessionStats = buildSessionStats(sessions);

  completionShowcaseBodyEl.innerHTML = renderCompletionShowcase(
    game,
    sessionStats.get(game.id)
  );
  completionShowcaseModal.hidden = false;
  syncBodyScrollLock();
}

export function closeCompletionShowcaseModal() {
  if (!completionShowcaseModal || !completionShowcaseBodyEl) return;

  completionShowcaseModal.hidden = true;
  completionShowcaseBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function handleCompletionShowcaseModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-completion-showcase]")) {
    closeCompletionShowcaseModal();
  }
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

export async function primeBuiltInCoverImageOptions({ force = false } = {}) {
  if (!force && appState.builtInCoverImageOptions.length) {
    return appState.builtInCoverImageOptions;
  }

  if (builtInCoverDiscoveryPromise) {
    return builtInCoverDiscoveryPromise;
  }

  appState.builtInCoverImageOptionsLoading = true;
  renderBuiltInCoverPicker();

  builtInCoverDiscoveryPromise = discoverBuiltInCoverImageOptions()
    .then((options) => {
      appState.builtInCoverImageOptions = options;
      return options;
    })
    .finally(() => {
      appState.builtInCoverImageOptionsLoading = false;
      builtInCoverDiscoveryPromise = null;
      renderBuiltInCoverPicker();
    });

  return builtInCoverDiscoveryPromise;
}

export function openBuiltInCoverLibraryModal() {
  if (!builtInCoverLibraryModal) return;

  void primeBuiltInCoverImageOptions();
  builtInCoverLibraryModal.hidden = false;
  syncBodyScrollLock();
}

export function closeBuiltInCoverLibraryModal() {
  if (!builtInCoverLibraryModal) return;

  builtInCoverLibraryModal.hidden = true;
  syncBodyScrollLock();
}

export function handleBuiltInCoverLibraryModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-built-in-cover-library]")) {
    closeBuiltInCoverLibraryModal();
  }
}

export function handleBuiltInCoverLibraryChange(event) {
  const input = event.target;

  if (
    !(input instanceof HTMLInputElement) ||
    input.name !== "builtInCoverLibraryOption"
  ) {
    return;
  }

  if (selectedBuiltInCoverImageInput) {
    selectedBuiltInCoverImageInput.value = String(input.value || "").trim();
  }

  if (coverImageInput) {
    coverImageInput.value = "";
  }

  renderBuiltInCoverPicker();
  syncAddGameArtPreviews();
  closeBuiltInCoverLibraryModal();
}

export function handleAddGameArtInputChange(event) {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }

  if (event.target === coverImageInput && coverImageInput?.files?.length) {
    if (selectedBuiltInCoverImageInput) {
      selectedBuiltInCoverImageInput.value = "";
    }
    renderBuiltInCoverPicker();
  }

  syncAddGameArtPreviews();
}

export function syncAddGameArtPreviews() {
  syncAddGamePreview("cover", {
    file: coverImageInput?.files?.[0] || null,
    staticSrc: coverImageInput?.files?.length
      ? ""
      : String(selectedBuiltInCoverImageInput?.value || "").trim(),
    shell: coverImagePreviewEl,
    image: coverImagePreviewImageEl,
    label: t("games.add.coverLabel"),
  });

  syncAddGamePreview("banner", {
    file: bannerImageInput?.files?.[0] || null,
    staticSrc: "",
    shell: bannerImagePreviewEl,
    image: bannerImagePreviewImageEl,
    label: t("games.add.bannerLabel"),
  });
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
    if (!appState.builtInCoverImageOptions.length) {
      await primeBuiltInCoverImageOptions();
    }

    const uploadedCoverImage = await optimizeUploadedImage(
      coverImageInput.files?.[0],
      "cover"
    );
    const bannerImage = await optimizeUploadedImage(
      bannerImageInput.files?.[0],
      "banner"
    );
    const coverImage =
      uploadedCoverImage ||
      getSelectedBundledCoverImage() ||
      getRandomBuiltInCoverImage();

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
    renderBuiltInCoverPicker();
    syncAddGameArtPreviews();
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
  const difficulty = getSelectedGameDifficulty();
  const completedOption = gameStatusInput?.querySelector('option[value="completed"]');
  const canComplete = isGameCompletable(difficulty);
  const selectedIndex = GAME_DIFFICULTY_ORDER.indexOf(difficulty);

  if (completedOption instanceof HTMLOptionElement) {
    completedOption.disabled = !canComplete;
  }

  if (!canComplete && gameStatusInput?.value === GAME_STATUSES.COMPLETED) {
    gameStatusInput.value = DEFAULT_GAME_STATUS;
  }

  if (gameDifficultyValueInput) {
    gameDifficultyValueInput.value = difficulty;
  }

  if (gameDifficultyRangeInput) {
    const safeIndex = selectedIndex >= 0 ? selectedIndex : getDefaultDifficultyIndex();
    const progressPercent =
      (safeIndex / Math.max(1, GAME_DIFFICULTY_ORDER.length - 1)) * 100;

    gameDifficultyRangeInput.value = String(safeIndex);
    gameDifficultyRangeInput.style.setProperty(
      "--difficulty-progress",
      `${progressPercent.toFixed(2)}%`
    );
    gameDifficultyRangeInput.setAttribute(
      "aria-valuetext",
      getGameDifficultyLabel(difficulty)
    );
  }

  if (gameDifficultySelectorEl) {
    const stops = gameDifficultySelectorEl.querySelectorAll("[data-difficulty-stop]");
    for (const stop of stops) {
      if (!(stop instanceof HTMLElement)) continue;
      stop.classList.toggle("is-active", stop.dataset.difficultyStop === difficulty);
    }
  }

  if (difficultyRewardPreview) {
    difficultyRewardPreview.innerHTML = buildDifficultyPreviewMarkup(difficulty);
  }
}

function getSelectedGameDifficulty() {
  const fallbackIndex = Number.parseInt(gameDifficultyRangeInput?.value || "", 10);
  const nextDifficulty =
    GAME_DIFFICULTY_ORDER[
      Number.isFinite(fallbackIndex) ? Math.max(0, Math.min(fallbackIndex, GAME_DIFFICULTY_ORDER.length - 1)) : getDefaultDifficultyIndex()
    ];

  if (isValidGameDifficulty(nextDifficulty)) {
    return nextDifficulty;
  }

  const currentValue = String(gameDifficultyValueInput?.value || "").trim();
  if (isValidGameDifficulty(currentValue)) {
    return currentValue;
  }

  return DEFAULT_GAME_DIFFICULTY;
}

function resetGameDifficultySelection() {
  if (gameDifficultyRangeInput) {
    gameDifficultyRangeInput.value = String(getDefaultDifficultyIndex());
  }

  if (gameDifficultyValueInput) {
    gameDifficultyValueInput.value = DEFAULT_GAME_DIFFICULTY;
  }
}

function isValidGameDifficulty(value) {
  return Object.values(GAME_DIFFICULTIES).includes(value);
}

function getSelectedBundledCoverImage() {
  return String(selectedBuiltInCoverImageInput?.value || "").trim();
}

function getRandomBuiltInCoverImage() {
  const options = Array.isArray(appState.builtInCoverImageOptions)
    ? appState.builtInCoverImageOptions
    : [];

  if (!options.length) {
    return "";
  }

  const randomIndex = Math.floor(Math.random() * options.length);
  return String(options[randomIndex]?.src || "").trim();
}

function getDefaultDifficultyIndex() {
  const defaultIndex = GAME_DIFFICULTY_ORDER.indexOf(DEFAULT_GAME_DIFFICULTY);
  return defaultIndex >= 0 ? defaultIndex : 0;
}

function buildDifficultyPreviewMarkup(difficulty) {
  const label = getGameDifficultyLabel(difficulty);
  const rewardValue = isGameCompletable(difficulty)
    ? `+${getGameCompletionXp({ difficulty })} XP`
    : t("games.add.noRewardValue");

  return `
    <div class="difficulty-preview-pill">
      <span class="difficulty-preview-label">${label}</span>
      <strong class="difficulty-preview-value">${rewardValue}</strong>
    </div>
  `;
}

function syncAddGamePreview(kind, { file, staticSrc, shell, image, label }) {
  if (!(shell instanceof HTMLElement) || !(image instanceof HTMLImageElement)) {
    return;
  }

  const nextStaticSrc = String(staticSrc || "").trim();
  const source = file instanceof File ? URL.createObjectURL(file) : nextStaticSrc;
  const previousObjectUrl = addGoalPreviewObjectUrls[kind];

  if (previousObjectUrl) {
    URL.revokeObjectURL(previousObjectUrl);
    addGoalPreviewObjectUrls[kind] = "";
  }

  if (file instanceof File) {
    addGoalPreviewObjectUrls[kind] = source;
  }

  if (source) {
    image.hidden = false;
    image.src = source;
    image.alt = label;
    shell.classList.add("is-filled");
    return;
  }

  image.hidden = true;
  image.removeAttribute("src");
  image.alt = "";
  shell.classList.remove("is-filled");
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

    if (action === "open-completion-showcase") {
      await openCompletionShowcaseModal(game);
      return;
    }

    if (action === "open-game-actions") {
      if (game.status === GAME_STATUSES.COMPLETED) {
        await openCompletionShowcaseModal(game);
        return;
      }

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

async function discoverBuiltInCoverImageOptions() {
  const candidates = Array.from(
    { length: BUILT_IN_COVER_IMAGE_DISCOVERY_MAX },
    (_, index) => index + 1
  );

  const discovered = await Promise.all(
    candidates.map(async (index) => {
      const src = `${BUILT_IN_COVER_IMAGE_DIRECTORY}/${index}.${BUILT_IN_COVER_IMAGE_EXTENSION}`;
      const exists = await checkImageExists(src);

      if (!exists) {
        return null;
      }

      return {
        id: `default-cover-${index}`,
        src,
        index,
      };
    })
  );

  return discovered.filter(Boolean);
}

function checkImageExists(src) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}
