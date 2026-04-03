export const gameForm = document.querySelector("#gameForm");
export const titleInput = document.querySelector("#title");
export const platformInput = document.querySelector("#platform");
export const gameStatusInput = document.querySelector("#gameStatus");
export const gameDifficultyInputs = Array.from(
  document.querySelectorAll('input[name="gameDifficulty"]')
);
export const notesInput = document.querySelector("#notes");
export const coverImageInput = document.querySelector("#coverImage");
export const bannerImageInput = document.querySelector("#bannerImage");
export const formMessage = document.querySelector("#formMessage");
export const difficultyRewardPreview = document.querySelector("#difficultyRewardPreview");

export const sessionForm = document.querySelector("#sessionForm");
export const sessionGameSelect = document.querySelector("#sessionGame");
export const sessionMinutesInput = document.querySelector("#sessionMinutes");
export const sessionNoteInput = document.querySelector("#sessionNote");
export const sessionObjectiveInput = document.querySelector("#sessionObjective");
export const meaningfulProgressInput = document.querySelector("#meaningfulProgress");
export const sessionMessage = document.querySelector("#sessionMessage");

export const totalGamesEl = document.querySelector("#totalGames");
export const inProgressCountEl = document.querySelector("#inProgressCount");
export const completedCountEl = document.querySelector("#completedCount");
export const mainGameNameEl = document.querySelector("#mainGameName");
export const totalSessionsEl = document.querySelector("#totalSessions");
export const currentStreakEl = document.querySelector("#currentStreak");

export const playerRankEl = document.querySelector("#playerRank");
export const playerLevelEl = document.querySelector("#playerLevel");
export const totalXpEl = document.querySelector("#totalXp");
export const todayXpEl = document.querySelector("#todayXp");
export const xpToNextLevelEl = document.querySelector("#xpToNextLevel");
export const xpProgressTextEl = document.querySelector("#xpProgressText");
export const xpProgressFillEl = document.querySelector("#xpProgressFill");

export const completionSpotlightEl = document.querySelector("#completionSpotlight");
export const mainQuestPanelEl = document.querySelector("#mainQuestPanel");
export const homeOverviewEl = document.querySelector("#homeOverviewPanel");
export const listSummaryEl = document.querySelector("#listSummary");
export const gamesListEl = document.querySelector("#gamesList");
export const recentSessionsSummaryEl = document.querySelector(
  "#recentSessionsSummary"
);
export const recentSessionsListEl = document.querySelector("#recentSessionsList");
export const sessionsTabButtons = Array.from(
  document.querySelectorAll("[data-sessions-tab]")
);
export const sessionsPanels = Array.from(
  document.querySelectorAll("[data-sessions-panel]")
);
export const journeyContentEl = document.querySelector("#journeyContent");
export const journeyMessageEl = document.querySelector("#journeyMessage");
export const homeJourneyContentEl = document.querySelector("#homeJourneyContent");
export const characterContentEl = document.querySelector("#characterContent");

export const coverArtPickerInput = document.querySelector("#coverArtPicker");
export const bannerArtPickerInput = document.querySelector("#bannerArtPicker");

export const exportDataButton = document.querySelector("#exportDataButton");
export const importDataButton = document.querySelector("#importDataButton");
export const clearJourneyButton = document.querySelector("#clearJourneyButton");
export const clearDataButton = document.querySelector("#clearDataButton");
export const importDataInput = document.querySelector("#importDataInput");
export const settingsMessage = document.querySelector("#settingsMessage");
export const themePreferenceInput = document.querySelector("#themePreference");
export const languagePreferenceInput = document.querySelector("#languagePreference");
export const focusedGoalsPreferenceInput = document.querySelector(
  "#focusedGoalsPreference"
);
export const replayOnboardingButton = document.querySelector("#replayOnboardingButton");
export const openSettingsButton = document.querySelector("#openSettingsButton");
export const settingsModal = document.querySelector("#settingsModal");
export const settingsModalCloseButton = document.querySelector(
  "#settingsModalCloseButton"
);
export const mobileQuickSwitchEl = document.querySelector(".mobile-quick-switch");

