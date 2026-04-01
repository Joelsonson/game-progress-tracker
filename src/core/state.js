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
  editingCharacterName: false,
  showCharacterSkillModal: false,
  isJourneyEventResolving: false,
  themePreference: "system",
  locale: "en",
  focusedGoalsEnabled: DEFAULT_FOCUSED_GOALS_ENABLED,
  renderApp: async () => {},
};
