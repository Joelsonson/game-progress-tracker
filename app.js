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
const JOURNEY_PENDING_EVENT_LIMIT = 2;
const JOURNEY_DEBUG_HISTORY_LIMIT = 6;
const JOURNEY_RECENT_EVENT_LIMIT = 4;
const JOURNEY_STORY_XP_PER_LEVEL = 100;
const JOURNEY_BASE_CLASS = "stranded";
const JOURNEY_STAT_KEYS = ["might", "finesse", "arcana", "vitality", "resolve"];
const JOURNEY_FLAG_KEYS = ["foundWeapon", "boarDefeated", "slimeSapped"];

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
  [JOURNEY_BASE_CLASS]: {
    label: "Weak and Newly Isekai'd",
    description:
      "You woke up in another world with no training, no map, and barely anything that counts as gear.",
    bonuses: { might: 0, finesse: 0, arcana: 0, vitality: 0, resolve: 0 },
    unlockHint: "This is where everybody starts: weak, confused, and trying not to die.",
  },
  warrior: {
    label: "Scrapper",
    description:
      "You learned to fight ugly, brace for impact, and survive close-range scraps.",
    bonuses: { might: 2, finesse: 0, arcana: 0, vitality: 1, resolve: 0 },
    unlockHint: "Usually unlocked by learning from guards, hunters, or desperate fights.",
  },
  mage: {
    label: "Hedge Mage",
    description:
      "The world starts feeling less silent. You sense strange currents and learn to work with them.",
    bonuses: { might: 0, finesse: 0, arcana: 3, vitality: 0, resolve: 1 },
    unlockHint: "Usually unlocked through strange shrines, mana-sensitive people, or careful choices.",
  },
  thief: {
    label: "Scout",
    description:
      "You survive by moving lightly, spotting trouble early, and wasting nothing.",
    bonuses: { might: 0, finesse: 3, arcana: 0, vitality: 0, resolve: 1 },
    unlockHint: "Usually unlocked by foraging, sneaking, and learning from people who live off the land.",
  },
};

const JOURNEY_STAT_META = {
  might: {
    label: "Might",
    help: "Helps with rough fights, carrying weight, and making weak weapons count.",
  },
  finesse: {
    label: "Finesse",
    help: "Makes you quicker, quieter, and harder to catch in bad situations.",
  },
  arcana: {
    label: "Arcana",
    help: "Lets you notice and eventually use the strange rules of this world.",
  },
  vitality: {
    label: "Vitality",
    help: "Keeps you standing longer and helps you recover after ugly mistakes.",
  },
  resolve: {
    label: "Resolve",
    help: "Helps you stay calm, stretch poor meals, and keep moving while exhausted.",
  },
};

const JOURNEY_ZONE_NAMES = [
  "Unknown Forest",
  "Creekside Thicket",
  "Abandoned Footpath",
  "Fallow Hamlet Outskirts",
  "Broken Watchroad",
  "Fog Marsh Crossing",
  "Stonepass Trail",
  "Old Frontier Road",
];

const JOURNEY_BOSS_NAMES = [
  "Cornered Forest Boar",
  "Hungry Wolf Pack",
  "Bridge Ambusher",
  "Marshfang Lurker",
  "Hill Band Captain",
  "Ruin-Stalker",
  "Gravepath Ogre",
  "Storm Ridge Wyrm",
  "The Border Tyrant",
];

const JOURNEY_AMBIENT_INTERACTIONS = {
  arrival: [
    "You spent half an hour convincing yourself the strange sky was real.",
    "You followed a game trail, lost it, and had to start over from scratch.",
    "Every snapping twig sounded like a monster until you realized some were only rabbits.",
    "You tested bark, roots, and berries with the caution of someone who badly wants to stay alive.",
  ],
  survival: [
    "You found a flatter patch of ground and counted that as shelter.",
    "A stream saved the day, even if the water tasted like leaves and mud.",
    "You practised gripping your makeshift weapon until your hands stopped shaking.",
    "You learned the hard way that panic wastes more energy than walking does.",
  ],
  frontier: [
    "A distant chimney reminded you civilization exists somewhere beyond the trees.",
    "You moved slower today, but you chose the safer trail and kept your footing.",
    "You caught yourself scanning every hedgerow before committing to the road.",
    "You are not comfortable out here yet, but you are no longer completely helpless.",
  ],
};

