import { normalizeGameRecord, normalizeSessionRecord } from "../../data/db.js";
import { getAllGames } from "../../data/gamesRepo.js";
import { getMeta, setMeta } from "../../data/metaRepo.js";
import { getAllSessions } from "../../data/sessionsRepo.js";
import { journeyMessageEl } from "../../core/dom.js";
import {
  IDLE_JOURNEY_META_KEY,
  JOURNEY_CLASS_META,
  JOURNEY_PENDING_EVENT_LIMIT,
  JOURNEY_STAT_KEYS,
  JOURNEY_STAT_META,
} from "../../core/constants.js";
import { buildXpSummary, clamp, enforceMainGameRules, getErrorMessage, randomInt } from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { showMessage } from "../../core/ui.js";
import { applyScreenHash, isMobileViewport, scrollScreenIntoView, setActiveScreen } from "../navigation/navigation.js";
import {
  addJourneyLog,
  applyJourneyChoiceEffects,
  buildJourneyContext,
  buildJourneyDerived,
  buildJourneyOutcomeItems,
  buildJourneySupplies,
  getJourneyEventCandidates,
  getJourneyLevel,
  getUnspentSkillPoints,
  hasJourneyClassUnlocked,
  normalizeJourneyState,
  pushJourneyDebugSnapshot,
  syncJourneyState,
} from "./journeyEngine.js";
import { closeJourneyEventModal, closeJourneyOutcomeModal, openJourneyEventModal, openJourneyOutcomeModal } from "./journeyView.js";

export async function handleHomeJourneyClick(event) {
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
      getAllGames(appState.db),
      getAllSessions(appState.db),
      getMeta(appState.db, IDLE_JOURNEY_META_KEY),
    ]);

    const games = enforceMainGameRules(
      gamesRaw.map((game) => normalizeGameRecord(game))
    );
    const sessions = sessionsRaw.map((session) => normalizeSessionRecord(session));
    const xpSummary = buildXpSummary(games, sessions);
    const state = await syncJourneyState(idleRaw, games, sessions, xpSummary);
    await appState.renderApp();

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

export async function handleJourneyClick(event) {
  const button = event.target.closest("button[data-journey-action]");
  if (!button) return;

  try {
    const [gamesRaw, sessionsRaw, idleRaw] = await Promise.all([
      getAllGames(appState.db),
      getAllSessions(appState.db),
      getMeta(appState.db, IDLE_JOURNEY_META_KEY),
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
        await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        state.characterName
          ? `Character name set to ${state.characterName}.`
          : "Character name cleared."
      );
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        `${JOURNEY_CLASS_META[classType].label} equipped.`
      );
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(
        journeyMessageEl,
        `${JOURNEY_STAT_META[statKey].label} increased.`
      );
      await appState.renderApp();
      return;
    }

    if (action === "debug-advance") {
      const hours = Math.max(1, Number(button.dataset.hours) || 1);
      pushJourneyDebugSnapshot(state);
      state.lastUpdatedAt = new Date(
        Date.now() - hours * 60 * 60 * 1000
      ).toISOString();
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, `Advanced journey time by ${hours}h.`);
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, restoredState);
      showMessage(journeyMessageEl, "Restored the previous debug snapshot.");
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, `Forced event: ${forcedEvent.title}.`);
      await appState.renderApp();
      openJourneyEventModal(forcedEvent);
      return;
    }

    if (action === "reset-journey") {
      const confirmed = window.confirm(
        "Reset only the idle journey and keep your games and session history?"
      );

      if (!confirmed) return;

      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, null);
      showMessage(journeyMessageEl, "Idle journey reset. Tracker history kept.");
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, "Used 1 ration to restore hunger.");
      await appState.renderApp();
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
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showMessage(journeyMessageEl, "Used 1 tonic to restore health.");
      await appState.renderApp();
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

export async function handleJourneyEventModalClick(event) {
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

export function handleJourneyOutcomeModalClick(event) {
  if (
    event.target instanceof HTMLElement &&
    event.target.dataset.closeJourneyOutcome !== undefined
  ) {
    closeJourneyOutcomeModal();
  }
}

export async function resolveJourneyEventChoice(eventId, choiceId) {
  try {
    const [gamesRaw, sessionsRaw, idleRaw] = await Promise.all([
      getAllGames(appState.db),
      getAllSessions(appState.db),
      getMeta(appState.db, IDLE_JOURNEY_META_KEY),
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
      await appState.renderApp();
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

    await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
    closeJourneyEventModal();
    openJourneyOutcomeModal(eventEntry, choice, resultMessage, outcomeItems);
    showMessage(journeyMessageEl, resultMessage);
    await appState.renderApp();
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
