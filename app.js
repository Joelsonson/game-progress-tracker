import {
  openDB,
  getAllGames,
  getAllSessions,
  addGame,
  addSession,
  updateGame,
  updateGames,
  setMainGame,
  clearAllData,
  replaceAllData,
  getMeta,
  setMeta,
  GAME_STATUSES,
  DEFAULT_GAME_STATUS,
  normalizeGameRecord,
  normalizeSessionRecord,
  isMainEligibleStatus,
} from "./db.js";

const SESSION_ALLOWED_STATUSES = new Set([
  GAME_STATUSES.IN_PROGRESS,
  GAME_STATUSES.COMPLETED,
]);

const XP_RULES = {
  baseSessionXp: 10,
  minutesPerChunk: 15,
  xpPerChunk: 5,
  maxChunkXp: 20,
  meaningfulBonus: 15,
  completionBonus: 100,
  xpPerLevel: 100,
};

const IMAGE_PRESET = {
  cover: {
    width: 480,
    height: 640,
    quality: 0.88,
    label: "cover art",
    ratioLabel: "3:4 portrait",
    recommendedSize: "900×1200 or larger",
  },
  banner: {
    width: 1280,
    height: 720,
    quality: 0.86,
    label: "banner art",
    ratioLabel: "16:9 widescreen",
    recommendedSize: "1600×900 or larger",
  },
};

const CARD_TIER_META = {
  bronze: {
    label: "Bronze Finish",
    className: "tier-bronze",
    accentA: "#c19162",
    accentB: "#8b5e34",
    accentText: "#f5d0b5",
    subtitle: "A clean clear. Momentum matters.",
  },
  silver: {
    label: "Silver Finish",
    className: "tier-silver",
    accentA: "#e2e8f0",
    accentB: "#64748b",
    accentText: "#f8fafc",
    subtitle: "Strong consistency. A proper run.",
  },
  gold: {
    label: "Gold Finish",
    className: "tier-gold",
    accentA: "#facc15",
    accentB: "#ca8a04",
    accentText: "#fef3c7",
    subtitle: "High-value clear with serious effort.",
  },
  prismatic: {
    label: "Prismatic Finish",
    className: "tier-prismatic",
    accentA: "#c084fc",
    accentB: "#7c3aed",
    accentText: "#f3e8ff",
    subtitle: "Standout finish. This one shines.",
  },
  legendary: {
    label: "Legendary Finish",
    className: "tier-legendary",
    accentA: "#34d399",
    accentB: "#059669",
    accentText: "#d1fae5",
    subtitle: "Elite finish. Card-worthy with no notes.",
  },
};

const STATUS_META = {
  [GAME_STATUSES.BACKLOG]: {
    label: "Backlog",
    description:
      "Ideas you want to keep around without pretending you are actively playing them.",
    empty: "Nothing in backlog right now.",
    badgeClass: "status-backlog",
  },
  [GAME_STATUSES.IN_PROGRESS]: {
    label: "In Progress",
    description: "Your active rotation. Keep this list small to protect focus.",
    empty: "Nothing active yet. Move one game out of backlog when you are ready.",
    badgeClass: "status-in-progress",
  },
  [GAME_STATUSES.PAUSED]: {
    label: "Paused",
    description: "Games you have intentionally set aside for now.",
    empty: "Nothing is paused right now.",
    badgeClass: "status-paused",
  },
  [GAME_STATUSES.COMPLETED]: {
    label: "Completed",
    description:
      "Finished games live here. This is the section you are trying to grow.",
    empty: "No finished games yet. Your next one will look great here.",
    badgeClass: "status-completed",
  },
  [GAME_STATUSES.DROPPED]: {
    label: "Dropped",
    description:
      "Games you are done forcing. You can always rescue them later.",
    empty: "No dropped games right now.",
    badgeClass: "status-dropped",
  },
};

const IMPORT_FILE_ACCEPT = ["application/json", "text/json", ""];
const IMPORT_SCHEMA_VERSION = 2;

const IDLE_JOURNEY_META_KEY = "idleJourney";
const JOURNEY_BOSS_DISTANCE = 100;
const JOURNEY_TICK_MS = 1000 * 60 * 30;
const JOURNEY_LOG_LIMIT = 7;
const JOURNEY_STAT_KEYS = ["might", "finesse", "arcana", "vitality", "resolve"];

const FOCUS_TAX_META = {
  sideQuest: {
    label: "Side-quest drift",
    min: 6,
    max: 18,
  },
  replay: {
    label: "Replay distraction",
    min: 10,
    max: 24,
  },
};

const JOURNEY_CLASS_META = {
  warrior: {
    label: "Warrior",
    description: "Heavy hitter with better survivability and steadier boss runs.",
    bonuses: { might: 3, finesse: 0, arcana: 0, vitality: 2, resolve: 0 },
  },
  mage: {
    label: "Mage",
    description: "Arcane burst damage with stronger recovery tools.",
    bonuses: { might: 0, finesse: 0, arcana: 4, vitality: 0, resolve: 1 },
  },
  thief: {
    label: "Thief",
    description: "Faster travel, sharper scouting, and cleaner dodges.",
    bonuses: { might: 0, finesse: 4, arcana: 0, vitality: 0, resolve: 1 },
  },
};

const JOURNEY_STAT_META = {
  might: {
    label: "Might",
    help: "Raises melee damage and boss-breaking pressure.",
  },
  finesse: {
    label: "Finesse",
    help: "Boosts travel speed and helps soften encounter damage.",
  },
  arcana: {
    label: "Arcana",
    help: "Improves spell power and gives big boss-roll spikes.",
  },
  vitality: {
    label: "Vitality",
    help: "Raises max health and makes recovery more reliable.",
  },
  resolve: {
    label: "Resolve",
    help: "Slows hunger loss and improves endurance on long marches.",
  },
};

const JOURNEY_ZONE_NAMES = [
  "Ashen Road",
  "Thornwild",
  "Moonlit Fen",
  "Sunken Causeway",
  "Glass Dunes",
  "Ironspine Pass",
  "Storm Ruins",
  "Starfall Ridge",
];

const JOURNEY_BOSS_NAMES = [
  "Gate Hound Varkos",
  "Mire Warden Sel",
  "The Lantern Golem",
  "Sable Matriarch",
  "Abyss Drake Kor",
  "The Hollow Prince",
  "Chrono Basilisk",
  "Saint of Rust",
  "The Last Cartographer",
];

let db;
let pendingArtTarget = null;
let cropSession = null;
let activeScreenId = "home";

const MOBILE_BREAKPOINT_PX = 900;
const SCREEN_STORAGE_KEY = "gameTracker.activeScreen";
const DEFAULT_SCREEN_ID = "home";

const gameForm = document.querySelector("#gameForm");
const addGamePanel = document.querySelector("#addGamePanel");
const titleInput = document.querySelector("#title");
const platformInput = document.querySelector("#platform");
const gameStatusInput = document.querySelector("#gameStatus");
const notesInput = document.querySelector("#notes");
const coverImageInput = document.querySelector("#coverImage");
const bannerImageInput = document.querySelector("#bannerImage");
const formMessage = document.querySelector("#formMessage");

const sessionForm = document.querySelector("#sessionForm");
const sessionGameSelect = document.querySelector("#sessionGame");
const sessionMinutesInput = document.querySelector("#sessionMinutes");
const sessionNoteInput = document.querySelector("#sessionNote");
const meaningfulProgressInput = document.querySelector("#meaningfulProgress");
const sessionMessage = document.querySelector("#sessionMessage");

const totalGamesEl = document.querySelector("#totalGames");
const inProgressCountEl = document.querySelector("#inProgressCount");
const completedCountEl = document.querySelector("#completedCount");
const mainGameNameEl = document.querySelector("#mainGameName");
const totalSessionsEl = document.querySelector("#totalSessions");
const currentStreakEl = document.querySelector("#currentStreak");

const playerRankEl = document.querySelector("#playerRank");
const playerLevelEl = document.querySelector("#playerLevel");
const totalXpEl = document.querySelector("#totalXp");
const todayXpEl = document.querySelector("#todayXp");
const xpToNextLevelEl = document.querySelector("#xpToNextLevel");
const xpProgressTextEl = document.querySelector("#xpProgressText");
const xpProgressFillEl = document.querySelector("#xpProgressFill");

const completionSpotlightEl = document.querySelector("#completionSpotlight");
const mainQuestPanelEl = document.querySelector("#mainQuestPanel");
const listSummaryEl = document.querySelector("#listSummary");
const gamesListEl = document.querySelector("#gamesList");
const recentSessionsSummaryEl = document.querySelector(
  "#recentSessionsSummary"
);
const recentSessionsListEl = document.querySelector("#recentSessionsList");
const journeyContentEl = document.querySelector("#journeyContent");
const journeyMessageEl = document.querySelector("#journeyMessage");
const homeJourneyContentEl = document.querySelector("#homeJourneyContent");

const coverArtPickerInput = document.querySelector("#coverArtPicker");
const bannerArtPickerInput = document.querySelector("#bannerArtPicker");

const exportDataButton = document.querySelector("#exportDataButton");
const importDataButton = document.querySelector("#importDataButton");
const clearDataButton = document.querySelector("#clearDataButton");
const importDataInput = document.querySelector("#importDataInput");
const settingsMessage = document.querySelector("#settingsMessage");

const artCropModal = document.querySelector("#artCropModal");
const cropPreviewCanvas = document.querySelector("#cropPreviewCanvas");
const cropModalTitle = document.querySelector("#cropModalTitle");
const cropGuidance = document.querySelector("#cropGuidance");
const cropPresetPill = document.querySelector("#cropPresetPill");
const cropZoomValue = document.querySelector("#cropZoomValue");
const cropZoomRange = document.querySelector("#cropZoomRange");
const cropFocusXRange = document.querySelector("#cropFocusXRange");
const cropFocusYRange = document.querySelector("#cropFocusYRange");
const cropResetButton = document.querySelector("#cropResetButton");
const cropCancelButton = document.querySelector("#cropCancelButton");
const cropConfirmButton = document.querySelector("#cropConfirmButton");
const appScreens = Array.from(document.querySelectorAll("[data-screen]"));
const screenNavButtons = Array.from(
  document.querySelectorAll("[data-screen-target]")
);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    db = await openDB();
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
  coverArtPickerInput.addEventListener("change", () =>
    handleArtPickerChange("cover")
  );
  bannerArtPickerInput.addEventListener("change", () =>
    handleArtPickerChange("banner")
  );

  exportDataButton?.addEventListener("click", handleExportData);
  importDataButton?.addEventListener("click", () => importDataInput?.click());
  clearDataButton?.addEventListener("click", handleClearData);
  importDataInput?.addEventListener("change", handleImportData);

  cropZoomRange?.addEventListener("input", handleCropControlInput);
  cropFocusXRange?.addEventListener("input", handleCropControlInput);
  cropFocusYRange?.addEventListener("input", handleCropControlInput);
  cropResetButton?.addEventListener("click", resetCropControls);
  cropCancelButton?.addEventListener("click", cancelCropSelection);
  cropConfirmButton?.addEventListener("click", confirmCropSelection);
  artCropModal?.addEventListener("click", handleCropModalClick);
  document.addEventListener("keydown", handleGlobalKeyDown);

  for (const button of screenNavButtons) {
    button.addEventListener("click", handleScreenNavClick);
  }

  window.addEventListener("resize", handleViewportResize);
}

