import { DEFAULT_SCREEN_ID } from "./constants.js";

export const appState = {
  db: null,
  pendingArtTarget: null,
  cropSession: null,
  activeScreenId: DEFAULT_SCREEN_ID,
  editingCharacterName: false,
  isJourneyEventResolving: false,
  renderApp: async () => {},
};
