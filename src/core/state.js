import {
  DEFAULT_FOCUSED_GOALS_ENABLED,
  DEFAULT_SCREEN_ID,
  DEFAULT_SESSIONS_TAB,
} from "./constants.js";

export const appState = {
  db: null,
  pendingArtTarget: null,
  cropSession: null,
  activeScreenId: DEFAULT_SCREEN_ID,
  activeSessionsTab: DEFAULT_SESSIONS_TAB,
  homeLibraryStatusFilter: "all",
  latestIdleJourney: null,
  editingCharacterName: false,
  showCharacterSkillModal: false,
  characterSkillModalScrollTop: 0,
  isJourneyEventResolving: false,
  journeyEventDockExpanded: false,
  journeyEventDockEventId: "",
  journeyEventDockDismissedIds: [],
  themePreference: "system",
  locale: "en",
  focusedGoalsEnabled: DEFAULT_FOCUSED_GOALS_ENABLED,
  onboarding: {
    active: false,
    lockBodyScroll: false,
    stepId: "",
    mode: "idle",
  },
  renderApp: async () => {},
};