function handleScreenNavClick(event) {
  const targetScreenId = event.currentTarget?.dataset.screenTarget;
  if (!targetScreenId) return;

  if (targetScreenId === "add" && addGamePanel) {
    addGamePanel.open = true;
  }

  setActiveScreen(targetScreenId, {
    store: true,
    scrollToTop: isMobileViewport(),
  });
}

function handleViewportResize() {
  setActiveScreen(activeScreenId || getPreferredScreenId());
}

function getPreferredScreenId() {
  try {
    const storedScreenId = window.localStorage.getItem(SCREEN_STORAGE_KEY);
    return isValidScreenId(storedScreenId) ? storedScreenId : DEFAULT_SCREEN_ID;
  } catch (error) {
    return DEFAULT_SCREEN_ID;
  }
}

function isValidScreenId(screenId) {
  return appScreens.some((screen) => screen.dataset.screen === screenId);
}

function isMobileViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
}

function setActiveScreen(screenId, options = {}) {
  const { store = false, scrollToTop = false } = options;
  const nextScreenId = isValidScreenId(screenId) ? screenId : DEFAULT_SCREEN_ID;

  activeScreenId = nextScreenId;

  for (const screen of appScreens) {
    screen.classList.toggle("is-active", screen.dataset.screen === nextScreenId);
  }

  for (const button of screenNavButtons) {
    const isActive = button.dataset.screenTarget === nextScreenId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  }

  if (store) {
    try {
      window.localStorage.setItem(SCREEN_STORAGE_KEY, nextScreenId);
    } catch (error) {
      // Ignore localStorage write failures.
    }
  }

  if (scrollToTop && isMobileViewport()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function repairGamesIfNeeded() {
  const games = await getAllGames(db);
  if (!games.length) return;

  const normalizedGames = games.map((game) => normalizeGameRecord(game));
  const repairedGames = enforceMainGameRules(normalizedGames);
  const changedGames = repairedGames.filter((game, index) =>
    hasGameChanged(games[index], game)
  );

  if (changedGames.length) {
    await updateGames(db, changedGames);
  }
}

async function handleAddGame(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const platform = platformInput.value.trim();
  const notes = notesInput.value.trim();
  const status = isValidStatus(gameStatusInput.value)
    ? gameStatusInput.value
    : DEFAULT_GAME_STATUS;

  if (!title) {
    showMessage(formMessage, "Please enter a game title.", true);
    return;
  }

  try {
    const [coverImage, bannerImage, existingGames] = await Promise.all([
      optimizeUploadedImage(coverImageInput.files?.[0], "cover"),
      optimizeUploadedImage(bannerImageInput.files?.[0], "banner"),
      getAllGames(db),
    ]);

    const normalizedGames = enforceMainGameRules(
      existingGames.map((game) => normalizeGameRecord(game))
    );
    const hasMainGame = normalizedGames.some((game) => game.isMain);
    const now = new Date().toISOString();

    const newGame = normalizeGameRecord({
      id: crypto.randomUUID(),
      title,
      platform: platform || "Unspecified",
      notes,
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

    await addGame(db, newGame);
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

    await renderApp();
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

async function handleAddSession(event) {
  event.preventDefault();

  const gameId = sessionGameSelect.value;
  const minutes = Number(sessionMinutesInput.value);
  const note = sessionNoteInput.value.trim();
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
    const games = (await getAllGames(db)).map((game) =>
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

    await addSession(db, newSession);
    await updateGame(db, {
      ...selectedGame,
      updatedAt: now,
    });

    sessionForm.reset();
    meaningfulProgressInput.checked = true;

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
      }" • ${xpBreakdown.totalText}${focusText}.`
    );

    await renderApp();
    sessionGameSelect.value = gameId;
  } catch (error) {
    console.error("Failed to save session:", error);
    showMessage(sessionMessage, "Could not save session.", true);
  }
}

async function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id, status, target, direction } = button.dataset;

  try {
    if (action === "scroll-deck") {
      scrollDeck(target, direction);
      return;
    }

    const games = (await getAllGames(db)).map((game) =>
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

      await setMainGame(db, id);
      showMessage(formMessage, `"${game.title}" is now your Main Game.`);
      await renderApp();
      return;
    }

    if (action === "pick-cover-art") {
      pendingArtTarget = { gameId: id, kind: "cover" };
      coverArtPickerInput.click();
      return;
    }

    if (action === "pick-banner-art") {
      pendingArtTarget = { gameId: id, kind: "banner" };
      bannerArtPickerInput.click();
      return;
    }

    if (action === "clear-art") {
      const now = new Date().toISOString();
      await updateGame(db, {
        ...game,
        coverImage: "",
        bannerImage: "",
        artUpdatedAt: now,
        updatedAt: now,
      });
      showMessage(formMessage, `Cleared artwork for "${game.title}".`);
      await renderApp();
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
      await updateGame(db, updatedGame);

      if (status === GAME_STATUSES.COMPLETED) {
        const sessions = await getAllSessions(db);
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

      await renderApp();
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

async function handleArtPickerChange(kind) {
  const input = kind === "cover" ? coverArtPickerInput : bannerArtPickerInput;
  const file = input.files?.[0];
  const activeTarget = pendingArtTarget;

  input.value = "";
  pendingArtTarget = null;

  if (!file || !activeTarget || activeTarget.kind !== kind) {
    return;
  }

  try {
    const games = (await getAllGames(db)).map((game) => normalizeGameRecord(game));
    const game = games.find((entry) => entry.id === activeTarget.gameId);

    if (!game) {
      showMessage(formMessage, "That game could not be found.", true);
      return;
    }

    const optimizedImage = await optimizeUploadedImage(file, kind);
    const now = new Date().toISOString();

    await updateGame(db, {
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
    await renderApp();
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

async function handleExportData() {
  try {
    const [games, sessions, idleJourney] = await Promise.all([
      getAllGames(db),
      getAllSessions(db),
      getMeta(db, IDLE_JOURNEY_META_KEY),
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

async function handleImportData(event) {
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

    await replaceAllData(db, { games, sessions, meta });
    gameForm.reset();
    sessionForm.reset();
    meaningfulProgressInput.checked = true;

    showMessage(
      settingsMessage,
      `Imported ${games.length} games, ${sessions.length} sessions, and your idle journey.`
    );
    await renderApp();
  } catch (error) {
    console.error("Failed to import data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not import that backup file."),
      true
    );
  }
}

async function handleClearData() {
  const confirmed = window.confirm(
    "Clear all games, sessions, art, XP progress, and idle journey data from this device?"
  );

  if (!confirmed) return;

  try {
    await clearAllData(db);
    gameForm.reset();
    sessionForm.reset();
    meaningfulProgressInput.checked = true;
    showMessage(settingsMessage, "Cleared all local tracker data.");
    await renderApp();
  } catch (error) {
    console.error("Failed to clear data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not clear your local data."),
      true
    );
  }
}

function prepareImportPayload(parsed) {
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

function scrollDeck(targetId, direction = "right") {
  const element = document.getElementById(targetId);
  if (!element) return;

  const distance = Math.max(element.clientWidth * 0.9, 340);
  const delta = direction === "left" ? -distance : distance;

  element.scrollBy({
    left: delta,
    behavior: "smooth",
  });
}

async function renderApp() {
  const [gamesRaw, sessionsRaw, idleJourneyRaw] = await Promise.all([
    getAllGames(db),
    getAllSessions(db),
    getMeta(db, IDLE_JOURNEY_META_KEY),
  ]);

  const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
  const games = enforceMainGameRules(
    gamesRaw.map((game) => normalizeGameRecord(game))
  );
  const sortedGames = sortGames(games);
  const sessionStats = buildSessionStats(sessions);
  const xpSummary = buildXpSummary(sortedGames, sessions);
  const idleJourney = await syncJourneyState(
    idleJourneyRaw,
    sortedGames,
    sessions,
    xpSummary
  );

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

function renderPlayerProgress(summary) {
  if (!playerLevelEl) return;

  playerRankEl.textContent = summary.rankTitle;
  playerLevelEl.textContent = String(summary.level);
  totalXpEl.textContent = String(summary.totalXp);
  todayXpEl.textContent = String(summary.todayXp);
  xpToNextLevelEl.textContent = `${summary.xpToNextLevel} XP`;
  xpProgressTextEl.textContent = `${summary.xpIntoLevel} / ${XP_RULES.xpPerLevel} XP to level ${
    summary.level + 1
  }`;
  xpProgressFillEl.style.width = `${summary.progressPercent}%`;
}

function renderStats(games, sessions) {
  totalGamesEl.textContent = String(games.length);
  inProgressCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.IN_PROGRESS).length
  );
  completedCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.COMPLETED).length
  );
  totalSessionsEl.textContent = String(sessions.length);

  const mainGame = games.find((game) => game.isMain);
  mainGameNameEl.textContent = mainGame ? mainGame.title : "None set";

  const streak = computeStreak(sessions);
  currentStreakEl.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
}

function renderCompletionSpotlight(games, sessionStats) {
  const latestCompletedGame = [...games]
    .filter(
      (game) =>
        game.status === GAME_STATUSES.COMPLETED && Boolean(game.completedAt)
    )
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

  if (!latestCompletedGame) {
    completionSpotlightEl.hidden = true;
    completionSpotlightEl.innerHTML = "";
    return;
  }

  const stats = sessionStats.get(latestCompletedGame.id) || emptySessionStats();

  completionSpotlightEl.hidden = false;
  completionSpotlightEl.innerHTML = `
    <div class="completion-spotlight-heading">
      <div>
        <p class="eyebrow">Finish unlocked</p>
        <h2>Completion card ready</h2>
        <p class="completion-meta">
          Finished ${formatDate(latestCompletedGame.completedAt)} • ${
    stats.sessionCount
  } ${stats.sessionCount === 1 ? "session" : "sessions"} • ${formatMinutes(
    stats.totalMinutes
  )} total play time
        </p>
      </div>
      <button
        class="secondary-button action-success"
        data-action="download-card"
        data-id="${latestCompletedGame.id}"
      >
        Download card
      </button>
    </div>

    ${renderCompletionCard(latestCompletedGame, stats)}

    <p class="completion-note">
      Your latest finished game now gets a collectible-style finish card with art,
      stats, and a printable PNG export.
    </p>
  `;
}

function renderMainQuest(games, sessionStats) {
  if (!mainQuestPanelEl) return;

  const mainGame =
    games.find((game) => game.isMain) ||
    games.find((game) => game.status === GAME_STATUSES.IN_PROGRESS);

  if (!mainGame) {
    mainQuestPanelEl.innerHTML = `
      <p class="eyebrow">Main quest</p>
      <h2>No active quest yet</h2>
      <p class="muted-text">
        Move one game into In Progress and make it your Main Game.
      </p>
    `;
    return;
  }

  const stats = sessionStats.get(mainGame.id) || emptySessionStats();
  const objective = escapeHtml(mainGame.notes || "");
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const bannerStyle = buildArtBackgroundStyle(
    mainGame.bannerImage || mainGame.coverImage
  );

  mainQuestPanelEl.innerHTML = `
    <div class="quest-shell">
      <p class="eyebrow">Main quest</p>

      <div class="quest-hero-banner"${bannerStyle}>
        <div class="quest-hero-content">
          <div class="quest-hero-top">
            ${renderCoverVisual(mainGame, "quest-cover-thumb")}
            <div class="quest-hero-text">
              <div class="game-title-row">
                <h2>🎯 ${escapeHtml(mainGame.title)}</h2>
                <span class="badge badge-main">Main Game</span>
              </div>
              <p class="muted-text">
                ${stats.sessionCount} ${stats.sessionCount === 1 ? "session" : "sessions"} •
                ${formatMinutes(stats.totalMinutes)} played •
                ${stats.meaningfulCount} meaningful
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-row">
        <span class="summary-pill">Quest XP: ${stats.totalXp}</span>
        <span class="summary-pill">Last played: ${
          stats.lastPlayedAt ? formatDateTime(stats.lastPlayedAt) : "Never"
        }</span>
        <span class="summary-pill">Platform: ${escapeHtml(
          mainGame.platform || "Unspecified"
        )}</span>
      </div>

      ${
        objective
          ? `<div class="note-block"><p class="note-label">Current objective</p><p class="game-notes">${objective}</p></div>`
          : '<p class="muted-text">No current objective set yet.</p>'
      }

      ${
        latestSessionNote
          ? `<div class="note-block"><p class="note-label">Latest session</p><p class="session-note">${latestSessionNote}</p></div>`
          : '<p class="muted-text">No session note yet.</p>'
      }
    </div>
  `;
}

function renderSessionGameOptions(games) {
  const previousValue = sessionGameSelect.value;
  const availableGames = sortSessionTargets(games.filter(canLogSessionForGame));

  if (availableGames.length === 0) {
    sessionGameSelect.innerHTML =
      '<option value="">Move a game to In Progress first</option>';
    sessionGameSelect.disabled = true;
    return;
  }

  sessionGameSelect.disabled = false;

  sessionGameSelect.innerHTML = availableGames
    .map((game) => {
      const prefix = game.isMain ? "🎯 " : "";
      const suffix =
        game.status === GAME_STATUSES.COMPLETED ? " (completed replay)" : "";
      return `<option value="${game.id}">${prefix}${escapeHtml(
        game.title
      )}${suffix}</option>`;
    })
    .join("");

  const hasPreviousValue = availableGames.some(
    (game) => game.id === previousValue
  );
  const defaultGame = hasPreviousValue
    ? previousValue
    : availableGames.find((game) => game.isMain)?.id || availableGames[0].id;

  sessionGameSelect.value = defaultGame;
}

function renderGames(games, sessionStats) {
  if (games.length === 0) {
    listSummaryEl.textContent = "No games saved yet.";
    gamesListEl.innerHTML = `
      <div class="empty-state">
        Add your first game to start building a finishable list.
      </div>
    `;
    return;
  }

  const counts = {
    inProgress: games.filter(
      (game) => game.status === GAME_STATUSES.IN_PROGRESS
    ).length,
    backlog: games.filter((game) => game.status === GAME_STATUSES.BACKLOG)
      .length,
    completed: games.filter(
      (game) => game.status === GAME_STATUSES.COMPLETED
    ).length,
  };

  listSummaryEl.textContent = `${games.length} tracked • ${counts.inProgress} in progress • ${counts.completed} completed • ${counts.backlog} backlog`;

  const mainGame = games.find((game) => game.isMain) || null;

  const sections = [
    {
      key: "main-quest",
      title: "Main Game",
      description:
        "Your current focus target. Keep chipping away until it joins the completed shelf.",
      games: mainGame ? [mainGame] : [],
      empty: "No main game set yet.",
      sectionClass: "games-section-main",
    },
    {
      key: GAME_STATUSES.IN_PROGRESS,
      title: STATUS_META[GAME_STATUSES.IN_PROGRESS].label,
      description: STATUS_META[GAME_STATUSES.IN_PROGRESS].description,
      games: games.filter(
        (game) => game.status === GAME_STATUSES.IN_PROGRESS && !game.isMain
      ),
      empty: STATUS_META[GAME_STATUSES.IN_PROGRESS].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.COMPLETED,
      title: "Completed deck",
      description:
        "Finished games now live in a scrollable card shelf so they feel like actual unlocks instead of plain tracker rows.",
      games: games.filter((game) => game.status === GAME_STATUSES.COMPLETED),
      empty: STATUS_META[GAME_STATUSES.COMPLETED].empty,
      sectionClass: "completed-deck-section",
    },
    {
      key: GAME_STATUSES.PAUSED,
      title: STATUS_META[GAME_STATUSES.PAUSED].label,
      description: STATUS_META[GAME_STATUSES.PAUSED].description,
      games: games.filter((game) => game.status === GAME_STATUSES.PAUSED),
      empty: STATUS_META[GAME_STATUSES.PAUSED].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.BACKLOG,
      title: STATUS_META[GAME_STATUSES.BACKLOG].label,
      description: STATUS_META[GAME_STATUSES.BACKLOG].description,
      games: games.filter((game) => game.status === GAME_STATUSES.BACKLOG),
      empty: STATUS_META[GAME_STATUSES.BACKLOG].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.DROPPED,
      title: STATUS_META[GAME_STATUSES.DROPPED].label,
      description: STATUS_META[GAME_STATUSES.DROPPED].description,
      games: games.filter((game) => game.status === GAME_STATUSES.DROPPED),
      empty: STATUS_META[GAME_STATUSES.DROPPED].empty,
      sectionClass: "",
    },
  ];

  gamesListEl.innerHTML = sections
    .map((section) =>
      section.key === GAME_STATUSES.COMPLETED
        ? renderCompletedDeckSection(section, sessionStats)
        : renderGameSection(section, sessionStats)
    )
    .join("");
}

function renderGameSection(section, sessionStats) {
  return `
    <section class="games-section ${section.sectionClass || ""}">
      <div class="games-section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          <p class="muted-text">${escapeHtml(section.description)}</p>
        </div>
        <span class="section-count">${section.games.length}</span>
      </div>

      <div class="games-list">
        ${
          section.games.length
            ? section.games
                .map((game) => renderGameCard(game, sessionStats))
                .join("")
            : `<div class="empty-state">${escapeHtml(section.empty)}</div>`
        }
      </div>
    </section>
  `;
}

function renderCompletedDeckSection(section, sessionStats) {
  const deckId = "completedDeckTrack";

  if (!section.games.length) {
    return `
      <section class="games-section ${section.sectionClass || ""}">
        <div class="games-section-header">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p class="muted-text">${escapeHtml(section.description)}</p>
          </div>
          <span class="section-count">0</span>
        </div>
        <div class="empty-state">${escapeHtml(section.empty)}</div>
      </section>
    `;
  }

  return `
    <section class="games-section ${section.sectionClass || ""}">
      <div class="games-section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          <p class="muted-text">${escapeHtml(section.description)}</p>
        </div>
        <span class="section-count">${section.games.length}</span>
      </div>

      <div class="deck-toolbar">
        <div class="summary-row">
          <span class="summary-pill">Swipe or tap through your finished cards</span>
        </div>

        <div class="deck-nav">
          <button
            class="secondary-button"
            data-action="scroll-deck"
            data-target="${deckId}"
            data-direction="left"
          >
            ←
          </button>
          <button
            class="secondary-button"
            data-action="scroll-deck"
            data-target="${deckId}"
            data-direction="right"
          >
            →
          </button>
        </div>
      </div>

      <div id="${deckId}" class="completed-deck-track">
        ${section.games
          .map((game) => renderCompletedDeckItem(game, sessionStats))
          .join("")}
      </div>
    </section>
  `;
}

function renderCompletedDeckItem(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();

  return `
    <article class="completed-deck-item">
      ${renderCompletionCard(game, stats)}
      <div class="game-actions completed-card-actions">
        ${createActionButton("download-card", game.id, {
          label: "Download Card",
          className: "secondary-button action-success",
        })}
        ${createActionButton("set-status", game.id, {
          label: "Play Again",
          nextStatus: GAME_STATUSES.IN_PROGRESS,
          className: "primary-button",
        })}
        ${createActionButton("pick-cover-art", game.id, {
          label: game.coverImage ? "Change Cover" : "Add Cover",
          className: "secondary-button",
        })}
        ${createActionButton("pick-banner-art", game.id, {
          label: game.bannerImage ? "Change Banner" : "Add Banner",
          className: "secondary-button",
        })}
      </div>
    </article>
  `;
}

function renderGameCard(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();
  const safeNotes = escapeHtml(game.notes || "");
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? XP_RULES.completionBonus : 0);

  const mainBadge = game.isMain
    ? '<span class="badge badge-main">Main Game</span>'
    : "";

  const statusMeta =
    STATUS_META[game.status] || STATUS_META[GAME_STATUSES.BACKLOG];

  const cardClasses = ["game-card"];
  if (game.isMain) cardClasses.push("game-card-main");
  if (game.status === GAME_STATUSES.COMPLETED) {
    cardClasses.push("game-card-completed");
  }

  const bannerStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);

  return `
    <article class="${cardClasses.join(" ")}">
      <div class="game-card-banner"${bannerStyle}>
        <div class="game-card-body">
          <div class="game-card-top">
            ${renderCoverVisual(game, "game-cover-thumb")}
            <div class="game-card-info">
              <div class="game-title-row">
                <h4 class="game-title">${escapeHtml(game.title)}</h4>
                ${mainBadge}
                <span class="badge badge-status ${statusMeta.badgeClass}">${escapeHtml(
    statusMeta.label
  )}</span>
              </div>
              <p class="game-meta">Platform: ${escapeHtml(
                game.platform || "Unspecified"
              )}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="game-card-body">
        ${renderGameStateHighlight(game)}

        <div class="summary-row">
          <span class="summary-pill">XP: ${totalQuestXp}</span>
          <span class="summary-pill">Sessions: ${stats.sessionCount}</span>
          <span class="summary-pill">Play time: ${formatMinutes(
            stats.totalMinutes
          )}</span>
          <span class="summary-pill">Meaningful sessions: ${
            stats.meaningfulCount
          }</span>
          <span class="summary-pill">Last played: ${
            stats.lastPlayedAt ? formatDateTime(stats.lastPlayedAt) : "Never"
          }</span>
        </div>

        ${
          safeNotes
            ? `
            <div class="note-block">
              <p class="note-label">Current objective</p>
              <p class="game-notes">${safeNotes}</p>
            </div>
          `
            : ""
        }

        ${
          latestSessionNote
            ? `
            <div class="note-block">
              <p class="note-label">Latest session</p>
              <p class="session-note">${latestSessionNote}</p>
            </div>
          `
            : '<p class="game-meta">No session note yet.</p>'
        }
      </div>

      <div class="game-actions">
        ${renderGameActions(game)}
      </div>
    </article>
  `;
}

function renderGameStateHighlight(game) {
  if (game.status === GAME_STATUSES.COMPLETED && game.completedAt) {
    return `
      <div class="state-highlight state-highlight-completed">
        🏆 Finished on ${formatDate(game.completedAt)} • +${XP_RULES.completionBonus} XP
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.PAUSED && game.pausedAt) {
    return `
      <div class="state-highlight state-highlight-paused">
        Paused on ${formatDate(game.pausedAt)}
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.DROPPED && game.droppedAt) {
    return `
      <div class="state-highlight state-highlight-dropped">
        Dropped on ${formatDate(game.droppedAt)}
      </div>
    `;
  }

  return "";
}

function renderGameActions(game) {
  const actions = [];

  if (game.status === GAME_STATUSES.BACKLOG) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Mark In Progress",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.IN_PROGRESS) {
    if (game.isMain) {
      actions.push(
        '<button class="secondary-button" disabled>Current Main Game</button>'
      );
    } else {
      actions.push(
        createActionButton("make-main", game.id, {
          label: "Make Main",
          className: "secondary-button",
        })
      );
    }

    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Pause",
        nextStatus: GAME_STATUSES.PAUSED,
        className: "secondary-button action-warning",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Complete",
        nextStatus: GAME_STATUSES.COMPLETED,
        className: "secondary-button action-success",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.PAUSED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Resume",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Complete",
        nextStatus: GAME_STATUSES.COMPLETED,
        className: "secondary-button action-success",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.COMPLETED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Play Again",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("download-card", game.id, {
        label: "Download Card",
        className: "secondary-button action-success",
      })
    );
  }

  if (game.status === GAME_STATUSES.DROPPED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Restart",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
  }

  actions.push(
    createActionButton("pick-cover-art", game.id, {
      label: game.coverImage ? "Change Cover" : "Add Cover",
      className: "secondary-button",
    })
  );

  actions.push(
    createActionButton("pick-banner-art", game.id, {
      label: game.bannerImage ? "Change Banner" : "Add Banner",
      className: "secondary-button",
    })
  );

  if (game.coverImage || game.bannerImage) {
    actions.push(
      createActionButton("clear-art", game.id, {
        label: "Clear Art",
        className: "secondary-button action-danger",
      })
    );
  }

  return actions.join("");
}

function createActionButton(action, id, options) {
  const statusAttr = options.nextStatus
    ? ` data-status="${options.nextStatus}"`
    : "";

  return `
    <button
      class="${options.className}"
      data-action="${action}"
      data-id="${id}"${statusAttr}
    >
      ${escapeHtml(options.label)}
    </button>
  `;
}

function renderRecentSessions(games, sessions) {
  if (sessions.length === 0) {
    recentSessionsSummaryEl.textContent = "No sessions logged yet.";
    recentSessionsListEl.innerHTML = `
      <div class="empty-state">
        Log your first session to start building momentum.
      </div>
    `;
    return;
  }

  const gameMap = new Map(games.map((game) => [game.id, game]));
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.playedAt) - new Date(a.playedAt)
  );
  const visibleSessions = sortedSessions.slice(0, 8);

  recentSessionsSummaryEl.textContent =
    sortedSessions.length === 1
      ? "Showing your 1 logged session."
      : `Showing your latest ${visibleSessions.length} of ${sortedSessions.length} sessions.`;

  recentSessionsListEl.innerHTML = visibleSessions
    .map((session) => {
      const relatedGame = gameMap.get(session.gameId);
      const gameTitle = escapeHtml(relatedGame?.title || "Unknown game");
      const safeNote = escapeHtml(session.note || "");
      const progressBadge = session.meaningfulProgress
        ? '<span class="badge badge-progress">Meaningful progress</span>'
        : '<span class="badge badge-neutral">Light session</span>';
      const xpBreakdown = getSessionXpBreakdown(session);
      const xpBadgeClass =
        xpBreakdown.total >= 0
          ? "badge session-xp"
          : "badge session-xp session-xp-negative";
      const focusTaxNote = session.focusPenaltyXp
        ? `<p class="focus-tax-note">${escapeHtml(
            session.focusPenaltyReason || "Focus tax"
          )} • ${xpBreakdown.focusPenalty}</p>`
        : "";

      return `
        <article class="session-card">
          <div class="session-card-header">
            <div>
              <h3 class="session-title">${gameTitle}</h3>
              <p class="session-meta">${formatDateTime(
                session.playedAt
              )} • ${formatMinutes(session.minutes)}</p>
            </div>
            <div class="session-badges">
              ${progressBadge}
              <span class="${xpBadgeClass}">${xpBreakdown.totalText}</span>
            </div>
          </div>

          ${
            safeNote
              ? `<div class="note-block"><p class="note-label">Session note</p><p class="session-note">${safeNote}</p></div>`
              : '<p class="session-meta">No note for this session.</p>'
          }
          ${focusTaxNote}
        </article>
      `;
    })
    .join("");
}

function renderCompletionCard(game, stats) {
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? XP_RULES.completionBonus : 0);
  const bannerStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);

  return `
    <article class="completion-card ${tierMeta.className}">
      <div class="completion-card-banner"${bannerStyle}></div>
      <div class="completion-card-content">
        <div class="completion-card-top">
          ${renderCoverVisual(game, "completion-card-cover")}
          <div class="completion-card-heading">
            <div class="game-title-row">
              <h3>${escapeHtml(game.title)}</h3>
              <span class="badge badge-tier ${tierMeta.className}">${escapeHtml(
    tierMeta.label
  )}</span>
            </div>
            <p class="completion-meta">
              ${escapeHtml(game.platform || "Unspecified")} • Finished ${formatDate(
    game.completedAt || game.updatedAt
  )}
            </p>
            <p class="completion-card-flavor">${escapeHtml(tierMeta.subtitle)}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-stat">
            <span class="summary-stat-label">Total play time</span>
            <span class="summary-stat-value">${formatMinutes(
              stats.totalMinutes
            )}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Sessions</span>
            <span class="summary-stat-value">${stats.sessionCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Meaningful sessions</span>
            <span class="summary-stat-value">${stats.meaningfulCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Quest XP</span>
            <span class="summary-stat-value">${totalQuestXp}</span>
          </div>
        </div>

        ${
          game.notes
            ? `<div class="note-block"><p class="note-label">Final note</p><p class="game-notes">${escapeHtml(
                game.notes
              )}</p></div>`
            : ""
        }
      </div>
    </article>
  `;
}