const JOURNEY_STARTER_ITEMS = [
  "dead phone",
  "cheap wristwatch",
  "school backpack",
  "blunt pocket knife",
  "lucky coin",
  "cracked lighter",
  "old notebook",
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
const sessionObjectiveInput = document.querySelector("#sessionObjective");
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
const clearJourneyButton = document.querySelector("#clearJourneyButton");
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
const journeyEventModal = document.querySelector("#journeyEventModal");
const journeyEventTitleEl = document.querySelector("#journeyEventTitle");
const journeyEventMetaEl = document.querySelector("#journeyEventMeta");
const journeyEventBodyEl = document.querySelector("#journeyEventBody");
const journeyEventCloseButton = document.querySelector("#journeyEventCloseButton");
const journeyOutcomeModal = document.querySelector("#journeyOutcomeModal");
const journeyOutcomeTitleEl = document.querySelector("#journeyOutcomeTitle");
const journeyOutcomeMetaEl = document.querySelector("#journeyOutcomeMeta");
const journeyOutcomeBodyEl = document.querySelector("#journeyOutcomeBody");
const journeyOutcomeCloseButton = document.querySelector(
  "#journeyOutcomeCloseButton"
);
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
  importDataButton?.addEventListener("click", () => openFilePicker(importDataInput));
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

  applyScreenHash(nextScreenId);

  if (scrollToTop && isMobileViewport()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function applyScreenHash(screenId) {
  const screen = appScreens.find((entry) => entry.dataset.screen === screenId);
  if (!screen?.id) return;

  try {
    window.history.replaceState(null, "", `#${screen.id}`);
  } catch (error) {
    // Ignore history update failures.
  }
}

function scrollScreenIntoView(screenId) {
  const screen = appScreens.find((entry) => entry.dataset.screen === screenId);
  screen?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openFilePicker(input) {
  if (!(input instanceof HTMLInputElement)) return;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {
      // Fall back to click for browsers that reject showPicker.
    }
  }

  input.click();
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
  const currentObjective = notesInput.value.trim();
  const status = isValidStatus(gameStatusInput.value)
    ? gameStatusInput.value
    : DEFAULT_GAME_STATUS;

  if (!title) {
    showMessage(formMessage, "Please enter a game title.", true);
    return;
  }

  try {
    const existingGames = await getAllGames(db);
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
      currentObjective:
        updatedObjective || selectedGame.currentObjective || selectedGame.notes || "",
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
      }" • ${xpBreakdown.totalText}${focusText}${
        updatedObjective ? " • Objective updated." : ""
      }.`
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
      openFilePicker(coverArtPickerInput);
      return;
    }

    if (action === "pick-banner-art") {
      pendingArtTarget = { gameId: id, kind: "banner" };
      openFilePicker(bannerArtPickerInput);
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

async function handleResetJourneyData() {
  const confirmed = window.confirm(
    "Reset only the idle journey and keep your games, sessions, and records?"
  );

  if (!confirmed) return;

  try {
    await setMeta(db, IDLE_JOURNEY_META_KEY, null);
    showMessage(settingsMessage, "Idle journey reset. Tracker history kept.");
    await renderApp();
  } catch (error) {
    console.error("Failed to reset journey data:", error);
    showMessage(
      settingsMessage,
      getErrorMessage(error, "Could not reset the idle journey."),
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
  const objective = escapeHtml(getGameObjectiveText(mainGame));
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
  const safeNotes = escapeHtml(getGameObjectiveText(game));
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

      <div class="game-actions" aria-label="Game actions for ${escapeAttribute(
        game.title
      )}">
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
          getGameObjectiveText(game)
            ? `<div class="note-block"><p class="note-label">Final note</p><p class="game-notes">${escapeHtml(
                getGameObjectiveText(game)
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

function getGameObjectiveText(game) {
  return String(game?.currentObjective || game?.notes || "").trim();
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
    "currentObjective",
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
  syncBodyScrollLock();
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

function syncBodyScrollLock() {
  document.body.style.overflow =
    cropSession ||
    (journeyEventModal && !journeyEventModal.hidden) ||
    (journeyOutcomeModal && !journeyOutcomeModal.hidden)
      ? "hidden"
      : "";
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
  syncBodyScrollLock();
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
    getGameObjectiveText(game) ||
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

async function handleHomeJourneyClick(event) {
  const button = event.target.closest("button[data-home-action]");
  if (!button) return;

  const action = button.dataset.homeAction;

  if (action === "open-journey" || action === "open-event") {
    setActiveScreen("journey", {
      store: true,
      scrollToTop: isMobileViewport(),
    });
    applyScreenHash("journey");

    if (!isMobileViewport()) {
      scrollScreenIntoView("journey");
    }
  }

  if (action !== "open-event") return;

  const eventId = button.dataset.eventId;
  if (!eventId) return;

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
    await renderApp();

    const pendingEvent = state.pendingEvents.find((entry) => entry.id === eventId);
    if (pendingEvent) {
      openJourneyEventModal(pendingEvent);
      return;
    }

    showMessage(journeyMessageEl, "That event is no longer waiting.", true);
  } catch (error) {
    console.error("Failed to open journey event:", error);
    showMessage(
      journeyMessageEl,
      getErrorMessage(error, "Could not open that journey event."),
      true
    );
  }
}

function renderHomeJourney(state, xpSummary) {
  if (!homeJourneyContentEl) return;

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats
  );
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const pendingEvent = state.pendingEvents[0] || null;
  const advancedClassCount = state.unlockedClasses.filter(
    (classKey) => classKey !== JOURNEY_BASE_CLASS
  ).length;
  const displayName = getJourneyDisplayName(state);

  homeJourneyContentEl.innerHTML = `
    <div class="journey-home-shell">
      <div class="journey-home-top">
        <div class="journey-home-copy">
          <p class="eyebrow">Journey at a glance</p>
          <h2>${escapeHtml(displayName)}</h2>
          <p class="muted-text">
            ${escapeHtml(getJourneyActivityText(state, boss, progress, journeyStats))}
          </p>

          <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${progress.percent}%"></div>
          </div>

          <div class="journey-progress-meta">
            <span>${stretchPresentation.currentLabel}</span>
            <span>${stretchPresentation.remainingLabel}</span>
          </div>

          <div class="summary-row">
            <span class="summary-pill">Current goal: ${escapeHtml(
              stretchPresentation.goalTitle
            )}</span>
            <span class="summary-pill">${escapeHtml(
              stretchPresentation.horizonLabel
            )}: ${escapeHtml(stretchPresentation.horizonValue)}</span>
            <span class="summary-pill">Road cleared: ${state.bossIndex}</span>
            <span class="summary-pill">Discipline: ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</span>
            <span class="summary-pill">Unlocked paths: ${advancedClassCount}</span>
            ${
              pendingEvent
                ? `<span class="summary-pill">Event waiting</span>`
                : ""
            }
          </div>
        </div>

        <div class="journey-home-meters">
          <div>
            <p class="journey-overline">Condition</p>
            <h3>Lv. ${journeyLevel} ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</h3>
            <p class="journey-inline-copy">
              Started with a ${escapeHtml(state.starterItem)} • ${getJourneyStatusLabel(state.status)}
            </p>
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
        ${
          pendingEvent
            ? `
              <button
                type="button"
                class="primary-button"
                data-home-action="open-event"
                data-event-id="${pendingEvent.id}"
              >
                Something happened
              </button>
            `
            : ""
        }
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

    if (action === "open-event") {
      const eventId = button.dataset.eventId;
      const pendingEvent = state.pendingEvents.find((entry) => entry.id === eventId);

      if (!pendingEvent) {
        showMessage(journeyMessageEl, "That event is no longer waiting.", true);
        await renderApp();
        return;
      }

      openJourneyEventModal(pendingEvent);
      return;
    }

    if (action === "save-name") {
      const nameInput = document.querySelector("#journeyCharacterNameInput");
      const nextName =
        nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
      state.characterName = nextName.slice(0, 30);
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        state.characterName
          ? `Character name set to ${state.characterName}.`
          : "Character name cleared."
      );
      await renderApp();
      return;
    }

    if (action === "set-class") {
      const classType = button.dataset.class;
      if (!JOURNEY_CLASS_META[classType] || !hasJourneyClassUnlocked(state, classType)) {
        showMessage(journeyMessageEl, "That discipline has not been unlocked yet.", true);
        return;
      }

      state.classType = classType;
      addJourneyLog(
        state,
        `You settled into the ${JOURNEY_CLASS_META[classType].label} discipline.`,
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        `${JOURNEY_CLASS_META[classType].label} equipped.`
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
        `${JOURNEY_STAT_META[statKey].label} improved through hard-earned experience.`,
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

    if (action === "debug-advance") {
      const hours = Math.max(1, Number(button.dataset.hours) || 1);
      pushJourneyDebugSnapshot(state);
      state.lastUpdatedAt = new Date(
        Date.now() - hours * 60 * 60 * 1000
      ).toISOString();
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, `Advanced journey time by ${hours}h.`);
      await renderApp();
      return;
    }

    if (action === "debug-undo") {
      const previousSnapshot = state.debugHistory?.[0];
      if (!previousSnapshot) {
        showMessage(journeyMessageEl, "No debug snapshot to restore.", true);
        return;
      }

      const remainingHistory = state.debugHistory.slice(1);
      const restoredState = normalizeJourneyState({
        ...previousSnapshot,
        debugHistory: remainingHistory,
      });
      await setMeta(db, IDLE_JOURNEY_META_KEY, restoredState);
      showMessage(journeyMessageEl, "Restored the previous debug snapshot.");
      await renderApp();
      return;
    }

    if (action === "debug-event") {
      const journeyContext = buildJourneyContext(games, sessions);
      const candidates = getJourneyEventCandidates(
        state,
        journeyLevel,
        new Date(),
        journeyContext
      );

      if (!candidates.length) {
        showMessage(journeyMessageEl, "No event candidates are available right now.", true);
        return;
      }

      pushJourneyDebugSnapshot(state);
      const forcedEvent = candidates[randomInt(0, candidates.length - 1)].build();
      state.pendingEvents = [forcedEvent, ...state.pendingEvents].slice(
        0,
        JOURNEY_PENDING_EVENT_LIMIT
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, `Forced event: ${forcedEvent.title}.`);
      await renderApp();
      openJourneyEventModal(forcedEvent);
      return;
    }

    if (action === "reset-journey") {
      const confirmed = window.confirm(
        "Reset only the idle journey and keep your games and session history?"
      );

      if (!confirmed) return;

      await setMeta(db, IDLE_JOURNEY_META_KEY, null);
      showMessage(journeyMessageEl, "Idle journey reset. Tracker history kept.");
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
        state.currentHunger + 24 + journeyStats.stats.resolve * 2,
        0,
        journeyStats.maxHunger
      );
      addJourneyLog(
        state,
        "You slowed down long enough to eat properly and steady yourself.",
        new Date().toISOString()
      );
      await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, "Used 1 ration to restore hunger.");
      await renderApp();
      return;
    }

    if (action === "use-tonic") {
      if (supplies.availableTonics <= 0) {
        showMessage(
          journeyMessageEl,
          "No tonics earned yet. Meaningful progress and good choices are how you build them.",
          true
        );
        return;
      }

      const journeyStats = buildJourneyDerived(state, journeyLevel);
      state.spentTonics += 1;
      state.currentHp = clamp(
        state.currentHp + 28 + journeyStats.stats.vitality * 3,
        0,
        journeyStats.maxHp
      );
      addJourneyLog(
        state,
        "You drank a tonic and pushed the worst of your injuries back.",
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

async function handleJourneyEventModalClick(event) {
  if (
    event.target instanceof HTMLElement &&
    event.target.dataset.closeJourneyEvent !== undefined
  ) {
    closeJourneyEventModal();
    return;
  }

  const button = event.target.closest("button[data-journey-event-choice]");
  if (!button) return;

  await resolveJourneyEventChoice(button.dataset.eventId, button.dataset.choiceId);
}

function handleJourneyOutcomeModalClick(event) {
  if (
    event.target instanceof HTMLElement &&
    event.target.dataset.closeJourneyOutcome !== undefined
  ) {
    closeJourneyOutcomeModal();
  }
}

function openJourneyEventModal(eventEntry) {
  if (!journeyEventModal || !journeyEventBodyEl || !journeyEventTitleEl || !journeyEventMetaEl) {
    return;
  }

  journeyEventTitleEl.textContent = eventEntry.title;
  journeyEventMetaEl.textContent = `${formatDateTime(eventEntry.createdAt)} • ${eventEntry.teaser}`;
  journeyEventBodyEl.innerHTML = `
    <div class="journey-event-panel">
      <p>${escapeHtml(eventEntry.detail)}</p>
    </div>

    <div class="journey-event-choice-list">
      ${eventEntry.choices
        .map(
          (choice) => `
            <button
              type="button"
              class="secondary-button journey-event-choice"
              data-journey-event-choice="resolve"
              data-event-id="${eventEntry.id}"
              data-choice-id="${choice.id}"
            >
              <strong>${escapeHtml(choice.label)}</strong>
              <span>${escapeHtml(choice.preview)}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  journeyEventModal.hidden = false;
  syncBodyScrollLock();
}

function closeJourneyEventModal() {
  if (!journeyEventModal) return;
  journeyEventModal.hidden = true;
  if (journeyEventBodyEl) journeyEventBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

function openJourneyOutcomeModal(eventEntry, choice, resultText, outcomeItems) {
  if (
    !journeyOutcomeModal ||
    !journeyOutcomeBodyEl ||
    !journeyOutcomeTitleEl ||
    !journeyOutcomeMetaEl
  ) {
    return;
  }

  journeyOutcomeTitleEl.textContent = eventEntry?.title || "What happened next";
  journeyOutcomeMetaEl.textContent = choice?.label
    ? `You chose: ${choice.label}`
    : "The road answered your choice.";
  journeyOutcomeBodyEl.innerHTML = `
    <div class="journey-event-panel journey-outcome-panel">
      <p>${escapeHtml(resultText)}</p>
      ${
        outcomeItems.length
          ? `
            <div class="journey-outcome-pill-row">
              ${outcomeItems
                .map(
                  (item) => `
                    <span class="journey-outcome-pill ${escapeAttribute(
                      item.className
                    )}">${escapeHtml(item.label)}</span>
                  `
                )
                .join("")}
            </div>
          `
          : `<p class="muted-text">Nothing shifted in a way you could clearly measure.</p>`
      }
    </div>
  `;

  journeyOutcomeModal.hidden = false;
  syncBodyScrollLock();
}

function closeJourneyOutcomeModal() {
  if (!journeyOutcomeModal) return;
  journeyOutcomeModal.hidden = true;
  if (journeyOutcomeBodyEl) journeyOutcomeBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

async function resolveJourneyEventChoice(eventId, choiceId) {
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
    const journeyStats = buildJourneyDerived(state, journeyLevel);
    const eventEntry = state.pendingEvents.find((entry) => entry.id === eventId);
    const choice = eventEntry?.choices.find((entry) => entry.id === choiceId);

    if (!eventEntry || !choice) {
      closeJourneyEventModal();
      showMessage(journeyMessageEl, "That event is no longer available.", true);
      await renderApp();
      return;
    }

    state.pendingEvents = state.pendingEvents.filter((entry) => entry.id !== eventId);
    const beforeState = normalizeJourneyState({
      ...state,
      pendingEvents: [],
      debugHistory: [],
    });
    const resultMessage = applyJourneyChoiceEffects(
      state,
      choice,
      journeyStats,
      new Date().toISOString()
    );
    if (eventEntry.kind === "aid") {
      state.aidUrgency = Math.max(0, state.aidUrgency - 2);
    }
    const outcomeItems = buildJourneyOutcomeItems(beforeState, state);

    await setMeta(db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
    closeJourneyEventModal();
    openJourneyOutcomeModal(eventEntry, choice, resultMessage, outcomeItems);
    showMessage(journeyMessageEl, resultMessage);
    await renderApp();
  } catch (error) {
    console.error("Failed to resolve journey event:", error);
    closeJourneyEventModal();
    showMessage(
      journeyMessageEl,
      getErrorMessage(error, "Could not resolve that event."),
      true
    );
  }
}

async function syncJourneyState(rawState, games, sessions, xpSummary) {
  const now = new Date();
  const state = normalizeJourneyState(rawState);
  const journeyContext = buildJourneyContext(games, sessions);
  let changed = !rawState;

  if (xpSummary.level > state.highestTrackerLevel) {
    for (
      let nextLevel = state.highestTrackerLevel + 1;
      nextLevel <= xpSummary.level;
      nextLevel += 1
    ) {
      addJourneyLog(
        state,
        `Tracker level ${nextLevel} reached. That struggle translated into growth out on the road.`,
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
    simulateJourneyState(state, elapsedMs, journeyStats, journeyContext);
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
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats
  );
  const unspentSkillPoints = getUnspentSkillPoints(state, journeyLevel);
  const activityText = getJourneyActivityText(state, boss, progress, journeyStats);
  const nextBossEtaHours =
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour);
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const storyLevelBonus = getJourneyStoryLevelBonus(state.storyXp);
  const displayName = getJourneyDisplayName(state);
  const inventoryItems = getJourneyInventoryItems(state, supplies);
  const knownNotes = getJourneyKnownNotes(state);
  const pendingEventsMarkup = state.pendingEvents.length
    ? `
        <article class="journey-side-card journey-alert-card">
          <p class="journey-overline">Event queue</p>
          <h4>Something happened</h4>
          <p class="muted-text">
            The road has a way of forcing decisions on you.
          </p>
          <div class="journey-event-list">
            ${state.pendingEvents
              .map(
                (eventEntry) => `
                  <button
                    type="button"
                    class="secondary-button journey-event-button"
                    data-journey-action="open-event"
                    data-event-id="${eventEntry.id}"
                  >
                    <span>
                      <span class="journey-event-kicker">New event</span>
                      <strong>${escapeHtml(eventEntry.title)}</strong>
                    </span>
                    <span class="journey-event-summary">${escapeHtml(eventEntry.teaser)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </article>
      `
    : `
        <article class="journey-side-card">
          <p class="journey-overline">Quiet stretch</p>
          <h4>No immediate event</h4>
          <p class="muted-text">
            Nothing urgent is waiting. For now, the road is only asking you to keep moving.
          </p>
        </article>
      `;

  journeyContentEl.innerHTML = `
    <section class="journey-hero">
      <div class="journey-hero-top">
        <div class="journey-side-card">
          <p class="journey-overline">Current stretch</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(displayName)} • Lv. ${journeyLevel}</h3>
            <span class="journey-chip is-active">${escapeHtml(getJourneyZoneName(state.bossIndex))}</span>
            <span class="journey-chip">${escapeHtml(getJourneyStatusLabel(state.status))}</span>
            ${
              state.pendingEvents.length
                ? `<span class="journey-chip is-warning">${state.pendingEvents.length} event waiting</span>`
                : ""
            }
          </div>
          <p class="journey-zone">${escapeHtml(activityText)}</p>
          <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${progress.percent}%"></div>
          </div>
          <div class="journey-progress-meta">
            <span>${stretchPresentation.currentLabel}</span>
            <span>${stretchPresentation.remainingLabel}</span>
          </div>
          <div class="summary-row">
            <span class="summary-pill">Current goal: ${escapeHtml(
              stretchPresentation.goalTitle
            )}</span>
            <span class="summary-pill">${escapeHtml(
              stretchPresentation.horizonLabel
            )}: ${escapeHtml(stretchPresentation.horizonValue)}</span>
            <span class="summary-pill">Road cleared: ${state.bossIndex}</span>
            <span class="summary-pill">Retreats: ${state.townVisits}</span>
            <span class="summary-pill">Pace: ${journeyStats.speedPerHour.toFixed(1)}/hr</span>
          </div>
          <p class="muted-text">
            ${escapeHtml(stretchPresentation.innerThoughts)}
          </p>
        </div>

        <article class="journey-side-card journey-character-card">
          <p class="journey-overline">Character</p>
          <div class="journey-title-row">
            <h4>${escapeHtml(displayName)}</h4>
            <span class="journey-chip">${escapeHtml(JOURNEY_CLASS_META[state.classType].label)}</span>
          </div>
          <div class="journey-character-name-row">
            <input
              id="journeyCharacterNameInput"
              type="text"
              maxlength="30"
              placeholder="Name your character"
              value="${escapeAttribute(state.characterName)}"
            />
            <button
              type="button"
              class="secondary-button"
              data-journey-action="save-name"
            >
              Save name
            </button>
          </div>
          <div class="journey-story-stats">
            <div class="journey-story-stat">
              <span>Journey level</span>
              <strong>${journeyLevel}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Tracker level</span>
              <strong>${xpSummary.level}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Story XP</span>
              <strong>${state.storyXp}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Extra levels</span>
              <strong>+${storyLevelBonus}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Skill points left</span>
              <strong>${unspentSkillPoints}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Power</span>
              <strong>${journeyStats.power.toFixed(0)}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Regen</span>
              <strong>${journeyStats.regenPerHour.toFixed(1)}/hr</strong>
            </div>
            <div class="journey-story-stat">
              <span>Hunger drain</span>
              <strong>${journeyStats.hungerDrainPerHour.toFixed(1)}/hr</strong>
            </div>
          </div>
          <p class="muted-text">
            Extra levels come from story XP earned by events, hardship, and major moments on the road.
          </p>
          <p class="muted-text">
            ${
              state.status === "recovering"
                ? escapeHtml(getRecoveryText(state))
                : `Next threat ETA: ${formatDurationHours(nextBossEtaHours)}`
            }
          </p>
        </article>
      </div>
    </section>

    <section class="journey-resource-grid">
      <article class="journey-resource-card">
        <h4>Health</h4>
        <div class="resource-track">
          <div class="resource-fill resource-fill-health" style="width: ${hpPercent}%"></div>
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
          <div class="resource-fill resource-fill-hunger" style="width: ${hungerPercent}%"></div>
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
      ${pendingEventsMarkup}

      <article class="journey-side-card">
        <p class="journey-overline">Class discipline</p>
        <h4>${escapeHtml(JOURNEY_CLASS_META[state.classType].label)}</h4>
        <p class="muted-text">${escapeHtml(JOURNEY_CLASS_META[state.classType].description)}</p>
        ${buildJourneyClassSelectionUi(state)}
      </article>
    </section>

    <section class="journey-utility-row">
      <article class="journey-side-card">
        <p class="journey-overline">Inventory</p>
        <h4>What you are carrying</h4>
        <div class="summary-row">
          <span class="summary-pill">Rations: ${supplies.availableRations} / ${supplies.earnedRations}</span>
          <span class="summary-pill">Tonics: ${supplies.availableTonics} / ${supplies.earnedTonics}</span>
        </div>
        <div class="journey-character-list">
          ${inventoryItems
            .map((item) => `<div class="journey-log-entry"><p>${escapeHtml(item)}</p></div>`)
            .join("")}
        </div>
      </article>

      <article class="journey-side-card">
        <p class="journey-overline">Field notes</p>
        <h4>What is known so far</h4>
        ${
          knownNotes.length
            ? `
              <div class="journey-character-list">
                ${knownNotes
                  .map((note) => `<div class="journey-log-entry"><p>${escapeHtml(note)}</p></div>`)
                  .join("")}
              </div>
            `
            : `<p class="muted-text">Very little makes sense yet. Most of what you know has been learned the hard way.</p>`
        }
      </article>
    </section>

    <section class="journey-side-card journey-debug-card">
      <p class="journey-overline">Debug tools</p>
      <h4>Force the clock</h4>
      <p class="muted-text">Use these to test passive incidents, travel updates, and queued events.</p>
      <div class="journey-class-list">
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="6">Advance 6h</button>
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="24">Advance 24h</button>
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="72">Advance 3d</button>
        <button type="button" class="secondary-button" data-journey-action="debug-event">Force event</button>
        <button type="button" class="secondary-button" data-journey-action="debug-undo">Undo debug step</button>
        <button type="button" class="secondary-button action-warning" data-journey-action="reset-journey">Reset journey only</button>
      </div>
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
        <h4>Latest hardships</h4>
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
            : '<div class="journey-log-entry"><p>You have only just arrived. The first ugly lesson is coming.</p></div>'}
        </div>
      </article>

      <article class="journey-log-card">
        <p class="journey-overline">Character sheet</p>
        <h4>Current build</h4>
        <div class="summary-row">
          <span class="summary-pill">Power ${journeyStats.power.toFixed(0)}</span>
          <span class="summary-pill">Regen ${journeyStats.regenPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Hunger drain ${journeyStats.hungerDrainPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Extra levels +${storyLevelBonus}</span>
        </div>
        <div class="journey-character-list">
          ${JOURNEY_STAT_KEYS.map((statKey) => {
            const modifier = state.statModifiers[statKey] || 0;
            const modifierText = modifier
              ? ` (${modifier > 0 ? "+" : ""}${modifier} modifier)`
              : "";
            return `<div class="journey-log-entry"><p>${escapeHtml(
              JOURNEY_STAT_META[statKey].label
            )}: ${journeyStats.stats[statKey]}${escapeHtml(modifierText)}</p></div>`;
          }).join("")}
        </div>
      </article>
    </section>
  `;
}

function normalizeJourneyState(rawState = null) {
  const nowIso = new Date().toISOString();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const allocatedStats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Math.max(
      0,
      Math.floor(Number(source.allocatedStats?.[key]) || 0)
    );
    return accumulator;
  }, {});
  const storyFlags = JOURNEY_FLAG_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Boolean(source.storyFlags?.[key]);
    return accumulator;
  }, {});
  const statModifiers = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Math.round(Number(source.statModifiers?.[key]) || 0);
    return accumulator;
  }, {});

  const unlockedClassSet = new Set(
    Array.isArray(source.unlockedClasses) ? source.unlockedClasses : []
  );
  unlockedClassSet.add(JOURNEY_BASE_CLASS);
  if (JOURNEY_CLASS_META[source.classType]) {
    unlockedClassSet.add(source.classType);
  }

  const unlockedClasses = [...unlockedClassSet].filter(
    (classKey) => JOURNEY_CLASS_META[classKey]
  );
  const classType = unlockedClasses.includes(source.classType)
    ? source.classType
    : JOURNEY_BASE_CLASS;
  const inferredBoarDefeat =
    storyFlags.boarDefeated || Math.max(0, Math.floor(Number(source.bossIndex) || 0)) > 0;
  const inferredWeapon =
    storyFlags.foundWeapon || inferredBoarDefeat || Boolean(source.weaponName);
  storyFlags.boarDefeated = inferredBoarDefeat;
  storyFlags.foundWeapon = inferredWeapon;

  return {
    version: 3,
    classType,
    unlockedClasses,
    allocatedStats,
    storyFlags,
    statModifiers,
    characterName:
      typeof source.characterName === "string" ? source.characterName.trim() : "",
    starterItem:
      typeof source.starterItem === "string" && source.starterItem.trim()
        ? source.starterItem.trim()
        : randomJourneyStarterItem(),
    weaponName:
      typeof source.weaponName === "string" && source.weaponName.trim()
        ? source.weaponName.trim()
        : inferredWeapon
          ? "Scavenged weapon"
          : "",
    storyXp: Math.max(0, Math.floor(Number(source.storyXp) || 0)),
    bonusSkillPoints: Math.max(
      0,
      Math.floor(Number(source.bonusSkillPoints) || 0)
    ),
    bonusRations: Math.max(0, Math.floor(Number(source.bonusRations) || 0)),
    bonusTonics: Math.max(0, Math.floor(Number(source.bonusTonics) || 0)),
    totalDistance: Math.max(0, Number(source.totalDistance) || 0),
    bossIndex: Math.max(0, Math.floor(Number(source.bossIndex) || 0)),
    currentHp: Math.max(0, Number(source.currentHp) || 72),
    currentHunger: Math.max(0, Number(source.currentHunger) || 70),
    status: source.status === "recovering" ? "recovering" : "adventuring",
    lastUpdatedAt: source.lastUpdatedAt || nowIso,
    restUntil: source.restUntil || null,
    recoveryObjective:
      typeof source.recoveryObjective === "string"
        ? source.recoveryObjective.trim()
        : "",
    aidUrgency: Math.max(0, Math.floor(Number(source.aidUrgency) || 0)),
    townVisits: Math.max(0, Math.floor(Number(source.townVisits) || 0)),
    spentRations: Math.max(0, Math.floor(Number(source.spentRations) || 0)),
    spentTonics: Math.max(0, Math.floor(Number(source.spentTonics) || 0)),
    highestTrackerLevel: Math.max(
      1,
      Math.floor(Number(source.highestTrackerLevel) || 1)
    ),
    pendingEvents: Array.isArray(source.pendingEvents)
      ? source.pendingEvents
          .slice(0, JOURNEY_PENDING_EVENT_LIMIT)
          .map((entry) => normalizeJourneyEvent(entry, nowIso))
          .filter(Boolean)
      : [],
    recentEventKeys: Array.isArray(source.recentEventKeys)
      ? source.recentEventKeys
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
          .slice(0, JOURNEY_RECENT_EVENT_LIMIT)
      : [],
    debugHistory: Array.isArray(source.debugHistory)
      ? source.debugHistory
          .slice(0, JOURNEY_DEBUG_HISTORY_LIMIT)
          .map((entry) => createJourneyDebugSnapshot(entry))
          .filter(Boolean)
      : [],
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

function normalizeJourneyEvent(eventEntry, nowIso) {
  if (!eventEntry || typeof eventEntry !== "object") return null;

  const choices = Array.isArray(eventEntry.choices)
    ? eventEntry.choices
        .map((choice) => normalizeJourneyChoice(choice))
        .filter(Boolean)
    : [];

  if (!choices.length) return null;

  return {
    id: String(eventEntry.id || crypto.randomUUID()),
    eventKey: String(
      eventEntry.eventKey || eventEntry.key || eventEntry.title || "journey-event"
    ),
    kind: eventEntry.kind === "aid" ? "aid" : "normal",
    title: String(eventEntry.title || "Journey event"),
    teaser: String(eventEntry.teaser || "A choice is waiting."),
    detail: String(eventEntry.detail || eventEntry.teaser || ""),
    createdAt: eventEntry.createdAt || nowIso,
    choices,
  };
}

function normalizeJourneyChoice(choice) {
  if (!choice || typeof choice !== "object") return null;

  const effects = choice.effects && typeof choice.effects === "object"
    ? choice.effects
    : {};
  const normalizedFlags = JOURNEY_FLAG_KEYS.reduce((accumulator, key) => {
    if (effects.flags?.[key] !== undefined) {
      accumulator[key] = Boolean(effects.flags[key]);
    }
    return accumulator;
  }, {});

  return {
    id: String(choice.id || crypto.randomUUID()),
    label: String(choice.label || "Choose"),
    preview: String(choice.preview || "See what happens."),
    resultText: String(choice.resultText || choice.preview || ""),
    effects: {
      hp: Math.round(Number(effects.hp) || 0),
      hunger: Math.round(Number(effects.hunger) || 0),
      distance: Math.round(Number(effects.distance) || 0),
      storyXp: Math.round(Number(effects.storyXp) || 0),
      bonusRations: Math.round(Number(effects.bonusRations) || 0),
      bonusTonics: Math.round(Number(effects.bonusTonics) || 0),
      bonusSkillPoints: Math.round(Number(effects.bonusSkillPoints) || 0),
      weaponName:
        typeof effects.weaponName === "string" ? effects.weaponName.trim() : "",
      unlockClass: JOURNEY_CLASS_META[effects.unlockClass]
        ? effects.unlockClass
        : "",
      flags: normalizedFlags,
    },
  };
}

function randomJourneyStarterItem() {
  return JOURNEY_STARTER_ITEMS[randomInt(0, JOURNEY_STARTER_ITEMS.length - 1)];
}

function createJourneyDebugSnapshot(rawState) {
  if (!rawState || typeof rawState !== "object") return null;

  const snapshot = normalizeJourneyState({
    ...rawState,
    debugHistory: [],
  });
  snapshot.debugHistory = [];
  return snapshot;
}

function pushJourneyDebugSnapshot(state) {
  const snapshot = createJourneyDebugSnapshot(state);
  if (!snapshot) return;

  state.debugHistory = [snapshot, ...(state.debugHistory || [])].slice(
    0,
    JOURNEY_DEBUG_HISTORY_LIMIT
  );
}

function buildJourneyDerived(state, journeyLevel) {
  const classMeta =
    JOURNEY_CLASS_META[state.classType] || JOURNEY_CLASS_META[JOURNEY_BASE_CLASS];
  const stats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] =
      2 +
      (classMeta.bonuses[key] || 0) +
      Math.round(Number(state.statModifiers?.[key]) || 0) +
      Math.max(0, Math.floor(Number(state.allocatedStats[key]) || 0));
    return accumulator;
  }, {});

  const maxHp = Math.round(44 + journeyLevel * 7 + stats.vitality * 10);
  const maxHunger = Math.round(58 + journeyLevel * 4 + stats.resolve * 6);
  const power =
    stats.might * 2.4 +
    stats.finesse * 1.8 +
    stats.arcana * 2.7 +
    stats.vitality * 0.9 +
    stats.resolve * 1 +
    journeyLevel * 4;
  const speedPerHour = 2.9 + stats.finesse * 0.34 + stats.resolve * 0.08;
  const regenPerHour = 0.8 + stats.vitality * 0.28 + stats.resolve * 0.08;
  const hungerDrainPerHour = Math.max(1.5, 4.6 - stats.resolve * 0.18);

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
  const meaningfulCount = sessions.filter(
    (session) => session.meaningfulProgress
  ).length;
  const completedCount = games.filter(
    (game) => game.status === GAME_STATUSES.COMPLETED
  ).length;
  const earnedRations =
    sessions.length + meaningfulCount + completedCount * 2 + state.bonusRations;
  const earnedTonics =
    Math.floor(meaningfulCount / 2) + completedCount * 3 + state.bonusTonics;

  return {
    earnedRations,
    earnedTonics,
    availableRations: Math.max(0, earnedRations - state.spentRations),
    availableTonics: Math.max(0, earnedTonics - state.spentTonics),
  };
}

