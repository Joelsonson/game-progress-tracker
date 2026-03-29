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
import { showMessage, showToast } from "../../core/ui.js";
import { applyScreenHash, setActiveScreen } from "../navigation/navigation.js";
import {
  addJourneyLog,
  applyJourneyChoiceEffects,
  buildJourneyContext,
  buildJourneyDerived,
  buildJourneyOutcomeItems,
  buildJourneySupplies,
  discardJourneyPendingWeapon,
  dropJourneyWeapon,
  equipJourneyWeapon,
  getJourneyEventCandidates,
  getJourneyLevel,
  getJourneyWeaponMeta,
  getUnspentSkillPoints,
  hasJourneyClassUnlocked,
  keepJourneyPendingWeapon,
  normalizeJourneyState,
  pushJourneyDebugSnapshot,
  rememberJourneyCompletedEventKey,
  replaceJourneyWeapon,
  syncJourneyState,
} from "./journeyEngine.js";
import { normalizeJourneyEvent } from "./journeyEvents.js";
import {
  closeJourneyEventModal,
  closeJourneyOutcomeModal,
  openJourneyEventModal,
  openJourneyOutcomeModal,
  showJourneyEventThinking,
} from "./journeyView.js";

function showJourneyFeedback(message, isError = false) {
  showMessage(journeyMessageEl, message, isError);
}

export async function handleHomeJourneyClick(event) {
  const button = event.target.closest("button[data-home-action]");
  if (!button) return;

  const action = button.dataset.homeAction;

  if (action === "open-journey" || action === "open-event") {
    setActiveScreen("journey", {
      store: true,
      scrollToTop: true,
    });
    applyScreenHash("journey");
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

    showJourneyFeedback("That event is no longer waiting.", true);
  } catch (error) {
    console.error("Failed to open journey event:", error);
    showJourneyFeedback(
      getErrorMessage(error, "Could not open that journey event."),
      true
    );
  }
}