function buildSessionStats(sessions) {
  const stats = new Map();

  for (const session of sessions) {
    const current = stats.get(session.gameId) || emptySessionStats();

    current.sessionCount += 1;
    current.totalMinutes += session.minutes;
    current.totalXp += calculateSessionXp(session);

    if (
      !current.lastPlayedAt ||
      new Date(session.playedAt) > new Date(current.lastPlayedAt)
    ) {
      current.lastPlayedAt = session.playedAt;
    }

    if (
      !current.latestSession ||
      new Date(session.playedAt) > new Date(current.latestSession.playedAt)
    ) {
      current.latestSession = session;
    }

    if (session.meaningfulProgress) {
      current.meaningfulCount += 1;
    }

    stats.set(session.gameId, current);
  }

  return stats;
}

function buildXpSummary(games, sessions) {
  const currentStreak = computeStreak(sessions);
  const todayKey = toDayKey(new Date());

  const sessionXp = sessions.reduce(
    (total, session) => total + calculateSessionXp(session),
    0
  );

  const todayXp = sessions.reduce((total, session) => {
    if (toDayKey(new Date(session.playedAt)) !== todayKey) return total;
    return total + calculateSessionXp(session);
  }, 0);

  const completionXp =
    games.filter((game) => game.status === GAME_STATUSES.COMPLETED).length *
    XP_RULES.completionBonus;

  const streakBonus = Math.max(0, currentStreak - 1) * 5;
  const totalXp = Math.max(0, sessionXp + completionXp + streakBonus);

  const level = Math.floor(totalXp / XP_RULES.xpPerLevel) + 1;
  const xpIntoLevel = totalXp % XP_RULES.xpPerLevel;
  const xpToNextLevel =
    xpIntoLevel === 0 ? XP_RULES.xpPerLevel : XP_RULES.xpPerLevel - xpIntoLevel;

  return {
    totalXp,
    todayXp,
    currentStreak,
    level,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent: (xpIntoLevel / XP_RULES.xpPerLevel) * 100,
    rankTitle: getRankTitle(level),
  };
}