function buildJourneyStretchChallenge(state, journeyStats) {
  const boss = getJourneyBoss(state.bossIndex);
  const conditionPower = state.currentHp * 0.12 + state.currentHunger * 0.08;
  const weaponBonus = state.storyFlags.foundWeapon ? 8 : -6;
  const powerRatio =
    (journeyStats.power + conditionPower + weaponBonus) / Math.max(1, boss.power);
  const successChance = clamp(
    0.14 + powerRatio * 0.56 + Math.max(0, journeyStats.level - state.bossIndex) * 0.02,
    0.12,
    0.9
  );

  return {
    boss,
    successChance,
    successPercent: Math.round(successChance * 100),
  };
}

function buildJourneyStretchPresentation(state, boss, progress, journeyStats) {
  const goalMeta = getJourneyGoalMeta(state, boss, progress);

  return {
    ...goalMeta,
    currentLabel:
      state.status === "recovering"
        ? `${progress.percent}% of this stretch is behind you.`
        : `${progress.percent}% of the way to ${goalMeta.goalAction}.`,
    remainingLabel: getJourneyProgressFeeling(state, progress.percent),
    innerThoughts: buildJourneyInnerThoughts(state, goalMeta, journeyStats),
  };
}

function getJourneyGoalMeta(state, boss, progress) {
  if (state.status === "recovering") {
    return {
      goalTitle: "Recover and regroup",
      goalAction: "recover and regroup",
      horizonLabel: "Right now",
      horizonValue: state.recoveryObjective || "Staying alive matters more than distance.",
    };
  }

  if (state.bossIndex === 0) {
    if (progress.percent < 18) {
      return {
        goalTitle: "Find your bearings",
        goalAction: "finding your bearings",
        horizonLabel: "Waiting ahead",
        horizonValue: "Nothing here feels familiar yet.",
      };
    }

    if (progress.percent < 38) {
      return {
        goalTitle: "Find a path that actually leads somewhere",
        goalAction: "finding a path that actually leads somewhere",
        horizonLabel: "Waiting ahead",
        horizonValue: "You need a trail that actually leads somewhere.",
      };
    }

    if (!state.storyFlags.foundWeapon || progress.percent < 56) {
      return {
        goalTitle: "Find something you can fight with",
        goalAction: "finding something you can fight with",
        horizonLabel: "Waiting ahead",
        horizonValue: "You cannot stay unarmed forever.",
      };
    }

    if (progress.percent < 78) {
      return {
        goalTitle: "Find food and steady yourself",
        goalAction: "finding food and steadying yourself",
        horizonLabel: "Waiting ahead",
        horizonValue: "You need enough strength for whatever comes next.",
      };
    }

    return {
      goalTitle: "Follow the boar's trail",
      goalAction: "following the boar's trail",
      horizonLabel: "Waiting ahead",
      horizonValue: "Fresh signs of the boar are all over this part of the forest.",
    };
  }

  if (state.bossIndex === 1) {
    if (progress.percent < 58) {
      return {
        goalTitle: "Stay ahead of the wolves",
        goalAction: "staying ahead of the wolves",
        horizonLabel: "Waiting ahead",
        horizonValue: "The pack is somewhere close enough to matter.",
      };
    }

    return {
      goalTitle: "Break through to safer ground",
      goalAction: "breaking through to safer ground",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (progress.percent < 62) {
    return {
      goalTitle: `Push through ${getJourneyZoneName(state.bossIndex)}`,
      goalAction: `pushing through ${getJourneyZoneName(state.bossIndex).toLowerCase()}`,
      horizonLabel: "Waiting ahead",
      horizonValue: "The road still feels hostile and half-known.",
    };
  }

  return {
    goalTitle: `Reach ${boss.name}`,
    goalAction: `reaching ${boss.name.toLowerCase()}`,
    horizonLabel: "Stretch end",
    horizonValue: boss.name,
  };
}

function getJourneyProgressFeeling(state, progressPercent) {
  if (state.status === "recovering") {
    return "Distance can wait until you are steady again.";
  }

  if (progressPercent < 20) return "You have only just started to get a handle on this.";
  if (progressPercent < 45) return "It still feels messy, but at least you are moving with some intent.";
  if (progressPercent < 75) return "The shape of the stretch is starting to reveal itself.";
  if (progressPercent < 95) return "The end of this stretch feels close now.";
  return "You are almost through this part of the road.";
}

function buildJourneyInnerThoughts(state, goalMeta, journeyStats) {
  if (state.status === "recovering") {
    return `I need to slow down and ${goalMeta.goalAction} before I even think about pushing any farther.`;
  }

  const stretchChallenge = buildJourneyStretchChallenge(state, journeyStats);

  if (stretchChallenge.successChance >= 0.74) {
    return `I think I can handle this. If I keep my head, I should manage ${goalMeta.goalAction} before this stretch turns ugly.`;
  }

  if (stretchChallenge.successChance >= 0.56) {
    return `I am not comfortable, but I can probably manage ${goalMeta.goalAction} if I stay focused and do not panic.`;
  }

  if (stretchChallenge.successChance >= 0.38) {
    return `I keep second-guessing myself. Maybe I can manage ${goalMeta.goalAction}, but it feels like one mistake could ruin the whole thing.`;
  }

  return `Things are not looking good. I can barely trust my own sense of direction right now, and ${goalMeta.goalAction} feels farther away every time I look up.`;
}

function buildJourneyRecoveryObjective(state, journeyLevel, journeyStats) {
  const needsRest = state.currentHp <= journeyStats.maxHp * 0.22;
  const needsFood = state.currentHunger <= journeyStats.maxHunger * 0.2;
  const zoneText = getJourneyZoneName(state.bossIndex);

  if (needsFood && !needsRest) {
    if (journeyLevel <= 2) {
      return `Scavenge berries and anything edible near ${zoneText} before hunger drops you completely.`;
    }
    if (journeyLevel <= 5) {
      return `Hunt or trade for trail food around ${zoneText} before you make another push.`;
    }
    return `Reach a coaching stop or stocked inn near ${zoneText} and refill your supplies.`;
  }

  if (journeyLevel <= 2) {
    return `Find a dry cave or hollow, patch yourself up, and rest before trying ${zoneText} again.`;
  }
  if (journeyLevel <= 5) {
    return `Reach a hunter's camp or farmhouse bed near ${zoneText} and recover properly.`;
  }
  return `Make for the nearest inn beyond ${zoneText}, rent a room, and recover before the next attempt.`;
}

function rememberJourneyEventKey(state, eventKey) {
  const safeKey = String(eventKey || "").trim();
  if (!safeKey) return;

  state.recentEventKeys = [
    safeKey,
    ...(Array.isArray(state.recentEventKeys) ? state.recentEventKeys : []).filter(
      (entry) => entry !== safeKey
    ),
  ].slice(0, JOURNEY_RECENT_EVENT_LIMIT);
}

function buildJourneyOutcomeItems(beforeState, afterState) {
  const items = [];
  const addDelta = (label, value) => {
    if (!value) return;

    items.push({
      label: `${label} ${formatSignedNumber(value)}`,
      className: value > 0 ? "is-positive" : "is-negative",
    });
  };

  addDelta("Health", Math.round(afterState.currentHp - beforeState.currentHp));
  addDelta("Hunger", Math.round(afterState.currentHunger - beforeState.currentHunger));
  addDelta("Travel", Math.round(afterState.totalDistance - beforeState.totalDistance));
  addDelta("Story XP", afterState.storyXp - beforeState.storyXp);
  addDelta(
    "Skill points",
    afterState.bonusSkillPoints - beforeState.bonusSkillPoints
  );
  addDelta("Rations", afterState.bonusRations - beforeState.bonusRations);
  addDelta("Tonics", afterState.bonusTonics - beforeState.bonusTonics);

  if (beforeState.weaponName !== afterState.weaponName && afterState.weaponName) {
    items.push({
      label: `Weapon: ${afterState.weaponName}`,
      className: "is-positive",
    });
  }

  if (beforeState.classType !== afterState.classType) {
    items.push({
      label: `Class: ${JOURNEY_CLASS_META[afterState.classType].label}`,
      className: "is-neutral",
    });
  }

  if (beforeState.status !== afterState.status) {
    items.push({
      label: `Status: ${getJourneyStatusLabel(afterState.status)}`,
      className: afterState.status === "recovering" ? "is-negative" : "is-neutral",
    });
  }

  return items;
}

function buildJourneyContext(games, sessions) {
  const mainGame =
    games.find((game) => game.isMain) ||
    games.find((game) => game.status === GAME_STATUSES.IN_PROGRESS) ||
    null;
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.playedAt) - new Date(a.playedAt)
  );
  const now = Date.now();
  const recentWindowMs = 1000 * 60 * 60 * 24 * 7;
  const recentSessions = sortedSessions.filter(
    (session) => now - new Date(session.playedAt).getTime() <= recentWindowMs
  );
  const recentMainSessions = mainGame
    ? recentSessions.filter((session) => session.gameId === mainGame.id)
    : [];
  const recentSideSessions = mainGame
    ? recentSessions.filter((session) => session.gameId !== mainGame.id)
    : recentSessions;
  const lastMainPlayedAt = mainGame
    ? sortedSessions.find((session) => session.gameId === mainGame.id)?.playedAt || null
    : null;
  const daysSinceMainQuest = lastMainPlayedAt
    ? differenceInDays(now, new Date(lastMainPlayedAt).getTime())
    : null;
  const neglectScore = clamp(
    (daysSinceMainQuest && daysSinceMainQuest > 2 ? daysSinceMainQuest - 2 : 0) +
      Math.max(0, recentSideSessions.length - recentMainSessions.length),
    0,
    10
  );
  const momentumScore = recentMainSessions.length + Math.min(2, computeStreak(sessions));

  return {
    mainGame,
    lastMainPlayedAt,
    daysSinceMainQuest,
    recentMainSessions,
    recentSideSessions,
    neglectScore,
    momentumScore,
  };
}