export async function handleJourneyClick(event) {
  const button = event.target.closest("button[data-journey-action]");
  if (!button) return;

  const action = button.dataset.journeyAction;

  if (action === "close-skill-modal") {
    appState.showCharacterSkillModal = false;
    await appState.renderApp();
    return;
  }

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

    if (action === "open-event") {
      const eventId = button.dataset.eventId;
      const pendingEvent = state.pendingEvents.find((entry) => entry.id === eventId);

      if (!pendingEvent) {
        showJourneyFeedback("That event is no longer waiting.", true);
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
      appState.editingCharacterName = !state.characterName;
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(
        state.characterName
          ? `Character name set to ${state.characterName}.`
          : "Character name cleared."
      );
      await appState.renderApp();
      return;
    }

    if (action === "toggle-name-editor") {
      appState.editingCharacterName = !appState.editingCharacterName;
      await appState.renderApp();
      return;
    }

    if (action === "open-skill-modal") {
      const unspent = getUnspentSkillPoints(state, journeyLevel);
      if (unspent <= 0) {
        showJourneyFeedback("No skill points available right now.", true);
        return;
      }

      appState.showCharacterSkillModal = true;
      await appState.renderApp();
      return;
    }

    if (action === "set-class") {
      const classType = button.dataset.class;
      if (!JOURNEY_CLASS_META[classType] || !hasJourneyClassUnlocked(state, classType)) {
        showJourneyFeedback("That discipline has not been unlocked yet.", true);
        return;
      }

      state.classType = classType;
      addJourneyLog(
        state,
        `You settled into the ${JOURNEY_CLASS_META[classType].label} discipline.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`${JOURNEY_CLASS_META[classType].label} equipped.`);
      await appState.renderApp();
      showToast(`Class changed to ${JOURNEY_CLASS_META[classType].label}.`, {
        title: "Class updated",
        tone: "info",
      });
      return;
    }

    if (action === "spend-stat") {
      const statKey = button.dataset.stat;
      if (!JOURNEY_STAT_KEYS.includes(statKey)) {
        showJourneyFeedback("That stat cannot be increased.", true);
        return;
      }

      const unspent = getUnspentSkillPoints(state, journeyLevel);
      if (unspent <= 0) {
        showJourneyFeedback("No skill points available right now.", true);
        return;
      }

      state.allocatedStats[statKey] += 1;
      const updatedJourneyStats = buildJourneyDerived(state, journeyLevel);
      const updatedStat = updatedJourneyStats.statBreakdown[statKey];
      addJourneyLog(
        state,
        `${JOURNEY_STAT_META[statKey].label} improved through hard-earned experience.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      appState.showCharacterSkillModal =
        getUnspentSkillPoints(state, journeyLevel) > 0;
      showJourneyFeedback(`${JOURNEY_STAT_META[statKey].label} increased.`);
      await appState.renderApp();
      showToast(buildStatIncreaseToast(statKey, updatedJourneyStats, updatedStat), {
        title: "Skill point spent",
      });
      return;
    }

    if (action === "equip-weapon") {
      const weaponKey = button.dataset.weapon;
      if (!equipJourneyWeapon(state, weaponKey)) {
        showJourneyFeedback("That weapon cannot be equipped right now.", true);
        return;
      }

      const weaponLabel = getJourneyWeaponMeta(weaponKey)?.label || "Weapon";
      addJourneyLog(
        state,
        `You adjusted your kit and equipped ${weaponLabel}.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`${weaponLabel} equipped.`);
      await appState.renderApp();
      return;
    }

    if (action === "drop-weapon") {
      const weaponKey = button.dataset.weapon;
      if (!dropJourneyWeapon(state, weaponKey)) {
        showJourneyFeedback("That weapon is not in your inventory.", true);
        return;
      }

      const weaponLabel = getJourneyWeaponMeta(weaponKey)?.label || "Weapon";
      addJourneyLog(
        state,
        `You let go of ${weaponLabel} to make room for something better.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`${weaponLabel} dropped.`);
      await appState.renderApp();
      return;
    }

    if (action === "keep-weapon") {
      const weaponKey = button.dataset.weapon;
      if (!keepJourneyPendingWeapon(state, weaponKey)) {
        showJourneyFeedback("There is no spare room for that weapon yet.", true);
        return;
      }

      const weaponLabel = getJourneyWeaponMeta(weaponKey)?.label || "Weapon";
      addJourneyLog(
        state,
        `You packed away ${weaponLabel} for a future stretch.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`${weaponLabel} added to your inventory.`);
      await appState.renderApp();
      return;
    }

    if (action === "replace-weapon") {
      const currentWeaponKey = button.dataset.replace;
      const nextWeaponKey = button.dataset.weapon;
      if (!replaceJourneyWeapon(state, currentWeaponKey, nextWeaponKey)) {
        showJourneyFeedback("That swap could not be made.", true);
        return;
      }

      const currentLabel = getJourneyWeaponMeta(currentWeaponKey)?.label || "Weapon";
      const nextLabel = getJourneyWeaponMeta(nextWeaponKey)?.label || "Weapon";
      addJourneyLog(
        state,
        `You traded out ${currentLabel} and claimed ${nextLabel}.`,
        new Date().toISOString()
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`${nextLabel} replaced ${currentLabel}.`);
      await appState.renderApp();
      return;
    }

    if (action === "discard-pending-weapon") {
      const weaponKey = button.dataset.weapon;
      if (!discardJourneyPendingWeapon(state, weaponKey)) {
        showJourneyFeedback("That waiting weapon is already gone.", true);
        return;
      }

      const weaponLabel = getJourneyWeaponMeta(weaponKey)?.label || "Weapon";
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`Left ${weaponLabel} behind.`);
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
      showJourneyFeedback(`Advanced journey time by ${hours}h.`);
      await appState.renderApp();
      return;
    }

    if (action === "debug-undo") {
      const previousSnapshot = state.debugHistory?.[0];
      if (!previousSnapshot) {
        showJourneyFeedback("No debug snapshot to restore.", true);
        return;
      }

      const remainingHistory = state.debugHistory.slice(1);
      const restoredState = normalizeJourneyState({
        ...previousSnapshot,
        debugHistory: remainingHistory,
      });
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, restoredState);
      showJourneyFeedback("Restored the previous debug snapshot.");
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
        showJourneyFeedback("No event candidates are available right now.", true);
        return;
      }

      pushJourneyDebugSnapshot(state);
      const selectedCandidate = candidates[randomInt(0, candidates.length - 1)];
      const forcedEvent = normalizeJourneyEvent(
        {
          ...selectedCandidate.build(),
          eventKey: selectedCandidate.key,
          kind: selectedCandidate.kind,
          repeatable: selectedCandidate.repeatable,
        },
        new Date().toISOString()
      );
      if (!forcedEvent) {
        showJourneyFeedback("Could not force that event.", true);
        return;
      }
      state.pendingEvents = [forcedEvent, ...state.pendingEvents].slice(
        0,
        JOURNEY_PENDING_EVENT_LIMIT
      );
      await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
      showJourneyFeedback(`Forced event: ${forcedEvent.title}.`);
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
      showJourneyFeedback("Idle journey reset. Tracker history kept.");
      await appState.renderApp();
      return;
    }

    if (action === "use-ration") {
      if (supplies.availableRations <= 0) {
        showJourneyFeedback("No rations banked from your tracker yet.", true);
        return;
      }

      const journeyStats = buildJourneyDerived(state, journeyLevel);
      const hungerBefore = state.currentHunger;
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
      showJourneyFeedback("Used 1 ration to restore hunger.");
      await appState.renderApp();
      showToast(
        buildSupplyToast({
          resourceLabel: "Hunger",
          amount: state.currentHunger - hungerBefore,
          current: state.currentHunger,
          max: journeyStats.maxHunger,
        }),
        {
          title: "Ration used",
        }
      );
      return;
    }

    if (action === "use-tonic") {
      if (supplies.availableTonics <= 0) {
        showJourneyFeedback(
          "No tonics earned yet. Meaningful progress and good choices are how you build them.",
          true
        );
        return;
      }

      const journeyStats = buildJourneyDerived(state, journeyLevel);
      const hpBefore = state.currentHp;
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
      showJourneyFeedback("Used 1 tonic to restore health.");
      await appState.renderApp();
      showToast(
        buildSupplyToast({
          resourceLabel: "HP",
          amount: state.currentHp - hpBefore,
          current: state.currentHp,
          max: journeyStats.maxHp,
          suffix: " HP",
        }),
        {
          title: "Tonic used",
        }
      );
    }
  } catch (error) {
    console.error("Failed to update idle journey:", error);
    showJourneyFeedback(
      getErrorMessage(error, "Could not update the idle journey."),
      true
    );
  }
}

export async function handleJourneyEventModalClick(event) {
  if (appState.isJourneyEventResolving) {
    return;
  }

  if (
    event.target instanceof HTMLElement &&
    event.target.dataset.closeJourneyEvent !== undefined
  ) {
    closeJourneyEventModal();
    return;
  }

  const button = event.target.closest("button[data-journey-event-choice]");
  if (!button) return;

  appState.isJourneyEventResolving = true;
  showJourneyEventThinking(
    buildJourneyChoiceProgressText(
      button.querySelector(".journey-event-choice-title")?.textContent || ""
    )
  );

  try {
    await wait(3000);
    await resolveJourneyEventChoice(button.dataset.eventId, button.dataset.choiceId);
  } finally {
    appState.isJourneyEventResolving = false;
  }
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
      showJourneyFeedback("That event is no longer available.", true);
      await appState.renderApp();
      return;
    }

    state.pendingEvents = state.pendingEvents.filter((entry) => entry.id !== eventId);
    const beforeState = normalizeJourneyState({
      ...state,
      pendingEvents: [],
      debugHistory: [],
    });
    const resolution = applyJourneyChoiceEffects(
      state,
      choice,
      journeyStats,
      new Date().toISOString()
    );
    if (!eventEntry.repeatable) {
      rememberJourneyCompletedEventKey(
        state,
        eventEntry.eventKey || eventEntry.title
      );
    }
    if (eventEntry.kind === "aid") {
      state.aidUrgency = Math.max(0, state.aidUrgency - 2);
    }
    const outcomeItems = buildJourneyOutcomeItems(beforeState, state, resolution);

    await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizeJourneyState(state));
    closeJourneyEventModal();
    openJourneyOutcomeModal(eventEntry, choice, resolution, outcomeItems);
    showJourneyFeedback(resolution.resultText);
    await appState.renderApp();
  } catch (error) {
    console.error("Failed to resolve journey event:", error);
    closeJourneyEventModal();
    showJourneyFeedback(
      getErrorMessage(error, "Could not resolve that event."),
      true
    );
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildJourneyChoiceProgressText(choiceLabel) {
  const cleaned = String(choiceLabel || "")
    .trim()
    .replace(/[.!?]+$/, "");

  if (!cleaned) {
    return "Carrying out your choice...";
  }

  const verbSwaps = [
    [/^build\b/i, "Building"],
    [/^push\b/i, "Pushing"],
    [/^collect\b/i, "Collecting"],
    [/^find\b/i, "Finding"],
    [/^recover\b/i, "Recovering"],
    [/^rest\b/i, "Resting"],
    [/^wait\b/i, "Waiting"],
    [/^make\b/i, "Making"],
    [/^light\b/i, "Lighting"],
    [/^take\b/i, "Taking"],
    [/^hold\b/i, "Holding"],
    [/^cross\b/i, "Crossing"],
    [/^follow\b/i, "Following"],
    [/^search\b/i, "Searching"],
    [/^use\b/i, "Using"],
    [/^eat\b/i, "Eating"],
    [/^drink\b/i, "Drinking"],
  ];

  for (const [pattern, replacement] of verbSwaps) {
    if (pattern.test(cleaned)) {
      return `${cleaned.replace(pattern, replacement)}...`;
    }
  }

  return `${cleaned}...`;
}

function buildSupplyToast({ resourceLabel, amount, current, max, suffix = "" }) {
  const roundedAmount = Math.max(0, Math.round(amount));
  const roundedCurrent = Math.round(current);
  const roundedMax = Math.round(max);

  return `Regained ${roundedAmount} ${resourceLabel} (${roundedCurrent}/${roundedMax}${suffix}).`;
}

function buildStatIncreaseToast(statKey, journeyStats, statBreakdown) {
  const statLabel = JOURNEY_STAT_META[statKey]?.label || "Stat";

  if (statKey === "vitality") {
    return `${statLabel} increased to ${statBreakdown.total}. Max HP is now ${journeyStats.maxHp}.`;
  }

  if (statKey === "resolve") {
    return `${statLabel} increased to ${statBreakdown.total}. Max hunger is now ${journeyStats.maxHunger}.`;
  }

  return `${statLabel} increased to ${statBreakdown.total}.`;
}