function calculateSessionXp(session) {
  const minuteXp = Math.min(
    XP_RULES.maxChunkXp,
    Math.floor(session.minutes / XP_RULES.minutesPerChunk) * XP_RULES.xpPerChunk
  );

  return (
    XP_RULES.baseSessionXp +
    minuteXp +
    (session.meaningfulProgress ? XP_RULES.meaningfulBonus : 0) +
    Math.round(Number(session.focusPenaltyXp) || 0)
  );
}

function getRankTitle(level) {
  if (level >= 12) return "Legendary Finisher";
  if (level >= 8) return "Boss Hunter";
  if (level >= 5) return "Focused Finisher";
  if (level >= 3) return "Momentum Builder";
  return "Side Quest Starter";
}

function buildGameForStatus(game, nextStatus) {
  const now = new Date().toISOString();
  const updatedGame = {
    ...game,
    status: nextStatus,
    isMain: false,
    completedAt: null,
    pausedAt: null,
    droppedAt: null,
    updatedAt: now,
  };

  if (nextStatus === GAME_STATUSES.COMPLETED) {
    updatedGame.completedAt = now;
  }

  if (nextStatus === GAME_STATUSES.PAUSED) {
    updatedGame.pausedAt = now;
  }

  if (nextStatus === GAME_STATUSES.DROPPED) {
    updatedGame.droppedAt = now;
  }

  return normalizeGameRecord(updatedGame);
}

function buildCompletionMessage(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();
  return `🏆 Finished "${game.title}" — ${formatMinutes(
    stats.totalMinutes
  )} across ${stats.sessionCount} ${
    stats.sessionCount === 1 ? "session" : "sessions"
  } • +${XP_RULES.completionBonus} XP.`;
}