export const artCropModal = document.querySelector("#artCropModal");
export const cropPreviewCanvas = document.querySelector("#cropPreviewCanvas");
export const cropModalTitle = document.querySelector("#cropModalTitle");
export const cropGuidance = document.querySelector("#cropGuidance");
export const cropPresetPill = document.querySelector("#cropPresetPill");
export const cropZoomValue = document.querySelector("#cropZoomValue");
export const cropZoomRange = document.querySelector("#cropZoomRange");
export const cropFocusXRange = document.querySelector("#cropFocusXRange");
export const cropFocusYRange = document.querySelector("#cropFocusYRange");
export const cropResetButton = document.querySelector("#cropResetButton");
export const cropCancelButton = document.querySelector("#cropCancelButton");
export const cropConfirmButton = document.querySelector("#cropConfirmButton");
export const journeyEventModal = document.querySelector("#journeyEventModal");
export const journeyEventTitleEl = document.querySelector("#journeyEventTitle");
export const journeyEventMetaEl = document.querySelector("#journeyEventMeta");
export const journeyEventBodyEl = document.querySelector("#journeyEventBody");
export const journeyEventCloseButton = document.querySelector("#journeyEventCloseButton");
export const journeyOutcomeModal = document.querySelector("#journeyOutcomeModal");
export const journeyOutcomeTitleEl = document.querySelector("#journeyOutcomeTitle");
export const journeyOutcomeMetaEl = document.querySelector("#journeyOutcomeMeta");
export const journeyOutcomeBodyEl = document.querySelector("#journeyOutcomeBody");
export const journeyOutcomeCloseButton = document.querySelector(
  "#journeyOutcomeCloseButton"
);
export const journeyHistoryModal = document.querySelector("#journeyHistoryModal");
export const journeyHistoryEyebrowEl = document.querySelector("#journeyHistoryEyebrow");
export const journeyHistoryTitleEl = document.querySelector("#journeyHistoryTitle");
export const journeyHistoryMetaEl = document.querySelector("#journeyHistoryMeta");
export const journeyHistoryBodyEl = document.querySelector("#journeyHistoryBody");
export const journeyHistoryCloseButton = document.querySelector(
  "#journeyHistoryCloseButton"
);
export const journeyEventDockRoot = document.querySelector("#journeyEventDock");
export const characterSkillModalRoot = document.querySelector(
  "#characterSkillModalRoot"
);
export const onboardingOverlay = document.querySelector("#onboardingOverlay");
export const onboardingBackdrop = document.querySelector("#onboardingBackdrop");
export const onboardingScrimTop = document.querySelector("#onboardingScrimTop");
export const onboardingScrimLeft = document.querySelector("#onboardingScrimLeft");
export const onboardingScrimRight = document.querySelector("#onboardingScrimRight");
export const onboardingScrimBottom = document.querySelector("#onboardingScrimBottom");
export const onboardingSpotlightFrame = document.querySelector("#onboardingSpotlightFrame");
export const onboardingCardRoot = document.querySelector("#onboardingCardRoot");
export const gameActionsModal = document.querySelector("#gameActionsModal");
export const gameActionsTitleEl = document.querySelector("#gameActionsTitle");
export const gameActionsMetaEl = document.querySelector("#gameActionsMeta");
export const gameActionsBodyEl = document.querySelector("#gameActionsBody");
export const gameActionsCloseButton = document.querySelector(
  "#gameActionsCloseButton"
);
export const toastViewport = document.querySelector("#toastViewport");
export const appScreens = Array.from(document.querySelectorAll("[data-screen]"));
export const screenNavButtons = Array.from(
  document.querySelectorAll("[data-screen-target]")
);