function simulateJourneyState(state, elapsedMs, journeyStats, journeyContext) {
  let remainingMs = elapsedMs;
  let cursor = new Date(state.lastUpdatedAt || new Date().toISOString());

  while (remainingMs > 0) {
    const sliceMs = Math.min(JOURNEY_TICK_MS, remainingMs);
    const nextCursor = new Date(cursor.getTime() + sliceMs);
    const hours = sliceMs / (1000 * 60 * 60);

    if (state.status === "recovering") {
      state.currentHp = clamp(
        state.currentHp + journeyStats.maxHp * 0.14 * hours,
        0,
        journeyStats.maxHp
      );
      state.currentHunger = clamp(
        state.currentHunger + 14 * hours,
        0,
        journeyStats.maxHunger
      );

      if (state.restUntil && nextCursor >= new Date(state.restUntil)) {
        state.status = "adventuring";
        state.restUntil = null;
        state.recoveryObjective = "";
        state.aidUrgency = Math.max(0, state.aidUrgency - 1);
        state.currentHp = Math.max(state.currentHp, journeyStats.maxHp * 0.58);
        state.currentHunger = Math.max(
          state.currentHunger,
          journeyStats.maxHunger * 0.68
        );
        addJourneyLog(
          state,
          `You left shelter and headed back toward ${getJourneyZoneName(state.bossIndex)}.`,
          nextCursor.toISOString()
        );
      }

      maybeQueueJourneyEvent(state, nextCursor, journeyStats.level, journeyContext);
    } else {
      const hpRatio = journeyStats.maxHp ? state.currentHp / journeyStats.maxHp : 0;
      const hungerRatio = journeyStats.maxHunger
        ? state.currentHunger / journeyStats.maxHunger
        : 0;
      const conditionMultiplier = clamp(
        Math.min(hpRatio, hungerRatio) + 0.3,
        0.24,
        1.02
      );

      state.totalDistance += journeyStats.speedPerHour * hours * conditionMultiplier;
      state.currentHunger = clamp(
        state.currentHunger - journeyStats.hungerDrainPerHour * hours,
        0,
        journeyStats.maxHunger
      );

      if (state.currentHunger > journeyStats.maxHunger * 0.4) {
        state.currentHp = clamp(
          state.currentHp + journeyStats.regenPerHour * hours,
          0,
          journeyStats.maxHp
        );
      } else {
        state.currentHp = clamp(
          state.currentHp - (2.8 + state.bossIndex * 0.18) * hours,
          0,
          journeyStats.maxHp
        );
      }

      if (Math.random() < Math.min(0.24, 0.09 * hours + state.bossIndex * 0.015)) {
        const encounterDamage = Math.max(
          1,
          randomInt(2, 6 + Math.max(0, state.bossIndex)) -
            Math.floor(journeyStats.stats.finesse / 3)
        );
        state.currentHp = clamp(
          state.currentHp - encounterDamage,
          0,
          journeyStats.maxHp
        );

        if (Math.random() < 0.6) {
          addJourneyLog(
            state,
            state.bossIndex === 0
              ? "Something moved in the brush and you came out of it bruised."
              : `You fought off trouble on the edge of ${getJourneyZoneName(
                  state.bossIndex
                )}.`,
            nextCursor.toISOString()
          );
        }
      }

      if (
        state.currentHp <= journeyStats.maxHp * 0.16 ||
        state.currentHunger <= journeyStats.maxHunger * 0.1
      ) {
        sendJourneyToTown(
          state,
          nextCursor,
          "You were in no state to continue and had to crawl back toward safety.",
          4,
          7,
          journeyStats.level,
          journeyStats
        );
      }

      while (
        state.status === "adventuring" &&
        state.totalDistance >= (state.bossIndex + 1) * JOURNEY_BOSS_DISTANCE
      ) {
        if (state.pendingEvents.length) {
          autoResolvePendingJourneyEvents(
            state,
            journeyStats,
            nextCursor.toISOString()
          );

          if (state.status !== "adventuring") {
            break;
          }
        }

        resolveJourneyBoss(state, journeyStats, nextCursor);
      }

      maybeAddAmbientJourneyLog(state, nextCursor);
      maybeApplyJourneyIncident(state, nextCursor, journeyStats, journeyContext);
      maybeQueueJourneyEvent(state, nextCursor, journeyStats.level, journeyContext);
    }

    cursor = nextCursor;
    remainingMs -= sliceMs;
  }
}