function enforceMainGameRules(games) {
  const normalizedGames = games.map((game) => normalizeGameRecord(game));
  const mainCandidates = normalizedGames
    .filter((game) => game.isMain && isMainEligibleStatus(game.status))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const activeMainId = mainCandidates[0]?.id || null;

  return normalizedGames.map((game) => ({
    ...game,
    isMain: Boolean(activeMainId) && game.id === activeMainId,
  }));
}

function canLogSessionForGame(game) {
  return SESSION_ALLOWED_STATUSES.has(game.status);
}

function sortGames(games) {
  return [...games].sort((a, b) => {
    if (a.isMain !== b.isMain) return Number(b.isMain) - Number(a.isMain);
    if (a.status !== b.status) {
      return getStatusSortOrder(a.status) - getStatusSortOrder(b.status);
    }
    return a.title.localeCompare(b.title);
  });
}

function sortSessionTargets(games) {
  return [...games].sort((a, b) => {
    if (a.isMain !== b.isMain) return Number(b.isMain) - Number(a.isMain);
    if (a.status !== b.status) {
      return getStatusSortOrder(a.status) - getStatusSortOrder(b.status);
    }
    return a.title.localeCompare(b.title);
  });
}

function getStatusSortOrder(status) {
  switch (status) {
    case GAME_STATUSES.IN_PROGRESS:
      return 0;
    case GAME_STATUSES.COMPLETED:
      return 1;
    case GAME_STATUSES.PAUSED:
      return 2;
    case GAME_STATUSES.BACKLOG:
      return 3;
    case GAME_STATUSES.DROPPED:
      return 4;
    default:
      return 99;
  }
}

function getStatusLabel(status) {
  return STATUS_META[status]?.label || "Backlog";
}

function isValidStatus(status) {
  return Object.values(GAME_STATUSES).includes(status);
}