function autoResolvePendingJourneyEvents(state, journeyStats, atIso) {
  const pendingEvents = [...state.pendingEvents];
  if (!pendingEvents.length) return;

  state.pendingEvents = [];

  for (const eventEntry of pendingEvents) {
    if (!eventEntry.choices.length) continue;

    const randomChoice =
      eventEntry.choices[randomInt(0, eventEntry.choices.length - 1)];
    addJourneyLog(
      state,
      `You left ${eventEntry.title} unresolved for too long, so fate chose for you.`,
      atIso
    );
    applyJourneyChoiceEffects(state, randomChoice, journeyStats, atIso);

    if (eventEntry.kind === "aid") {
      state.aidUrgency = Math.max(0, state.aidUrgency - 2);
    }

    if (state.status !== "adventuring") {
      break;
    }
  }
}

function resolveJourneyBoss(state, journeyStats, atDate) {
  const boss = getJourneyBoss(state.bossIndex);
  const stretchChallenge = buildJourneyStretchChallenge(state, journeyStats);
  const success = Math.random() < stretchChallenge.successChance;

  if (success) {
    state.bossIndex += 1;
    state.currentHp = clamp(
      state.currentHp - randomInt(5, 12 + Math.floor(state.bossIndex / 2)),
      0,
      journeyStats.maxHp
    );
    state.currentHunger = clamp(
      state.currentHunger - randomInt(4, 10),
      0,
      journeyStats.maxHunger
    );
    state.storyXp += state.bossIndex === 1 ? 24 : 16;
    state.bonusSkillPoints += 1;
    state.aidUrgency = Math.max(0, state.aidUrgency - 1);

    const rewardText = applyJourneyVictoryRewards(
      state,
      journeyStats.level,
      atDate
    );

    if (boss.name === "Cornered Forest Boar") {
      state.storyFlags.boarDefeated = true;
      state.bonusRations += 1;
      addJourneyLog(
        state,
        `You survived the boar and cleared the stretch. Odds were ${stretchChallenge.successPercent}% and you still came out bloodied. Rewards: ${rewardText}.`,
        atDate.toISOString()
      );
      return;
    }

    addJourneyLog(
      state,
      `You cleared ${boss.name} with a ${stretchChallenge.successPercent}% success chance. The path opened into ${getJourneyZoneName(
        state.bossIndex
      )}. Rewards: ${rewardText}.`,
      atDate.toISOString()
    );
    return;
  }

  state.totalDistance = Math.max(
    state.bossIndex * JOURNEY_BOSS_DISTANCE + 34,
    state.totalDistance - randomInt(8, 18)
  );
  state.currentHp = clamp(
    state.currentHp - randomInt(14, 24),
    0,
    journeyStats.maxHp
  );
  state.currentHunger = clamp(
    state.currentHunger - randomInt(9, 16),
    0,
    journeyStats.maxHunger
  );
  state.storyXp += 4;
  addJourneyLog(
    state,
    `${boss.name} drove you back. The stretch only gave you about a ${stretchChallenge.successPercent}% shot and it went bad fast.`,
    atDate.toISOString()
  );
  sendJourneyToTown(
    state,
    atDate,
    `Recovering after ${boss.name}.`,
    5,
    9,
    journeyStats.level,
    journeyStats
  );
}

function applyJourneyVictoryRewards(state, journeyLevel, atDate) {
  const rewards = ["1 skill point"];

  if (!state.storyFlags.foundWeapon && Math.random() < 0.58) {
    const weaponOptions = [
      "Weathered short sword",
      "Hardened boar spear",
      "Traveler's hatchet",
      "Bandit-cut machete",
    ];
    const weaponName =
      weaponOptions[randomInt(0, weaponOptions.length - 1)];
    state.storyFlags.foundWeapon = true;
    state.weaponName = weaponName;
    rewards.push(weaponName);
  }

  const rationReward = Math.random() < 0.74 ? randomInt(1, 2) : 0;
  if (rationReward > 0) {
    state.bonusRations += rationReward;
    rewards.push(`${rationReward} ration${rationReward === 1 ? "" : "s"}`);
  }

  if (journeyLevel >= 2 && Math.random() < 0.48) {
    state.bonusTonics += 1;
    rewards.push("1 tonic");
  }

  addJourneyLog(
    state,
    `Victory spoils collected: ${rewards.join(", ")}.`,
    atDate.toISOString()
  );

  return rewards.join(", ");
}

function maybeApplyJourneyIncident(state, atDate, journeyStats, journeyContext) {
  const incidentRoll = Math.random();

  if (
    journeyContext?.neglectScore >= 5 &&
    !state.storyFlags.slimeSapped &&
    incidentRoll < 0.06
  ) {
    state.storyFlags.slimeSapped = true;
    state.statModifiers.vitality -= 1;
    state.currentHp = clamp(state.currentHp - 12, 0, journeyStats.maxHp);
    addJourneyLog(
      state,
      "You mistook a pale slime for something edible. It sapped the life out of you and left you permanently weaker.",
      atDate.toISOString()
    );
    return;
  }

  if (journeyContext?.neglectScore >= 3 && incidentRoll < 0.14) {
    state.currentHp = clamp(state.currentHp - 8, 0, journeyStats.maxHp);
    state.currentHunger = clamp(
      state.currentHunger - 4,
      0,
      journeyStats.maxHunger
    );
    addJourneyLog(
      state,
      "A goblin chased you through the brush. You escaped, but not cleanly.",
      atDate.toISOString()
    );
    return;
  }

  if (journeyContext?.momentumScore >= 3 && incidentRoll > 0.9) {
    state.bonusRations += 1;
    state.storyXp += 6;
    addJourneyLog(
      state,
      "A passing traveler shared dried meat and better directions after seeing the state you were in.",
      atDate.toISOString()
    );
  }
}

function maybeQueueJourneyEvent(state, atDate, journeyLevel, journeyContext) {
  const aidMode = state.aidUrgency > 0;

  if (state.pendingEvents.length >= JOURNEY_PENDING_EVENT_LIMIT) {
    return;
  }

  if (state.status !== "adventuring" && !aidMode) {
    return;
  }

  const phase = getJourneyPhase(state);
  const baseChance = aidMode
    ? 0.48
    : phase === "arrival"
      ? 0.12
      : phase === "survival"
        ? 0.09
        : 0.06;
  const pressureBonus = journeyContext?.neglectScore
    ? Math.min(0.05, journeyContext.neglectScore * 0.008)
    : 0;
  const eventChance = Math.min(
    aidMode ? 0.72 : 0.24,
    baseChance +
      Math.max(0, journeyLevel - 1) * 0.01 +
      pressureBonus +
      Math.min(0.18, state.aidUrgency * 0.08)
  );

  if (Math.random() > eventChance) return;

  let allCandidates = getJourneyEventCandidates(
    state,
    journeyLevel,
    atDate,
    journeyContext
  );
  if (state.status !== "adventuring") {
    allCandidates = allCandidates.filter((candidate) => candidate.kind === "aid");
  }
  if (!allCandidates.length) return;

  const pendingKeys = new Set(
    state.pendingEvents.map((entry) => entry.eventKey || entry.title)
  );
  const recentKeys = new Set(state.recentEventKeys || []);
  let candidates = allCandidates.filter(
    (candidate) => !pendingKeys.has(candidate.key) && !recentKeys.has(candidate.key)
  );

  if (!candidates.length) {
    const latestKey = state.recentEventKeys?.[0] || "";
    candidates = allCandidates.filter(
      (candidate) => !pendingKeys.has(candidate.key) && candidate.key !== latestKey
    );
  }

  if (!candidates.length) {
    candidates = allCandidates.filter((candidate) => !pendingKeys.has(candidate.key));
  }

  if (!candidates.length) return;

  const totalWeight = candidates.reduce(
    (total, candidate) => total + candidate.weight,
    0
  );
  let roll = Math.random() * totalWeight;
  let selected = candidates[0];

  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      selected = candidate;
      break;
    }
  }

  const nextEvent = normalizeJourneyEvent(
    {
      ...selected.build(),
      eventKey: selected.key,
      kind: selected.kind,
    },
    atDate.toISOString()
  );
  if (!nextEvent) return;

  rememberJourneyEventKey(state, selected.key);
  state.pendingEvents = [nextEvent, ...state.pendingEvents].slice(
    0,
    JOURNEY_PENDING_EVENT_LIMIT
  );
  addJourneyLog(
    state,
    `Something happened: ${nextEvent.title}.`,
    atDate.toISOString()
  );
}