function computeStreak(sessions) {
  if (sessions.length === 0) return 0;

  const playedDays = new Set(
    sessions.map((session) => toDayKey(new Date(session.playedAt)))
  );

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor;

  if (playedDays.has(toDayKey(today))) {
    cursor = new Date(today);
  } else if (playedDays.has(toDayKey(yesterday))) {
    cursor = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;

  while (playedDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCompletionTier(game, stats) {
  const score =
    stats.totalMinutes +
    stats.sessionCount * 16 +
    stats.meaningfulCount * 22 +
    stats.totalXp * 2 +
    (game.isMain ? 25 : 0) +
    (game.bannerImage ? 20 : 0) +
    (game.coverImage ? 15 : 0);

  if (score >= 560) return "legendary";
  if (score >= 380) return "prismatic";
  if (score >= 240) return "gold";
  if (score >= 120) return "silver";
  return "bronze";
}

function renderCoverVisual(game, className) {
  if (game.coverImage) {
    return `<img class="${className}" src="${escapeAttribute(
      game.coverImage
    )}" alt="${escapeAttribute(game.title)} cover art" />`;
  }

  const initials = getInitials(game.title);
  return `<div class="game-art-placeholder ${className}" aria-hidden="true">${escapeHtml(
    initials
  )}</div>`;
}

function buildArtBackgroundStyle(image) {
  if (!image) return "";

  return ` style="background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.78)), url('${escapeAttribute(
    image
  )}')"`;
}

function emptySessionStats() {
  return {
    sessionCount: 0,
    totalMinutes: 0,
    lastPlayedAt: null,
    meaningfulCount: 0,
    totalXp: 0,
    latestSession: null,
  };
}

function formatMinutes(totalMinutes) {
  if (!totalMinutes || totalMinutes < 60) {
    return `${totalMinutes || 0}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#f87171" : "#34d399";
}

function hasGameChanged(originalGame, updatedGame) {
  const keys = [
    "id",
    "title",
    "platform",
    "notes",
    "coverImage",
    "bannerImage",
    "artUpdatedAt",
    "status",
    "isMain",
    "completedAt",
    "pausedAt",
    "droppedAt",
    "createdAt",
    "updatedAt",
  ];

  return keys.some((key) => originalGame?.[key] !== updatedGame?.[key]);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getInitials(title) {
  return String(title || "Game")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function isCropCancelError(error) {
  return error instanceof Error && error.message === "Image crop cancelled.";
}

async function optimizeUploadedImage(file, kind) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  const preset = IMAGE_PRESET[kind];
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  return openImageCropper(image, kind, preset);
}

function openImageCropper(image, kind, preset) {
  if (!artCropModal || !cropPreviewCanvas) {
    throw new Error("The image cropper could not be opened.");
  }

  if (cropSession?.reject) {
    cropSession.reject(new Error("Image crop cancelled."));
  }

  const previewSize = getCropPreviewSize(preset);
  cropPreviewCanvas.width = previewSize.width;
  cropPreviewCanvas.height = previewSize.height;

  cropModalTitle.textContent = `Adjust ${preset.label}`;
  cropGuidance.textContent = `Recommended upload: ${preset.recommendedSize}. This crop saves as ${preset.ratioLabel}.`;
  cropPresetPill.textContent = `${preset.label} • ${preset.ratioLabel}`;

  const nextSession = {
    image,
    kind,
    preset,
    zoom: 1,
    focusX: 50,
    focusY: 50,
  };

  cropSession = nextSession;
  resetCropControls();
  artCropModal.hidden = false;
  document.body.style.overflow = "hidden";
  renderCropPreview();

  return new Promise((resolve, reject) => {
    nextSession.resolve = resolve;
    nextSession.reject = reject;
  });
}

function getCropPreviewSize(preset) {
  const maxWidth = 420;
  const maxHeight = 320;
  const ratio = preset.width / preset.height;
  let width = maxWidth;
  let height = Math.round(width / ratio);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  return { width, height };
}

function handleCropControlInput() {
  if (!cropSession) return;

  cropSession.zoom = Number(cropZoomRange.value) / 100;
  cropSession.focusX = Number(cropFocusXRange.value);
  cropSession.focusY = Number(cropFocusYRange.value);
  cropZoomValue.textContent = `${Math.round(cropSession.zoom * 100)}%`;
  renderCropPreview();
}

function resetCropControls() {
  if (!cropSession) return;

  cropZoomRange.value = "100";
  cropFocusXRange.value = "50";
  cropFocusYRange.value = "50";
  cropSession.zoom = 1;
  cropSession.focusX = 50;
  cropSession.focusY = 50;
  cropZoomValue.textContent = "100%";
  renderCropPreview();
}

function handleCropModalClick(event) {
  if (event.target instanceof HTMLElement && event.target.dataset.closeCropModal !== undefined) {
    cancelCropSelection();
  }
}

function handleGlobalKeyDown(event) {
  if (event.key === "Escape" && cropSession) {
    cancelCropSelection();
  }
}

function cancelCropSelection() {
  if (!cropSession) return;

  const current = cropSession;
  closeCropModal();
  current.reject?.(new Error("Image crop cancelled."));
}

function confirmCropSelection() {
  if (!cropSession) return;

  const current = cropSession;
  const canvas = document.createElement("canvas");
  canvas.width = current.preset.width;
  canvas.height = current.preset.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    closeCropModal();
    current.reject?.(new Error("Could not create the cropped image."));
    return;
  }

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCropFrame(
    ctx,
    current.image,
    canvas.width,
    canvas.height,
    current.zoom,
    current.focusX,
    current.focusY
  );

  const dataUrl = canvas.toDataURL("image/jpeg", current.preset.quality);
  closeCropModal();
  current.resolve?.(dataUrl);
}

function closeCropModal() {
  cropSession = null;
  if (artCropModal) artCropModal.hidden = true;
  document.body.style.overflow = "";
}

function renderCropPreview() {
  if (!cropSession || !cropPreviewCanvas) return;

  const ctx = cropPreviewCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);

  drawCropFrame(
    ctx,
    cropSession.image,
    cropPreviewCanvas.width,
    cropPreviewCanvas.height,
    cropSession.zoom,
    cropSession.focusX,
    cropSession.focusY
  );
}

function drawCropFrame(ctx, image, width, height, zoom = 1, focusX = 50, focusY = 50) {
  const baseScale = Math.max(width / image.width, height / image.height);
  const appliedScale = baseScale * zoom;
  const drawWidth = image.width * appliedScale;
  const drawHeight = image.height * appliedScale;
  const maxOffsetX = Math.max(0, drawWidth - width);
  const maxOffsetY = Math.max(0, drawHeight - height);
  const offsetX = -maxOffsetX * (focusX / 100);
  const offsetY = -maxOffsetY * (focusY / 100);

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process the selected image."));
    image.src = src;
  });
}

function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

function createBackupFilename(isoDate) {
  const safeDate = String(isoDate || new Date().toISOString())
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  return createSafeFilename(`game progress backup ${safeDate}.json`);
}

async function downloadCompletionCard(game) {
  const sessions = await getAllSessions(db);
  const stats = buildSessionStats(sessions).get(game.id) || emptySessionStats();
  const canvas = await buildCompletionCardCanvas(game, stats);
  const blob = await canvasToBlob(canvas, "image/png");

  downloadBlob(blob, createSafeFilename(`${game.title} completion card.png`));
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create the completion card image."));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function createSafeFilename(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildCompletionCardCanvas(game, stats) {
  const width = 900;
  const height = 1260;
  const padding = 54;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? XP_RULES.completionBonus : 0);

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "#071121");
  backgroundGradient.addColorStop(0.6, "#111827");
  backgroundGradient.addColorStop(1, tierMeta.accentB);
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  drawCanvasGlow(ctx, width * 0.82, 120, 220, `${tierMeta.accentA}66`);
  drawCanvasGlow(ctx, 110, 240, 160, "#60a5fa44");

  const bannerImage = game.bannerImage || game.coverImage;
  if (bannerImage) {
    const banner = await loadImage(bannerImage);
    ctx.save();
    roundedRectPath(ctx, padding, padding, width - padding * 2, 300, 28);
    ctx.clip();
    drawImageCover(ctx, banner, padding, padding, width - padding * 2, 300);
    ctx.restore();

    const bannerFade = ctx.createLinearGradient(0, padding, 0, padding + 300);
    bannerFade.addColorStop(0, "rgba(15, 23, 42, 0.12)");
    bannerFade.addColorStop(1, "rgba(15, 23, 42, 0.84)");
    ctx.fillStyle = bannerFade;
    roundedRect(ctx, padding, padding, width - padding * 2, 300, 28, bannerFade);
  } else {
    const bannerFill = ctx.createLinearGradient(
      padding,
      padding,
      width - padding,
      padding + 300
    );
    bannerFill.addColorStop(0, "#172554");
    bannerFill.addColorStop(1, "#0f172a");
    roundedRect(ctx, padding, padding, width - padding * 2, 300, 28, bannerFill);
  }

  const coverX = padding + 28;
  const coverY = 240;
  const coverW = 220;
  const coverH = 294;

  if (game.coverImage) {
    const cover = await loadImage(game.coverImage);
    ctx.save();
    roundedRectPath(ctx, coverX, coverY, coverW, coverH, 26);
    ctx.clip();
    drawImageCover(ctx, cover, coverX, coverY, coverW, coverH);
    ctx.restore();
  } else {
    const placeholderGradient = ctx.createLinearGradient(
      coverX,
      coverY,
      coverX + coverW,
      coverY + coverH
    );
    placeholderGradient.addColorStop(0, "#1d4ed8");
    placeholderGradient.addColorStop(1, "#0f172a");
    roundedRect(ctx, coverX, coverY, coverW, coverH, 26, placeholderGradient);
    ctx.fillStyle = "#dbeafe";
    ctx.font = "900 86px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(getInitials(game.title), coverX + coverW / 2, coverY + 176);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  roundedRectPath(ctx, coverX, coverY, coverW, coverH, 26);
  ctx.stroke();

  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  roundedRect(
    ctx,
    width - padding - 250,
    padding + 30,
    220,
    52,
    999,
    "rgba(15, 23, 42, 0.72)"
  );
  ctx.strokeStyle = `${tierMeta.accentA}88`;
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, width - padding - 250, padding + 30, 220, 52, 999);
  ctx.stroke();
  ctx.fillStyle = tierMeta.accentText;
  ctx.font = "700 26px Inter, Arial, sans-serif";
  ctx.fillText(tierMeta.label, width - padding - 220, padding + 64);

  const textStartX = coverX + coverW + 34;
  const titleY = 412;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 52px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    game.title,
    textStartX,
    titleY,
    width - padding - textStartX,
    60,
    3
  );

  ctx.fillStyle = "#b7f7de";
  ctx.font = "600 24px Inter, Arial, sans-serif";
  const platformFinishText = `${game.platform || "Unspecified"} • Finished ${formatDate(
    game.completedAt || game.updatedAt
  )}`;
  ctx.fillText(platformFinishText, textStartX, 556);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 22px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    tierMeta.subtitle,
    textStartX,
    596,
    width - padding - textStartX,
    30,
    2
  );

  const statsTop = 620;
  const statBoxW = (width - padding * 2 - 24) / 2;
  const statBoxH = 104;
  const statRows = [
    ["Total play time", formatMinutes(stats.totalMinutes)],
    ["Sessions", String(stats.sessionCount)],
    ["Meaningful sessions", String(stats.meaningfulCount)],
    ["Quest XP", String(totalQuestXp)],
  ];

  statRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const boxX = padding + col * (statBoxW + 24);
    const boxY = statsTop + row * (statBoxH + 20);

    roundedRect(ctx, boxX, boxY, statBoxW, statBoxH, 22, "rgba(15, 23, 42, 0.7)");
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundedRectPath(ctx, boxX, boxY, statBoxW, statBoxH, 22);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 18px Inter, Arial, sans-serif";
    ctx.fillText(label, boxX + 20, boxY + 34);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 34px Inter, Arial, sans-serif";
    ctx.fillText(value, boxX + 20, boxY + 74);
  });

  const noteText =
    game.notes?.trim() ||
    stats.latestSession?.note?.trim() ||
    "That finish counts. Keep the completed shelf growing one game at a time.";

  const noteBoxY = 890;
  roundedRect(
    ctx,
    padding,
    noteBoxY,
    width - padding * 2,
    210,
    28,
    "rgba(15, 23, 42, 0.68)"
  );
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundedRectPath(ctx, padding, noteBoxY, width - padding * 2, 210, 28);
  ctx.stroke();

  ctx.fillStyle = tierMeta.accentText;
  ctx.font = "700 20px Inter, Arial, sans-serif";
  ctx.fillText("Completion note", padding + 24, noteBoxY + 42);

  ctx.fillStyle = "#dbeafe";
  ctx.font = "500 24px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    noteText,
    padding + 24,
    noteBoxY + 82,
    width - padding * 2 - 48,
    34,
    4
  );

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText("Game Progress Tracker • Finish Card", padding, height - 54);
  ctx.textAlign = "right";
  ctx.fillText(formatDate(new Date().toISOString()), width - padding, height - 54);
  ctx.textAlign = "left";

  return canvas;
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawCanvasGlow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function roundedRect(ctx, x, y, width, height, radius, fillStyle) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;

  const lines = [];
  let line = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const testLine = `${line} ${words[index]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      line = testLine;
    } else {
      lines.push(line);
      line = words[index];
    }
  }

  lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[visibleLines.length - 1];
    while (ctx.measureText(`${lastLine}…`).width > maxWidth && lastLine.length) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[visibleLines.length - 1] = `${lastLine}…`;
  }

  visibleLines.forEach((currentLine, index) => {
    ctx.fillText(currentLine, x, y + index * lineHeight);
  });

  return y + (visibleLines.length - 1) * lineHeight;
}

function getSessionXpBreakdown(session) {
  const total = calculateSessionXp(session);
  const focusPenalty = Math.round(Number(session.focusPenaltyXp) || 0);

  return {
    total,
    totalText: `${total >= 0 ? "+" : ""}${total} XP`,
    focusPenalty: focusPenalty ? `${focusPenalty} XP` : "",
  };
}

function rollFocusPenalty({ selectedGame, allGames, meaningfulProgress, minutes }) {
  const mainGame = allGames.find((game) => game.isMain);

  if (!mainGame || mainGame.id === selectedGame.id) {
    return { penaltyXp: 0, reason: "" };
  }

  const sideQuestCount = allGames.filter(
    (game) =>
      game.status === GAME_STATUSES.IN_PROGRESS &&
      !game.isMain &&
      game.id !== selectedGame.id
  ).length;

  const isReplay = selectedGame.status === GAME_STATUSES.COMPLETED;
  const meta = isReplay ? FOCUS_TAX_META.replay : FOCUS_TAX_META.sideQuest;
  const chanceBase = isReplay ? 0.72 : 0.42;
  const chance = clamp(
    chanceBase + sideQuestCount * 0.08 + (meaningfulProgress ? 0 : 0.12),
    0,
    0.92
  );

  if (Math.random() > chance) {
    return { penaltyXp: 0, reason: "" };
  }

  const minutesPressure = Math.floor(minutes / 45);
  const penalty = randomInt(
    meta.min + minutesPressure,
    meta.max + minutesPressure + (meaningfulProgress ? 0 : 4)
  );

  return {
    penaltyXp: -penalty,
    reason: `${meta.label} away from ${mainGame.title}`,
  };
}

function handleHomeJourneyClick(event) {
  const button = event.target.closest("button[data-home-action]");
  if (!button) return;

  if (button.dataset.homeAction === "open-journey") {
    setActiveScreen("journey", {
      store: true,
      scrollToTop: isMobileViewport(),
    });
    applyScreenHash("journey");

    if (!isMobileViewport()) {
      scrollScreenIntoView("journey");
    }
  }
}

function renderHomeJourney(state, xpSummary) {
  if (!homeJourneyContentEl) return;

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const nextBossEtaHours =
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour);

  homeJourneyContentEl.innerHTML = `
    <div class="journey-home-shell">
      <div class="journey-home-top">
        <div class="journey-home-copy">
          <p class="eyebrow">Journey at a glance</p>
          <h2>Parallel expedition</h2>
          <p class="muted-text">
            ${escapeHtml(getJourneyActivityText(state, boss, progress, journeyStats))}
          </p>

          <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${progress.percent}%"></div>
          </div>

          <div class="journey-progress-meta">
            <span>${progress.currentLabel}</span>
            <span>${progress.remainingLabel}</span>
          </div>

          <div class="summary-row">
            <span class="summary-pill">Boss gate: ${escapeHtml(boss.name)}</span>
            <span class="summary-pill">Bosses beaten: ${state.bossIndex}</span>
            <span class="summary-pill">Class: ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</span>
            <span class="summary-pill">ETA: ${escapeHtml(
              state.status === "recovering"
                ? getRecoveryText(state)
                : formatDurationHours(nextBossEtaHours)
            )}</span>
          </div>
        </div>

        <div class="journey-home-meters">
          <div>
            <p class="journey-overline">Expedition condition</p>
            <h3>Lv. ${journeyLevel} ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</h3>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>Health</span>
              <span>${Math.round(state.currentHp)} / ${journeyStats.maxHp}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-health" style="width: ${hpPercent}%"></div>
            </div>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>Hunger</span>
              <span>${Math.round(state.currentHunger)} / ${journeyStats.maxHunger}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-hunger" style="width: ${hungerPercent}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="journey-home-actions">
        <button type="button" class="secondary-button" data-home-action="open-journey">
          Open full journey
        </button>
      </div>
    </div>
  `;
}

async function handleJourneyClick(event) {
  const button = event.target.closest("button[data-journey-action]");
  if (!button) return;

  try {
    const [gamesRaw, sessionsRaw, idleRaw] = await Promise.all([
      getAllGames(db),
      getAllSessions(db),
      getMeta(db, IDLE_JOURNEY_META_KEY),
    ]);

    const games = enforceMainGameRules(
      gamesRaw.map((game) => normalizeGameRecord(game))
    );
    const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
    const xpSummary = buildXpSummary(games, sessions);
    const state = await syncJourneyState(idleRaw, games, sessions, xpSummary);
    const journeyLevel = getJourneyLevel(state, xpSummary.level);
    const supplies = buildJourneySupplies(games, sessions, state);
    const action = button.dataset.journeyAction;

    if (action === "set-class") {
      const classType = button.dataset.class;
      if (!JOURNEY_CLASS_META[classType]) {
        showMessage(journeyMessageEl, "That class is not available.", true);
        return;
      }

      state.classType = classType;
      addJourneyLog(
        state,
        `Changed discipline to ${JOURNEY_CLASS_META[classType].label}.`,
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        `${JOURNEY_CLASS_META[classType].label} stance equipped.`
      );
      await renderApp();
      return;
    }

    if (action === "spend-stat") {
      const statKey = button.dataset.stat;
      if (!JOURNEY_STAT_KEYS.includes(statKey)) {
        showMessage(journeyMessageEl, "That stat cannot be increased.", true);
        return;
      }

      const unspent = getUnspentSkillPoints(state, journeyLevel);
      if (unspent <= 0) {
        showMessage(journeyMessageEl, "No skill points available right now.", true);
        return;
      }

      state.allocatedStats[statKey] += 1;
      addJourneyLog(
        state,
        `${JOURNEY_STAT_META[statKey].label} increased to ${
          state.allocatedStats[statKey]
        } spent points.`,
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        `${JOURNEY_STAT_META[statKey].label} increased.`
      );
      await renderApp();
      return;
    }

    if (action === "use-ration") {
      if (supplies.availableRations <= 0) {
        showMessage(journeyMessageEl, "No rations banked from your tracker yet.", true);
        return;
      }

      const journeyStats = buildJourneyDerived(state, journeyLevel);
      state.spentRations += 1;
      state.currentHunger = clamp(
        state.currentHunger + 26 + journeyStats.stats.resolve * 2,
        0,
        journeyStats.maxHunger
      );
      addJourneyLog(
        state,
        "Shared a ration with the party. Hunger restored.",
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, "Used 1 ration to refill hunger.");
      await renderApp();
      return;
    }

    if (action === "use-tonic") {
      if (supplies.availableTonics <= 0) {
        showMessage(journeyMessageEl, "No tonics earned yet. Finish more meaningful progress.", true);
        return;
      }

      const journeyStats = buildJourneyDerived(state, journeyLevel);
      state.spentTonics += 1;
      state.currentHp = clamp(
        state.currentHp + 34 + journeyStats.stats.vitality * 3,
        0,
        journeyStats.maxHp
      );
      addJourneyLog(
        state,
        "Used a tonic. Wounds closed enough to keep moving.",
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, "Used 1 tonic to restore health.");
      await renderApp();
    }
  } catch (error) {
    console.error("Failed to update idle journey:", error);
    showMessage(
      journeyMessageEl,
      getErrorMessage(error, "Could not update the idle journey."),
      true
    );
  }
}

async function syncJourneyState(rawState, games, sessions, xpSummary) {
  const now = new Date();
  const state = normalizeJourneyState(rawState);
  let changed = !rawState;

  if (xpSummary.level > state.highestTrackerLevel) {
    for (
      let nextLevel = state.highestTrackerLevel + 1;
      nextLevel <= xpSummary.level;
      nextLevel += 1
    ) {
      addJourneyLog(
        state,
        `Tracker level ${nextLevel} reached. Skill point earned for the expedition.`,
        now.toISOString()
      );
    }
    state.highestTrackerLevel = xpSummary.level;
    changed = true;
  }

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const hpBefore = state.currentHp;
  const hungerBefore = state.currentHunger;
  state.currentHp = clamp(state.currentHp, 0, journeyStats.maxHp);
  state.currentHunger = clamp(state.currentHunger, 0, journeyStats.maxHunger);
  if (state.currentHp !== hpBefore || state.currentHunger !== hungerBefore) {
    changed = true;
  }

  const elapsedMs = clamp(
    now.getTime() - new Date(state.lastUpdatedAt || now.toISOString()).getTime(),
    0,
    1000 * 60 * 60 * 24 * 30
  );

  if (elapsedMs >= 1000) {
    simulateJourneyState(state, elapsedMs, journeyStats);
    changed = true;
  }

  state.lastUpdatedAt = now.toISOString();
  const normalizedState = normalizeJourneyState(state);

  if (changed) {
    await setMeta(db, IDLE_JOURNEY_META_KEY, normalizedState);
  }

  return normalizedState;
}

function renderIdleJourney(state, games, sessions, xpSummary) {
  if (!journeyContentEl) return;

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const supplies = buildJourneySupplies(games, sessions, state);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const unspentSkillPoints = getUnspentSkillPoints(state, journeyLevel);
  const activityText = getJourneyActivityText(state, boss, progress, journeyStats);
  const nextBossEtaHours = progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour);

  journeyContentEl.innerHTML = `
    <section class="journey-hero">
      <div class="journey-hero-top">
        <div class="journey-side-card">
          <p class="journey-overline">Endless road</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(JOURNEY_CLASS_META[state.classType].label)} Lv. ${journeyLevel}</h3>
            <span class="journey-chip is-active">${escapeHtml(getJourneyZoneName(state.bossIndex))}</span>
            <span class="journey-chip">${escapeHtml(getJourneyStatusLabel(state.status))}</span>
          </div>
          <p class="journey-zone">${escapeHtml(activityText)}</p>
          <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${progress.percent}%"></div>
          </div>
          <div class="journey-progress-meta">
            <span>${progress.currentLabel}</span>
            <span>${progress.remainingLabel}</span>
          </div>
          <div class="summary-row">
            <span class="summary-pill">Boss gate: ${escapeHtml(boss.name)}</span>
            <span class="summary-pill">Bosses beaten: ${state.bossIndex}</span>
            <span class="summary-pill">Town trips: ${state.townVisits}</span>
            <span class="summary-pill">Speed: ${journeyStats.speedPerHour.toFixed(1)}/hr</span>
          </div>
        </div>

        <div class="journey-side-card">
          <p class="journey-overline">Tracker link</p>
          <h4>${escapeHtml(xpSummary.rankTitle)}</h4>
          <p class="muted-text">Your tracker level feeds this character. Reaching new tracker levels adds skill points permanently, even if focus-tax RNG knocks current XP around later.</p>
          <div class="summary-row">
            <span class="summary-pill">Tracker level: ${xpSummary.level}</span>
            <span class="summary-pill">Stored journey level: ${journeyLevel}</span>
            <span class="summary-pill">Unspent points: ${unspentSkillPoints}</span>
          </div>
          <p class="muted-text">${state.status === "recovering" ? escapeHtml(getRecoveryText(state)) : `Boss ETA: ${formatDurationHours(nextBossEtaHours)}`}</p>
        </div>
      </div>
    </section>

    <section class="journey-resource-grid">
      <article class="journey-resource-card">
        <h4>Health</h4>
        <div class="resource-track">
          <div class="resource-fill resource-fill-health" style="width: ${(state.currentHp / journeyStats.maxHp) * 100}%"></div>
        </div>
        <div class="resource-meta">
          <span>${Math.round(state.currentHp)} / ${journeyStats.maxHp}</span>
          <span>Vitality ${journeyStats.stats.vitality}</span>
        </div>
        <div class="journey-resource-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-tonic"
            ${supplies.availableTonics <= 0 ? "disabled" : ""}
          >
            Use tonic (${supplies.availableTonics})
          </button>
        </div>
      </article>

      <article class="journey-resource-card">
        <h4>Hunger</h4>
        <div class="resource-track">
          <div class="resource-fill resource-fill-hunger" style="width: ${(state.currentHunger / journeyStats.maxHunger) * 100}%"></div>
        </div>
        <div class="resource-meta">
          <span>${Math.round(state.currentHunger)} / ${journeyStats.maxHunger}</span>
          <span>Resolve ${journeyStats.stats.resolve}</span>
        </div>
        <div class="journey-resource-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-ration"
            ${supplies.availableRations <= 0 ? "disabled" : ""}
          >
            Eat ration (${supplies.availableRations})
          </button>
        </div>
      </article>
    </section>

    <section class="journey-utility-row">
      <article class="journey-side-card">
        <p class="journey-overline">Class discipline</p>
        <h4>${escapeHtml(JOURNEY_CLASS_META[state.classType].label)}</h4>
        <p class="muted-text">${escapeHtml(JOURNEY_CLASS_META[state.classType].description)}</p>
        <div class="journey-class-buttons">
          ${Object.entries(JOURNEY_CLASS_META)
            .map(
              ([classKey, meta]) => `
                <button
                  type="button"
                  class="secondary-button ${
                    state.classType === classKey ? "action-success" : ""
                  }"
                  data-journey-action="set-class"
                  data-class="${classKey}"
                >
                  ${escapeHtml(meta.label)}
                </button>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="journey-side-card">
        <p class="journey-overline">Tracker-fed supplies</p>
        <h4>Earned from play</h4>
        <div class="summary-row">
          <span class="summary-pill">Rations: ${supplies.availableRations} / ${supplies.earnedRations}</span>
          <span class="summary-pill">Tonics: ${supplies.availableTonics} / ${supplies.earnedTonics}</span>
        </div>
        <p class="muted-text">Sessions build rations. Meaningful progress and completions build tonics. Spending them keeps the expedition rolling.</p>
      </article>
    </section>

    <section class="journey-stat-grid">
      ${JOURNEY_STAT_KEYS.map((statKey) => {
        const statMeta = JOURNEY_STAT_META[statKey];
        const spent = state.allocatedStats[statKey] || 0;
        return `
          <article class="journey-stat-card">
            <div class="stat-row">
              <h4>${escapeHtml(statMeta.label)}</h4>
              <strong>${journeyStats.stats[statKey]}</strong>
              <span class="journey-chip">Spent ${spent}</span>
            </div>
            <p class="stat-help">${escapeHtml(statMeta.help)}</p>
            <div class="journey-skill-actions">
              <button
                type="button"
                class="secondary-button"
                data-journey-action="spend-stat"
                data-stat="${statKey}"
                ${unspentSkillPoints <= 0 ? "disabled" : ""}
              >
                +1 ${escapeHtml(statMeta.label)}
              </button>
            </div>
          </article>
        `;
      }).join("")}
    </section>

    <section class="journey-log-grid">
      <article class="journey-log-card">
        <p class="journey-overline">Travel log</p>
        <h4>Latest expedition events</h4>
        <div class="journey-log-list">
          ${state.log.length
            ? state.log
                .map(
                  (entry) => `
                    <div class="journey-log-entry">
                      <p>${escapeHtml(entry.text)}</p>
                      <time>${formatDateTime(entry.at)}</time>
                    </div>
                  `
                )
                .join("")
            : '<div class="journey-log-entry"><p>The road is quiet for now. Log a session and let time pass to build the story.</p></div>'}
        </div>
      </article>

      <article class="journey-log-card">
        <p class="journey-overline">Build summary</p>
        <h4>Combat profile</h4>
        <div class="summary-row">
          <span class="summary-pill">Power ${journeyStats.power.toFixed(0)}</span>
          <span class="summary-pill">Regen ${journeyStats.regenPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Hunger drain ${journeyStats.hungerDrainPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Skill points left ${unspentSkillPoints}</span>
        </div>
        <p class="muted-text">Bosses hit harder as the road goes on. Power comes from your class, skill allocation, and the highest tracker level you have reached.</p>
      </article>
    </section>
  `;
}

function normalizeJourneyState(rawState = null) {
  const nowIso = new Date().toISOString();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const classType = JOURNEY_CLASS_META[source.classType] ? source.classType : "warrior";
  const allocatedStats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Math.max(0, Math.floor(Number(source.allocatedStats?.[key]) || 0));
    return accumulator;
  }, {});

  return {
    version: 1,
    classType,
    allocatedStats,
    totalDistance: Math.max(0, Number(source.totalDistance) || 0),
    bossIndex: Math.max(0, Math.floor(Number(source.bossIndex) || 0)),
    currentHp: Math.max(0, Number(source.currentHp) || 100),
    currentHunger: Math.max(0, Number(source.currentHunger) || 100),
    status: source.status === "recovering" ? "recovering" : "adventuring",
    lastUpdatedAt: source.lastUpdatedAt || nowIso,
    restUntil: source.restUntil || null,
    townVisits: Math.max(0, Math.floor(Number(source.townVisits) || 0)),
    spentRations: Math.max(0, Math.floor(Number(source.spentRations) || 0)),
    spentTonics: Math.max(0, Math.floor(Number(source.spentTonics) || 0)),
    highestTrackerLevel: Math.max(1, Math.floor(Number(source.highestTrackerLevel) || 1)),
    log: Array.isArray(source.log)
      ? source.log
          .slice(0, JOURNEY_LOG_LIMIT)
          .map((entry) => ({
            text: String(entry?.text || ""),
            at: entry?.at || nowIso,
          }))
          .filter((entry) => entry.text)
      : [],
  };
}

function buildJourneyDerived(state, journeyLevel) {
  const classMeta = JOURNEY_CLASS_META[state.classType] || JOURNEY_CLASS_META.warrior;
  const stats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] =
      5 +
      (classMeta.bonuses[key] || 0) +
      Math.max(0, Math.floor(Number(state.allocatedStats[key]) || 0));
    return accumulator;
  }, {});

  const maxHp = Math.round(86 + journeyLevel * 10 + stats.vitality * 14);
  const maxHunger = Math.round(92 + stats.resolve * 8 + journeyLevel * 3);
  const power =
    stats.might * 2.8 +
    stats.finesse * 1.8 +
    stats.arcana * 3 +
    stats.vitality * 1.1 +
    stats.resolve * 1.2 +
    journeyLevel * 5;
  const speedPerHour = 4.6 + stats.finesse * 0.42 + stats.resolve * 0.12;
  const regenPerHour = 1 + stats.vitality * 0.36 + stats.resolve * 0.08;
  const hungerDrainPerHour = Math.max(1.35, 5.6 - stats.resolve * 0.24);

  return {
    classMeta,
    stats,
    level: journeyLevel,
    maxHp,
    maxHunger,
    power,
    speedPerHour,
    regenPerHour,
    hungerDrainPerHour,
  };
}

function buildJourneySupplies(games, sessions, state) {
  const meaningfulCount = sessions.filter((session) => session.meaningfulProgress).length;
  const completedCount = games.filter(
    (game) => game.status === GAME_STATUSES.COMPLETED
  ).length;
  const earnedRations = sessions.length + meaningfulCount + completedCount * 2;
  const earnedTonics = Math.floor(meaningfulCount / 2) + completedCount * 3;

  return {
    earnedRations,
    earnedTonics,
    availableRations: Math.max(0, earnedRations - state.spentRations),
    availableTonics: Math.max(0, earnedTonics - state.spentTonics),
  };
}

function simulateJourneyState(state, elapsedMs, journeyStats) {
  let remainingMs = elapsedMs;
  let cursor = new Date(state.lastUpdatedAt || new Date().toISOString());

  while (remainingMs > 0) {
    const sliceMs = Math.min(JOURNEY_TICK_MS, remainingMs);
    const nextCursor = new Date(cursor.getTime() + sliceMs);
    const hours = sliceMs / (1000 * 60 * 60);

    if (state.status === "recovering") {
      state.currentHp = clamp(
        state.currentHp + journeyStats.maxHp * 0.18 * hours,
        0,
        journeyStats.maxHp
      );
      state.currentHunger = clamp(
        state.currentHunger + 18 * hours,
        0,
        journeyStats.maxHunger
      );

      if (state.restUntil && nextCursor >= new Date(state.restUntil)) {
        state.status = "adventuring";
        state.restUntil = null;
        state.currentHp = Math.max(state.currentHp, journeyStats.maxHp * 0.62);
        state.currentHunger = Math.max(
          state.currentHunger,
          journeyStats.maxHunger * 0.72
        );
        addJourneyLog(
          state,
          `Left town and returned to the ${getJourneyZoneName(state.bossIndex)}.`,
          nextCursor.toISOString()
        );
      }
    } else {
      const hpRatio = journeyStats.maxHp ? state.currentHp / journeyStats.maxHp : 0;
      const hungerRatio = journeyStats.maxHunger
        ? state.currentHunger / journeyStats.maxHunger
        : 0;
      const conditionMultiplier = clamp(
        Math.min(hpRatio, hungerRatio) + 0.35,
        0.28,
        1.08
      );

      state.totalDistance += journeyStats.speedPerHour * hours * conditionMultiplier;
      state.currentHunger = clamp(
        state.currentHunger - journeyStats.hungerDrainPerHour * hours,
        0,
        journeyStats.maxHunger
      );

      if (state.currentHunger > journeyStats.maxHunger * 0.42) {
        state.currentHp = clamp(
          state.currentHp + journeyStats.regenPerHour * hours,
          0,
          journeyStats.maxHp
        );
      } else {
        state.currentHp = clamp(
          state.currentHp - (3.2 + state.bossIndex * 0.15) * hours,
          0,
          journeyStats.maxHp
        );
      }

      if (Math.random() < Math.min(0.32, 0.12 * hours + state.bossIndex * 0.01)) {
        const encounterDamage = Math.max(
          1,
          randomInt(2, 8 + Math.max(0, state.bossIndex - 1)) -
            Math.floor(journeyStats.stats.finesse / 3)
        );
        state.currentHp = clamp(
          state.currentHp - encounterDamage,
          0,
          journeyStats.maxHp
        );

        if (Math.random() < 0.45) {
          addJourneyLog(
            state,
            `Beat back roaming threats on the ${getJourneyZoneName(state.bossIndex)}.`,
            nextCursor.toISOString()
          );
        }
      }

      if (
        state.currentHp <= journeyStats.maxHp * 0.18 ||
        state.currentHunger <= journeyStats.maxHunger * 0.12
      ) {
        sendJourneyToTown(
          state,
          nextCursor,
          "The party staggered back to town to recover.",
          4,
          7
        );
      }

      while (
        state.status === "adventuring" &&
        state.totalDistance >= (state.bossIndex + 1) * JOURNEY_BOSS_DISTANCE
      ) {
        resolveJourneyBoss(state, journeyStats, nextCursor);
      }
    }

    cursor = nextCursor;
    remainingMs -= sliceMs;
  }
}

function resolveJourneyBoss(state, journeyStats, atDate) {
  const boss = getJourneyBoss(state.bossIndex);
  const bossPower = boss.power;
  const roll =
    journeyStats.power +
    randomInt(0, 16 + Math.floor(journeyStats.level * 1.6)) +
    state.currentHp * 0.08 +
    state.currentHunger * 0.05;

  if (roll >= bossPower) {
    state.bossIndex += 1;
    state.currentHp = clamp(
      state.currentHp - randomInt(6, 16 + Math.floor(state.bossIndex / 2)),
      0,
      journeyStats.maxHp
    );
    state.currentHunger = clamp(
      state.currentHunger - randomInt(5, 13),
      0,
      journeyStats.maxHunger
    );
    addJourneyLog(
      state,
      `Defeated ${boss.name}. The road opened into ${getJourneyZoneName(
        state.bossIndex
      )}.`,
      atDate.toISOString()
    );
    return;
  }

  state.totalDistance = Math.max(
    state.bossIndex * JOURNEY_BOSS_DISTANCE + 42,
    state.totalDistance - randomInt(10, 22)
  );
  state.currentHp = clamp(
    state.currentHp - randomInt(16, 28),
    0,
    journeyStats.maxHp
  );
  state.currentHunger = clamp(
    state.currentHunger - randomInt(10, 18),
    0,
    journeyStats.maxHunger
  );
  addJourneyLog(
    state,
    `${boss.name} pushed the party back. Retreating to town.`,
    atDate.toISOString()
  );
  sendJourneyToTown(state, atDate, `Recovering after ${boss.name}.`, 5, 9);
}

function sendJourneyToTown(state, atDate, message, minHours, maxHours) {
  state.status = "recovering";
  state.townVisits += 1;
  state.restUntil = new Date(
    atDate.getTime() + randomInt(minHours, maxHours) * 60 * 60 * 1000
  ).toISOString();
  state.currentHp = Math.max(state.currentHp, 18);
  state.currentHunger = Math.max(state.currentHunger, 14);
  addJourneyLog(state, message, atDate.toISOString());
}

function addJourneyLog(state, text, at) {
  const safeText = String(text || "").trim();
  if (!safeText) return;

  state.log = [{ text: safeText, at }, ...(Array.isArray(state.log) ? state.log : [])]
    .slice(0, JOURNEY_LOG_LIMIT);
}

function getJourneyLevel(state, currentTrackerLevel) {
  return Math.max(1, state.highestTrackerLevel || 1, currentTrackerLevel || 1);
}

function getUnspentSkillPoints(state, journeyLevel) {
  const spentPoints = JOURNEY_STAT_KEYS.reduce(
    (total, key) => total + (state.allocatedStats[key] || 0),
    0
  );
  return Math.max(0, journeyLevel - 1 - spentPoints);
}

function getJourneyBoss(index) {
  const cycle = Math.floor(index / JOURNEY_BOSS_NAMES.length);
  const baseName = JOURNEY_BOSS_NAMES[index % JOURNEY_BOSS_NAMES.length];

  return {
    name: cycle ? `${baseName} ${romanize(cycle + 1)}` : baseName,
    power: 82 + index * 16 + Math.floor(index / 3) * 8,
  };
}

function getJourneyZoneName(bossIndex) {
  return JOURNEY_ZONE_NAMES[bossIndex % JOURNEY_ZONE_NAMES.length];
}

function getJourneySegmentProgress(totalDistance, bossIndex) {
  const segmentStart = bossIndex * JOURNEY_BOSS_DISTANCE;
  const nextBossDistance = (bossIndex + 1) * JOURNEY_BOSS_DISTANCE;
  const distanceIntoSegment = clamp(totalDistance - segmentStart, 0, JOURNEY_BOSS_DISTANCE);
  const remainingDistance = Math.max(0, nextBossDistance - totalDistance);
  const percent = clamp((distanceIntoSegment / JOURNEY_BOSS_DISTANCE) * 100, 0, 100);

  return {
    percent,
    remainingDistance,
    currentLabel: `${Math.floor(distanceIntoSegment)} / ${JOURNEY_BOSS_DISTANCE} road units`,
    remainingLabel: `${Math.ceil(remainingDistance)} to boss`,
  };
}

function getJourneyActivityText(state, boss, progress, journeyStats) {
  if (state.status === "recovering") {
    return getRecoveryText(state);
  }

  return `Travelling through ${getJourneyZoneName(state.bossIndex)} toward ${boss.name}. ${progress.remainingLabel}. Approx ${formatDurationHours(
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour)
  )} away.`;
}

function getRecoveryText(state) {
  if (!state.restUntil) {
    return "Recovering in town before the next attempt.";
  }

  const remainingMs = Math.max(
    0,
    new Date(state.restUntil).getTime() - Date.now()
  );
  return `Resting in town for ${formatDurationMs(remainingMs)}.`;
}

function getJourneyStatusLabel(status) {
  return status === "recovering" ? "Recovering" : "Adventuring";
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDurationHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "under 1h";

  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "under 1h";
  return formatDurationHours(ms / (1000 * 60 * 60));
}

function romanize(value) {
  const numerals = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let output = "";

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      output += numeral;
      remaining -= amount;
    }
  }

  return output;
}