function getJourneyEventCandidates(state, journeyLevel, atDate, journeyContext) {
  const eventTime = atDate.toISOString();
  const candidates = [];
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const pushCandidate = (key, weight, build, kind = "normal") => {
    candidates.push({ key, weight, build, kind });
  };

  if (
    state.aidUrgency > 0 ||
    state.currentHp <= journeyStats.maxHp * 0.38 ||
    state.currentHunger <= journeyStats.maxHunger * 0.34
  ) {
    pushCandidate(
      "aid:healer",
      7 + state.aidUrgency * 2,
      () => ({
        title: "A road healer finds you",
        teaser: "Someone finally notices how rough a state you are in.",
        detail:
          "A traveling healer reins in beside you, takes one long look, and decides you are too close to collapsing to be left alone.",
        createdAt: eventTime,
        choices: [
          {
            label: "Accept proper treatment",
            preview: "Lose time, but get patched up and restocked.",
            resultText:
              "The healer cleans your wounds, forces you to sit still, and presses supplies into your hands before letting you move on.",
            effects: {
              hp: 22,
              hunger: 8,
              bonusTonics: 1,
              bonusRations: 1,
              storyXp: 10,
            },
          },
          {
            label: "Take supplies and keep moving",
            preview: "Recover a little without stopping for long.",
            resultText:
              "You refuse the full stop, but the healer still hands over enough to keep you upright.",
            effects: {
              hp: 12,
              bonusTonics: 1,
              storyXp: 6,
            },
          },
        ],
      }),
      "aid"
    );

    pushCandidate(
      "aid:herbalist",
      6 + state.aidUrgency,
      () => ({
        title: "A traveling herbalist waves you over",
        teaser: "She has a sharp eye for exhaustion and a pack full of remedies.",
        detail:
          "An herbalist sorting roots by the roadside sees you limping and offers a fast trade: listen to her advice, and she will share what you need most.",
        createdAt: eventTime,
        choices: [
          {
            label: "Take the restorative brew",
            preview: "Best if your body is the problem.",
            resultText:
              "The brew tastes awful, but warmth starts pushing the pain back out of your limbs.",
            effects: {
              hp: 18,
              bonusTonics: 1,
              storyXp: 8,
            },
          },
          {
            label: "Take trail food and herbs",
            preview: "Best if you are running empty.",
            resultText:
              "She packs dried roots, bitter leaves, and enough food to get you through the next bad stretch.",
            effects: {
              hunger: 16,
              bonusRations: 2,
              storyXp: 8,
            },
          },
        ],
      }),
      "aid"
    );

    pushCandidate(
      "aid:spring",
      5 + state.aidUrgency,
      () => ({
        title: "A glowing spring in the underbrush",
        teaser: "The water shines faintly even in the shade.",
        detail:
          "You spot a spring giving off a pale glow, untouched by mud or rot. The air around it feels unnaturally calm.",
        createdAt: eventTime,
        choices: [
          {
            label: "Drink deeply",
            preview: "Recover quickly and trust the strange water.",
            resultText:
              "The water leaves your chest lighter, your hunger quieter, and your thoughts clearer.",
            effects: {
              hp: 16,
              hunger: 12,
              storyXp: 12,
            },
          },
          {
            label: "Bottle what you can",
            preview: "Take the blessing with you instead of spending it now.",
            resultText:
              "You fill what containers you can and move on with medicine worth more than coin.",
            effects: {
              bonusTonics: 1,
              bonusRations: 1,
              storyXp: 10,
            },
          },
        ],
      }),
      "aid"
    );

    pushCandidate(
      "aid:wagon",
      5 + state.aidUrgency,
      () => ({
        title: "A raided wagon left on the roadside",
        teaser: "The bandits are gone, but not everything useful went with them.",
        detail:
          "A supply wagon sits half-turned in the ditch, stripped in a hurry. Under torn canvas you find crates the raiders missed.",
        createdAt: eventTime,
        choices: [
          {
            label: "Grab food and move",
            preview: "Quick supplies without lingering.",
            resultText:
              "You haul off what trail food you can carry and leave before whoever did this comes back.",
            effects: {
              hunger: 10,
              bonusRations: 2,
              storyXp: 7,
            },
          },
          {
            label: "Search for proper medicine",
            preview: "Risk a longer stop for better recovery.",
            resultText:
              "Buried under broken boards you find bandages, a tonic, and just enough luck to matter.",
            effects: {
              hp: 10,
              bonusTonics: 1,
              bonusRations: 1,
              storyXp: 9,
            },
          },
        ],
      }),
      "aid"
    );
  }

  if (!state.storyFlags.foundWeapon) {
    pushCandidate("survival:weapon-cart", 4, () => ({
          title: "A broken cart in the brush",
          teaser: "There may be scraps worth risking a closer look for.",
          detail:
            "Roots have half-swallowed an overturned cart. A cracked spear shaft, a rusted belt knife, and a few ruined travel goods are still tangled in the frame.",
          createdAt: eventTime,
          choices: [
            {
              label: "Free the belt knife",
              preview: "Take the cut if it means finally having a real blade.",
              resultText:
                "You cut your palm freeing the knife, but it is still the first thing you own here that feels like a weapon.",
              effects: {
                hp: -4,
                distance: 4,
                storyXp: 14,
                weaponName: "Rust-worn belt knife",
                flags: { foundWeapon: true },
              },
            },
            {
              label: "Break the shaft into a club",
              preview: "Crude, but less likely to fail in your hands.",
              resultText:
                "The wood is ugly but solid enough. You also find a few dry scraps worth keeping.",
              effects: {
                distance: 3,
                storyXp: 10,
                bonusRations: 1,
                weaponName: "Crude spear-club",
                flags: { foundWeapon: true },
              },
            },
            {
              label: "Leave it and keep moving",
              preview: "Choose speed over another dangerous delay.",
              resultText:
                "You walk away hungry and nervous, hoping the next chance is kinder.",
              effects: {
                hunger: -6,
                distance: 8,
                storyXp: -4,
              },
            },
          ],
        })
    );
  }

  if (state.bossIndex === 0) {
    pushCandidate("arrival:berries", 3, () => ({
          title: "A patch of unfamiliar berries",
          teaser: "It could be food. It could also be a mistake.",
          detail:
            "You find dark berries growing where the light breaks through the trees. Some are pecked at by birds. Some are untouched.",
          createdAt: eventTime,
          choices: [
            {
              label: "Test them carefully",
              preview: "Slow, cautious, and probably the least stupid option.",
              resultText:
                "You wait, watch, and only keep the ones that seem safe. It is not much, but it helps.",
              effects: {
                hunger: 10,
                storyXp: 10,
              },
            },
            {
              label: "Eat quickly and hope",
              preview: "Hunger is louder than caution right now.",
              resultText:
                "Some were fine. Some definitely were not. You gain something, but not cleanly.",
              effects: {
                hunger: 14,
                hp: -6,
                storyXp: 6,
              },
            },
            {
              label: "Ignore them",
              preview: "You do not know enough to gamble with poison.",
              resultText:
                "You move on empty-stomached but alive, which still counts for something.",
              effects: {
                hunger: -4,
                distance: 6,
                storyXp: 4,
              },
            },
          ],
        })
    );

    pushCandidate("arrival:tracks", 3, () => ({
          title: "Heavy tracks near the creek",
          teaser: "Something big has been moving through this area.",
          detail:
            "Fresh prints cut into the mud beside the water. They are too wide to ignore and too recent to feel safe.",
          createdAt: eventTime,
          choices: [
            {
              label: "Follow the tracks",
              preview: "If you understand the threat, you might survive it.",
              resultText:
                "You learn how the animal moves and where it feeds, even if the whole exercise makes your nerves worse.",
              effects: {
                hp: -3,
                distance: 5,
                storyXp: 13,
              },
            },
            {
              label: "Circle away quietly",
              preview: "Live first. Hunt confidence later.",
              resultText:
                "You lose time staying cautious, but avoiding a bad surprise feels smart.",
              effects: {
                hunger: -5,
                storyXp: 8,
              },
            },
            {
              label: "Run for open ground",
              preview: "Panic has an argument, and right now it is convincing.",
              resultText:
                "You make distance fast and burn through what little energy you had.",
              effects: {
                distance: 10,
                hunger: -8,
                storyXp: -3,
              },
            },
          ],
        })
    );
  }

  if (getJourneyPhase(state) !== "frontier") {
    pushCandidate("weather:cold-rain", 2, () => ({
          title: "Cold rain before dusk",
          teaser: "You need to decide whether to stop or suffer through it.",
          detail:
            "The weather turns without warning. The air is suddenly bitter and the path is starting to vanish under rain and leaf litter.",
          createdAt: eventTime,
          choices: [
            {
              label: "Build rough shelter",
              preview: "Lose time now to avoid a worse night.",
              resultText:
                "It is miserable, but you stay warmer than you would have on the move.",
              effects: {
                distance: -4,
                hp: 5,
                storyXp: 9,
              },
            },
            {
              label: "Push on through it",
              preview: "You need distance more than comfort.",
              resultText:
                "You gain ground, but by the end your clothes are soaked and every muscle hates you.",
              effects: {
                distance: 9,
                hp: -7,
                hunger: -5,
                storyXp: 7,
              },
            },
            {
              label: "Collect rainwater and wait it out",
              preview: "Slow progress, but at least you solve one problem.",
              resultText:
                "You lose momentum, but the clean water helps and the pause clears your head.",
              effects: {
                hunger: 7,
                storyXp: 8,
              },
            },
          ],
        })
    );
  }

  if (journeyLevel >= 3 && state.storyFlags.boarDefeated && !hasJourneyClassUnlocked(state, "warrior")) {
    pushCandidate("class:warrior-guard", 4, () => ({
          title: "A guard by a roadside fire",
          teaser: "He notices how you hold yourself and offers a little training.",
          detail:
            "A tired local guard is warming his hands beside a watchfire. After hearing about the boar, he laughs once and says you still grip your weapon like someone who expects it to apologize.",
          createdAt: eventTime,
          choices: [
            {
              label: "Train with him",
              preview: "Accept the bruises if it means learning how to stand your ground.",
              resultText:
                "The lesson is blunt, practical, and painful. It works.",
              effects: {
                hp: -4,
                storyXp: 20,
                unlockClass: "warrior",
              },
            },
            {
              label: "Trade stories and rest",
              preview: "Take the company and keep moving afterward.",
              resultText:
                "You do not learn the stance, but the meal and advice still matter.",
              effects: {
                bonusRations: 1,
                storyXp: 8,
              },
            },
          ],
        })
    );
  }

  if (journeyLevel >= 4 && state.storyFlags.boarDefeated && !hasJourneyClassUnlocked(state, "mage")) {
    pushCandidate("class:mage-shrine", 3, () => ({
          title: "A whispering shrine",
          teaser: "The stones hum when you get close.",
          detail:
            "Half-buried stones surround a shallow spring. When you reach toward the water, the air tightens around your hand as if the world is paying attention.",
          createdAt: eventTime,
          choices: [
            {
              label: "Touch the spring and listen",
              preview: "Risk the unknown and try to understand it.",
              resultText:
                "The sensation is strange but not hostile. You leave with the first real feel for magic this world has offered you.",
              effects: {
                hunger: -3,
                storyXp: 22,
                bonusTonics: 1,
                unlockClass: "mage",
              },
            },
            {
              label: "Take the blessing and leave",
              preview: "Respect it, but do not linger where you do not belong.",
              resultText:
                "You keep your distance and leave with a steadier pulse and a little luck.",
              effects: {
                hp: 8,
                storyXp: 10,
              },
            },
          ],
        })
    );
  }

  if (journeyLevel >= 3 && state.storyFlags.foundWeapon && !hasJourneyClassUnlocked(state, "thief")) {
    pushCandidate("class:thief-forager", 4, () => ({
          title: "A quiet forager on the trail",
          teaser: "You did not hear her arrive, which is probably the lesson.",
          detail:
            "A local forager steps out from behind a fallen tree with a basket of roots and herbs. She looks amused that you never noticed her approach.",
          createdAt: eventTime,
          choices: [
            {
              label: "Ask how she moves so quietly",
              preview: "Learn the value of silence and observation.",
              resultText:
                "She shows you what to listen for, what not to step on, and how much noise panic makes.",
              effects: {
                storyXp: 18,
                unlockClass: "thief",
              },
            },
            {
              label: "Trade for directions",
              preview: "A safer path is enough for today.",
              resultText:
                "The lesson is shorter, but the route she points out saves you hours.",
              effects: {
                distance: 12,
                storyXp: 8,
              },
            },
          ],
        })
    );
  }

  return candidates;
}

function maybeAddAmbientJourneyLog(state, atDate) {
  if (Math.random() > 0.18) return;

  const phase = getJourneyPhase(state);
  const pool = JOURNEY_AMBIENT_INTERACTIONS[phase] || JOURNEY_AMBIENT_INTERACTIONS.frontier;
  if (!pool?.length) return;

  addJourneyLog(state, pool[randomInt(0, pool.length - 1)], atDate.toISOString());
}

function applyJourneyChoiceEffects(state, choice, journeyStats, atIso) {
  const { effects } = choice;

  state.currentHp = clamp(
    state.currentHp + effects.hp,
    0,
    journeyStats.maxHp
  );
  state.currentHunger = clamp(
    state.currentHunger + effects.hunger,
    0,
    journeyStats.maxHunger
  );
  state.totalDistance = Math.max(0, state.totalDistance + effects.distance);
  state.storyXp = Math.max(0, state.storyXp + effects.storyXp);
  state.bonusSkillPoints = Math.max(
    0,
    state.bonusSkillPoints + effects.bonusSkillPoints
  );
  state.bonusRations = Math.max(0, state.bonusRations + effects.bonusRations);
  state.bonusTonics = Math.max(0, state.bonusTonics + effects.bonusTonics);
  if (effects.weaponName) {
    state.weaponName = effects.weaponName;
  }

  for (const flagKey of JOURNEY_FLAG_KEYS) {
    if (effects.flags?.[flagKey] !== undefined) {
      state.storyFlags[flagKey] = Boolean(effects.flags[flagKey]);
    }
  }

  let unlockedText = "";
  if (effects.unlockClass) {
    unlockedText = unlockJourneyClass(state, effects.unlockClass, atIso);
  }

  addJourneyLog(state, choice.resultText, atIso);

  if (
    state.currentHp <= journeyStats.maxHp * 0.12 ||
    state.currentHunger <= journeyStats.maxHunger * 0.08
  ) {
    sendJourneyToTown(
      state,
      new Date(atIso),
      "The aftermath forced you to stop and recover before you could go any farther.",
      3,
      6,
      journeyStats.level,
      journeyStats
    );
  }

  return unlockedText ? `${choice.resultText} ${unlockedText}` : choice.resultText;
}

function unlockJourneyClass(state, classKey, atIso) {
  if (!JOURNEY_CLASS_META[classKey] || hasJourneyClassUnlocked(state, classKey)) {
    return "";
  }

  state.unlockedClasses = [...state.unlockedClasses, classKey];
  state.classType = classKey;
  addJourneyLog(
    state,
    `${JOURNEY_CLASS_META[classKey].label} unlocked.`,
    atIso
  );
  return `${JOURNEY_CLASS_META[classKey].label} unlocked and equipped.`;
}

function hasJourneyClassUnlocked(state, classKey) {
  return state.unlockedClasses.includes(classKey);
}

function buildJourneyClassSelectionUi(state) {
  const unlockedClasses = state.unlockedClasses.filter(
    (classKey) => JOURNEY_CLASS_META[classKey]
  );
  const advancedUnlocked = unlockedClasses.filter(
    (classKey) => classKey !== JOURNEY_BASE_CLASS
  );

  return advancedUnlocked.length
    ? `
        <div class="journey-class-list">
          ${unlockedClasses
            .map((classKey) => {
              const meta = JOURNEY_CLASS_META[classKey];
              return `
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
              `;
            })
            .join("")}
        </div>
        <p class="muted-text">Other paths are still hidden. They reveal themselves through the road, not the menu.</p>
      `
    : `<p class="muted-text">No discipline has awakened yet. You are still learning the rules of this world the hard way.</p>`;
}

function getJourneyDisplayName(state) {
  return state.characterName || "Nameless Wanderer";
}

function getJourneyInventoryItems(state, supplies) {
  const items = [`Starter keepsake: ${state.starterItem}`];

  if (state.weaponName) {
    items.push(`Weapon: ${state.weaponName}`);
  }

  if (state.storyFlags.boarDefeated) {
    items.push("Boar trophy");
  }

  if (supplies.availableRations > 0) {
    items.push(`${supplies.availableRations} ration${supplies.availableRations === 1 ? "" : "s"}`);
  }

  if (supplies.availableTonics > 0) {
    items.push(`${supplies.availableTonics} tonic${supplies.availableTonics === 1 ? "" : "s"}`);
  }

  return items;
}

function getJourneyKnownNotes(state) {
  const notes = [];

  if (state.storyFlags.foundWeapon) {
    notes.push("You are no longer completely unarmed.");
  }

  if (state.storyFlags.boarDefeated) {
    notes.push("You survived your first brutal hunt in the woods.");
  }

  if (state.storyFlags.slimeSapped) {
    notes.push("A bad slime meal left your body permanently worse for wear.");
  }

  if (state.unlockedClasses.length > 1) {
    notes.push(
      `A discipline awakened: ${JOURNEY_CLASS_META[state.classType].label}.`
    );
  }

  return notes;
}

function sendJourneyToTown(
  state,
  atDate,
  message,
  minHours,
  maxHours,
  journeyLevel,
  journeyStats
) {
  const currentJourneyLevel =
    journeyLevel || getJourneyLevel(state, state.highestTrackerLevel || 1);
  const currentJourneyStats =
    journeyStats || buildJourneyDerived(state, currentJourneyLevel);

  state.status = "recovering";
  state.townVisits += 1;
  state.aidUrgency = Math.min(4, state.aidUrgency + 2);
  state.restUntil = new Date(
    atDate.getTime() + randomInt(minHours, maxHours) * 60 * 60 * 1000
  ).toISOString();
  state.currentHp = Math.max(state.currentHp, 16);
  state.currentHunger = Math.max(state.currentHunger, 12);
  state.recoveryObjective = buildJourneyRecoveryObjective(
    state,
    currentJourneyLevel,
    currentJourneyStats
  );
  addJourneyLog(state, message, atDate.toISOString());
}

function addJourneyLog(state, text, at) {
  const safeText = String(text || "").trim();
  if (!safeText) return;

  state.log = [{ text: safeText, at }, ...(Array.isArray(state.log) ? state.log : [])]
    .slice(0, JOURNEY_LOG_LIMIT);
}

function getJourneyLevel(state, currentTrackerLevel) {
  return (
    Math.max(1, state.highestTrackerLevel || 1, currentTrackerLevel || 1) +
    getJourneyStoryLevelBonus(state.storyXp)
  );
}

function getJourneyStoryLevelBonus(storyXp) {
  return Math.floor(Math.max(0, Number(storyXp) || 0) / JOURNEY_STORY_XP_PER_LEVEL);
}

function getUnspentSkillPoints(state, journeyLevel) {
  const spentPoints = JOURNEY_STAT_KEYS.reduce(
    (total, key) => total + (state.allocatedStats[key] || 0),
    0
  );
  return Math.max(
    0,
    journeyLevel - 1 + (state.bonusSkillPoints || 0) - spentPoints
  );
}

function getJourneyBoss(index) {
  const cycle = Math.floor(index / JOURNEY_BOSS_NAMES.length);
  const baseName = JOURNEY_BOSS_NAMES[index % JOURNEY_BOSS_NAMES.length];

  return {
    name: cycle ? `${baseName} ${romanize(cycle + 1)}` : baseName,
    power: 36 + index * 15 + Math.floor(index / 2) * 6,
  };
}

function getJourneyZoneName(bossIndex) {
  return JOURNEY_ZONE_NAMES[bossIndex % JOURNEY_ZONE_NAMES.length];
}

function getJourneySegmentProgress(totalDistance, bossIndex) {
  const segmentStart = bossIndex * JOURNEY_BOSS_DISTANCE;
  const nextBossDistance = (bossIndex + 1) * JOURNEY_BOSS_DISTANCE;
  const distanceIntoSegment = clamp(
    totalDistance - segmentStart,
    0,
    JOURNEY_BOSS_DISTANCE
  );
  const remainingDistance = Math.max(0, nextBossDistance - totalDistance);
  const percent = clamp(
    (distanceIntoSegment / JOURNEY_BOSS_DISTANCE) * 100,
    0,
    100
  );

  return {
    percent,
    remainingDistance,
    currentLabel: `${Math.floor(distanceIntoSegment)} / ${JOURNEY_BOSS_DISTANCE} through this stretch`,
    remainingLabel: `${Math.ceil(remainingDistance)} until the next major threat`,
  };
}

function getJourneyActivityText(state, boss, progress, journeyStats) {
  if (state.status === "recovering") {
    return state.recoveryObjective || getRecoveryText(state);
  }

  if (state.bossIndex === 0) {
    if (progress.percent < 18) {
      return "You are still getting your bearings after arriving in another world weak, confused, and badly underprepared.";
    }

    if (progress.percent < 38) {
      return "You are lost in the forest and trying to keep panic from wasting what little strength you have.";
    }

    if (!state.storyFlags.foundWeapon || progress.percent < 56) {
      return "You are searching for anything that can pass as a weapon before the forest decides you look edible.";
    }

    if (progress.percent < 78) {
      return "You are searching for food, learning what hurts, and figuring out how to keep moving while hungry.";
    }

    return "You have seen the boar's tracks often enough that the first real fight now feels unavoidable.";
  }

  if (state.bossIndex === 1) {
    return `You are keeping to ${getJourneyZoneName(
      state.bossIndex
    )}, watching for wolves and trying to travel like someone who belongs here.`;
  }

  return `You are moving through ${getJourneyZoneName(
    state.bossIndex
  )} toward ${boss.name}. About ${formatDurationHours(
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour)
  )} away if nothing goes wrong.`;
}

function getRecoveryText(state) {
  const missionText = state.recoveryObjective
    ? `Mini mission: ${state.recoveryObjective} `
    : "";

  if (!state.restUntil) {
    return `${missionText}Recovering in shelter before risking the road again.`.trim();
  }

  const remainingMs = Math.max(0, new Date(state.restUntil).getTime() - Date.now());
  return `${missionText}Licking your wounds for ${formatDurationMs(
    remainingMs
  )} before heading back out.`.trim();
}

function getJourneyStatusLabel(status) {
  return status === "recovering" ? "Resting" : "Traveling";
}

function getJourneyPhase(state) {
  if (state.bossIndex === 0 && state.totalDistance < 42) return "arrival";
  if (state.bossIndex <= 1) return "survival";
  return "frontier";
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatSignedNumber(value) {
  const numericValue = Math.round(Number(value) || 0);
  return `${numericValue >= 0 ? "+" : ""}${numericValue}`;
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

function differenceInDays(leftMs, rightMs) {
  return Math.floor(Math.max(0, leftMs - rightMs) / (1000 * 60 * 60 * 24));
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
