import { setMeta } from "../../data/metaRepo.js";
import {
  GAME_STATUSES,
  IDLE_JOURNEY_META_KEY,
  JOURNEY_AMBIENT_INTERACTIONS,
  JOURNEY_BAG_META,
  JOURNEY_BASE_CLASS,
  JOURNEY_BOSS_DISTANCE,
  JOURNEY_BOSS_NAMES,
  JOURNEY_CLASS_META,
  JOURNEY_DEBUG_HISTORY_LIMIT,
  JOURNEY_FLAG_KEYS,
  JOURNEY_LOG_LIMIT,
  JOURNEY_PENDING_EVENT_LIMIT,
  JOURNEY_RECENT_EVENT_LIMIT,
  JOURNEY_STARTER_ITEMS,
  JOURNEY_STAT_KEYS,
  JOURNEY_STORY_XP_PER_LEVEL,
  JOURNEY_TICK_MS,
  JOURNEY_WEAPON_META,
  JOURNEY_ZONE_NAMES,
} from "../../core/constants.js";
import { computeStreak } from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { normalizeJourneyChoice, normalizeJourneyEvent } from "./journeyEvents.js";

export async function syncJourneyState(rawState, games, sessions, xpSummary) {
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

  if (settleJourneySupplyOverflow(state, games, sessions)) {
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

  if (settleJourneySupplyOverflow(state, games, sessions)) {
    changed = true;
  }

  state.lastUpdatedAt = now.toISOString();
  const normalizedState = normalizeJourneyState(state);

  if (changed) {
    await setMeta(appState.db, IDLE_JOURNEY_META_KEY, normalizedState);
  }

  return normalizedState;
}

export function normalizeJourneyState(rawState = null) {
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
    storyFlags.foundWeapon ||
    inferredBoarDefeat ||
    Boolean(source.weaponName) ||
    Boolean(source.equippedWeaponKey);
  storyFlags.boarDefeated = inferredBoarDefeat;
  const bagKey = normalizeJourneyBagKey(source.bagKey);
  const bagMeta = getJourneyBagMeta(bagKey);
  const weaponSlotLimit = bagMeta.weaponSlots;
  const legacyWeaponKey = normalizeJourneyWeaponKey(
    source.equippedWeaponKey || source.weaponName
  );
  const inventoryWeaponSet = new Set(
    Array.isArray(source.inventoryWeaponKeys) ? source.inventoryWeaponKeys : []
  );
  if (legacyWeaponKey) {
    inventoryWeaponSet.add(legacyWeaponKey);
  }
  const normalizedWeaponKeys = [...inventoryWeaponSet]
    .map((entry) => normalizeJourneyWeaponKey(entry))
    .filter(Boolean);
  const keptWeaponKeys = normalizedWeaponKeys.slice(0, weaponSlotLimit);
  const normalizedPendingWeapons = Array.isArray(source.pendingWeaponKeys)
    ? source.pendingWeaponKeys
        .map((entry) => normalizeJourneyWeaponKey(entry))
        .filter(Boolean)
    : [];
  const pendingWeaponKeys = [
    ...new Set(
      [...normalizedPendingWeapons, ...normalizedWeaponKeys.slice(weaponSlotLimit)].filter(
        (weaponKey) => !keptWeaponKeys.includes(weaponKey)
      )
    ),
  ];
  const requestedEquippedWeaponKey = normalizeJourneyWeaponKey(source.equippedWeaponKey);
  const equippedWeaponKey = keptWeaponKeys.includes(requestedEquippedWeaponKey)
    ? requestedEquippedWeaponKey
    : keptWeaponKeys[0] || "";
  storyFlags.foundWeapon =
    inferredWeapon || keptWeaponKeys.length > 0 || pendingWeaponKeys.length > 0;

  return {
    version: 4,
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
    bagKey,
    inventoryWeaponKeys: keptWeaponKeys,
    equippedWeaponKey,
    pendingWeaponKeys,
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
    autoConsumedRations: Math.max(
      0,
      Math.floor(Number(source.autoConsumedRations) || 0)
    ),
    autoConsumedTonics: Math.max(
      0,
      Math.floor(Number(source.autoConsumedTonics) || 0)
    ),
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

export function randomJourneyStarterItem() {
  return JOURNEY_STARTER_ITEMS[randomInt(0, JOURNEY_STARTER_ITEMS.length - 1)];
}

export function createJourneyDebugSnapshot(rawState) {
  if (!rawState || typeof rawState !== "object") return null;

  const snapshot = normalizeJourneyState({
    ...rawState,
    debugHistory: [],
  });
  snapshot.debugHistory = [];
  return snapshot;
}

export function pushJourneyDebugSnapshot(state) {
  const snapshot = createJourneyDebugSnapshot(state);
  if (!snapshot) return;

  state.debugHistory = [snapshot, ...(state.debugHistory || [])].slice(
    0,
    JOURNEY_DEBUG_HISTORY_LIMIT
  );
}

export function buildJourneyDerived(state, journeyLevel) {
  const classMeta =
    JOURNEY_CLASS_META[state.classType] || JOURNEY_CLASS_META[JOURNEY_BASE_CLASS];
  const equippedWeaponMeta = getJourneyWeaponMeta(state.equippedWeaponKey);
  const classBonuses = classMeta.bonuses || {};
  const weaponBonuses = equippedWeaponMeta?.bonuses || {};
  const statBreakdown = {};
  const stats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    const breakdown = {
      base: 2,
      classBonus: classBonuses[key] || 0,
      weaponBonus: weaponBonuses[key] || 0,
      modifier: Math.round(Number(state.statModifiers?.[key]) || 0),
      allocated: Math.max(0, Math.floor(Number(state.allocatedStats[key]) || 0)),
    };
    accumulator[key] =
      breakdown.base +
      breakdown.classBonus +
      breakdown.weaponBonus +
      breakdown.modifier +
      breakdown.allocated;
    statBreakdown[key] = {
      ...breakdown,
      total: accumulator[key],
    };
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
    equippedWeaponMeta,
    classBonuses,
    weaponBonuses,
    statBreakdown,
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

export function buildJourneySupplies(games, sessions, state) {
  const meaningfulCount = sessions.filter(
    (session) => session.meaningfulProgress
  ).length;
  const completedCount = games.filter(
    (game) => game.status === GAME_STATUSES.COMPLETED
  ).length;
  const carryLimits = getJourneyCarryLimits(state);
  const earnedRations =
    sessions.length + meaningfulCount + completedCount * 2 + state.bonusRations;
  const earnedTonics =
    Math.floor(meaningfulCount / 2) + completedCount * 3 + state.bonusTonics;
  const consumedRations = Math.min(
    Math.max(0, state.autoConsumedRations || 0),
    Math.max(0, earnedRations - state.spentRations)
  );
  const consumedTonics = Math.min(
    Math.max(0, state.autoConsumedTonics || 0),
    Math.max(0, earnedTonics - state.spentTonics)
  );
  const availableRations = Math.max(
    0,
    earnedRations - state.spentRations - consumedRations
  );
  const availableTonics = Math.max(
    0,
    earnedTonics - state.spentTonics - consumedTonics
  );

  return {
    earnedRations,
    earnedTonics,
    availableRations,
    availableTonics,
    rationCapacity: carryLimits.rationCapacity,
    tonicCapacity: carryLimits.tonicCapacity,
    autoConsumedRations: consumedRations,
    autoConsumedTonics: consumedTonics,
  };
}

export function buildJourneyStretchChallenge(state, journeyStats) {
  const boss = getJourneyBoss(state.bossIndex);
  const conditionPower = state.currentHp * 0.12 + state.currentHunger * 0.08;
  const weaponBonus = journeyStats.equippedWeaponMeta
    ? 4 +
      JOURNEY_STAT_KEYS.reduce(
        (total, statKey) => total + (journeyStats.weaponBonuses[statKey] || 0),
        0
      ) *
        1.5
    : -6;
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

export function buildJourneyStretchPresentation(state, boss, progress, journeyStats) {
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

export function getJourneyGoalMeta(state, boss, progress) {
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
        horizonLabel: "Right now",
        horizonValue: "Nothing here feels familiar yet.",
      };
    }

    if (progress.percent < 38) {
      return {
        goalTitle: "Find a path that actually leads somewhere",
        goalAction: "finding a path that actually leads somewhere",
        horizonLabel: "Up ahead",
        horizonValue: "You need a trail that actually leads somewhere.",
      };
    }

    if (!state.storyFlags.foundWeapon || progress.percent < 56) {
      return {
        goalTitle: "Find something you can fight with",
        goalAction: "finding something you can fight with",
        horizonLabel: "Up ahead",
        horizonValue: "You cannot stay unarmed forever.",
      };
    }

    if (progress.percent < 78) {
      return {
        goalTitle: "Find food and steady yourself",
        goalAction: "finding food and steadying yourself",
        horizonLabel: "Need",
        horizonValue: "You need enough strength for whatever comes next.",
      };
    }

    return {
      goalTitle: "Follow the boar's trail",
      goalAction: "following the boar's trail",
      horizonLabel: "Trail sign",
      horizonValue: "Fresh signs of the boar are all over this part of the forest.",
    };
  }

  if (state.bossIndex === 1) {
    if (progress.percent < 58) {
      return {
        goalTitle: "Stay ahead of the wolves",
        goalAction: "staying ahead of the wolves",
        horizonLabel: "Up ahead",
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
      horizonLabel: "Up ahead",
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

export function getJourneyProgressFeeling(state, progressPercent) {
  if (state.status === "recovering") {
    return "Distance can wait until you are steady again.";
  }

  if (progressPercent < 20) return "You have only just started to get a handle on this.";
  if (progressPercent < 45) return "It still feels messy, but at least you are moving with some intent.";
  if (progressPercent < 75) return "The shape of the stretch is starting to reveal itself.";
  if (progressPercent < 95) return "The end of this stretch feels close now.";
  return "You are almost through this part of the road.";
}

export function buildJourneyInnerThoughts(state, goalMeta, journeyStats) {
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

export function buildJourneyRecoveryObjective(state, journeyLevel, journeyStats) {
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

export function rememberJourneyEventKey(state, eventKey) {
  const safeKey = String(eventKey || "").trim();
  if (!safeKey) return;

  state.recentEventKeys = [
    safeKey,
    ...(Array.isArray(state.recentEventKeys) ? state.recentEventKeys : []).filter(
      (entry) => entry !== safeKey
    ),
  ].slice(0, JOURNEY_RECENT_EVENT_LIMIT);
}

export function buildJourneyOutcomeItems(beforeState, afterState) {
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
  const beforeWeapons = new Set([
    ...(beforeState.inventoryWeaponKeys || []),
    ...(beforeState.pendingWeaponKeys || []),
  ]);
  const gainedWeapons = [
    ...(afterState.inventoryWeaponKeys || []),
    ...(afterState.pendingWeaponKeys || []),
  ].filter((weaponKey) => !beforeWeapons.has(weaponKey));
  for (const weaponKey of gainedWeapons) {
    const weaponMeta = getJourneyWeaponMeta(weaponKey);
    if (!weaponMeta) continue;
    items.push({
      label: `Weapon: ${weaponMeta.label}`,
      className: "is-positive",
    });
  }

  if (beforeState.bagKey !== afterState.bagKey) {
    items.push({
      label: `Bag: ${getJourneyBagMeta(afterState.bagKey).label}`,
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

export function buildJourneyContext(games, sessions) {
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

export function simulateJourneyState(state, elapsedMs, journeyStats, journeyContext) {
  let remainingMs = elapsedMs;
  let cursor = new Date(state.lastUpdatedAt || new Date().toISOString());

  while (remainingMs > 0) {
    const sliceMs = Math.min(JOURNEY_TICK_MS, remainingMs);
    const nextCursor = new Date(cursor.getTime() + sliceMs);
    const hours = sliceMs / (1000 * 60 * 60);

    if (state.status === "recovering") {
      const recoveryObjectiveBefore = state.recoveryObjective;
      state.currentHp = clamp(
        state.currentHp + journeyStats.maxHp * 0.055 * hours,
        0,
        journeyStats.maxHp
      );
      state.currentHunger = clamp(
        state.currentHunger + 6.5 * hours,
        0,
        journeyStats.maxHunger
      );
      state.recoveryObjective = buildJourneyRecoveryObjective(
        state,
        journeyStats.level,
        journeyStats
      );

      const recoveredEnough =
        state.currentHp >= journeyStats.maxHp * 0.52 &&
        state.currentHunger >= journeyStats.maxHunger * 0.6;
      const servedFullRecoveryTime =
        state.restUntil && nextCursor >= new Date(state.restUntil);

      if (recoveredEnough || servedFullRecoveryTime) {
        state.status = "adventuring";
        state.restUntil = null;
        state.recoveryObjective = "";
        state.aidUrgency = Math.max(0, state.aidUrgency - 1);
        state.currentHp = Math.max(state.currentHp, journeyStats.maxHp * 0.46);
        state.currentHunger = Math.max(
          state.currentHunger,
          journeyStats.maxHunger * 0.56
        );
        addJourneyLog(
          state,
          recoveredEnough && !servedFullRecoveryTime
            ? `You felt steady enough to stop hiding and head back toward ${getJourneyZoneName(
                state.bossIndex
              )}.`
            : `You left shelter and headed back toward ${getJourneyZoneName(
                state.bossIndex
              )}.`,
          nextCursor.toISOString()
        );
      } else if (state.recoveryObjective !== recoveryObjectiveBefore) {
        addJourneyLog(
          state,
          state.recoveryObjective,
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

export function autoResolvePendingJourneyEvents(state, journeyStats, atIso) {
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

export function resolveJourneyBoss(state, journeyStats, atDate) {
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
    state.bossIndex * JOURNEY_BOSS_DISTANCE + 22,
    state.totalDistance - randomInt(18, 34)
  );
  state.currentHp = Math.min(
    clamp(state.currentHp - randomInt(14, 24), 0, journeyStats.maxHp),
    Math.round(journeyStats.maxHp * 0.42)
  );
  state.currentHunger = Math.min(
    clamp(state.currentHunger - randomInt(9, 16), 0, journeyStats.maxHunger),
    Math.round(journeyStats.maxHunger * 0.46)
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

export function applyJourneyVictoryRewards(state, journeyLevel, atDate) {
  const rewards = ["1 skill point"];

  if (Math.random() < 0.58) {
    const weaponKey = getJourneyVictoryWeaponReward(journeyLevel);
    const weaponRewardText = awardJourneyWeapon(state, weaponKey);
    if (weaponRewardText) {
      rewards.push(weaponRewardText);
    }
  }

  if (Math.random() < 0.26) {
    const bagKey = getJourneyVictoryBagReward(state, journeyLevel);
    const bagRewardText = awardJourneyBag(state, bagKey);
    if (bagRewardText) {
      rewards.push(bagRewardText);
    }
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

export function maybeApplyJourneyIncident(state, atDate, journeyStats, journeyContext) {
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

export function maybeQueueJourneyEvent(state, atDate, journeyLevel, journeyContext) {
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

export function getJourneyEventCandidates(state, journeyLevel, atDate, journeyContext) {
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

export function maybeAddAmbientJourneyLog(state, atDate) {
  if (Math.random() > 0.18) return;

  const phase = getJourneyPhase(state);
  const pool = JOURNEY_AMBIENT_INTERACTIONS[phase] || JOURNEY_AMBIENT_INTERACTIONS.frontier;
  if (!pool?.length) return;

  addJourneyLog(state, pool[randomInt(0, pool.length - 1)], atDate.toISOString());
}

export function applyJourneyChoiceEffects(state, choice, journeyStats, atIso) {
  const { effects } = choice;
  const notes = [];

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
    const weaponRewardText = awardJourneyWeapon(state, effects.weaponName);
    if (weaponRewardText) {
      notes.push(`Weapon found: ${weaponRewardText}.`);
    }
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

  if (unlockedText) {
    notes.push(unlockedText);
  }

  return notes.length
    ? `${choice.resultText} ${notes.join(" ")}`
    : choice.resultText;
}

export function unlockJourneyClass(state, classKey, atIso) {
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

export function hasJourneyClassUnlocked(state, classKey) {
  return state.unlockedClasses.includes(classKey);
}

export function getJourneyBagMeta(bagKey) {
  return JOURNEY_BAG_META[normalizeJourneyBagKey(bagKey)] || JOURNEY_BAG_META.none;
}

export function getJourneyWeaponMeta(weaponKey) {
  const normalizedKey = normalizeJourneyWeaponKey(weaponKey);
  return normalizedKey ? JOURNEY_WEAPON_META[normalizedKey] || null : null;
}

export function getJourneyCarryLimits(state) {
  const bagMeta = getJourneyBagMeta(state?.bagKey);
  return {
    weaponSlots: bagMeta.weaponSlots,
    rationCapacity: bagMeta.rationCapacity,
    tonicCapacity: bagMeta.tonicCapacity,
  };
}

export function getJourneyWeaponInventory(state) {
  return (Array.isArray(state.inventoryWeaponKeys) ? state.inventoryWeaponKeys : [])
    .map((weaponKey) => ({
      key: weaponKey,
      meta: getJourneyWeaponMeta(weaponKey),
      equipped: weaponKey === state.equippedWeaponKey,
    }))
    .filter((entry) => entry.meta);
}

export function getJourneyPendingWeapons(state) {
  return (Array.isArray(state.pendingWeaponKeys) ? state.pendingWeaponKeys : [])
    .map((weaponKey) => ({
      key: weaponKey,
      meta: getJourneyWeaponMeta(weaponKey),
    }))
    .filter((entry) => entry.meta);
}

export function normalizeJourneyBagKey(bagKey) {
  const safeKey = String(bagKey || "").trim();
  return JOURNEY_BAG_META[safeKey] ? safeKey : "none";
}

export function normalizeJourneyWeaponKey(weaponKey) {
  const safeKey = String(weaponKey || "").trim();
  if (!safeKey) return "";
  if (JOURNEY_WEAPON_META[safeKey]) return safeKey;

  const matchingEntry = Object.entries(JOURNEY_WEAPON_META).find(
    ([, meta]) => meta.label.toLowerCase() === safeKey.toLowerCase()
  );
  return matchingEntry?.[0] || "";
}

export function awardJourneyBag(state, bagKey) {
  const nextBagKey = normalizeJourneyBagKey(bagKey);
  const nextBagMeta = getJourneyBagMeta(nextBagKey);
  const currentBagMeta = getJourneyBagMeta(state.bagKey);

  if (nextBagMeta.rank <= currentBagMeta.rank) {
    return "";
  }

  state.bagKey = nextBagKey;
  return nextBagMeta.label;
}

export function awardJourneyWeapon(state, weaponKey) {
  const nextWeaponKey =
    normalizeJourneyWeaponKey(weaponKey) || "scavenged_weapon";
  const weaponMeta = getJourneyWeaponMeta(nextWeaponKey);
  if (!weaponMeta) return "";

  state.storyFlags.foundWeapon = true;
  state.inventoryWeaponKeys = Array.isArray(state.inventoryWeaponKeys)
    ? state.inventoryWeaponKeys
    : [];
  state.pendingWeaponKeys = Array.isArray(state.pendingWeaponKeys)
    ? state.pendingWeaponKeys
    : [];

  if (
    state.inventoryWeaponKeys.includes(nextWeaponKey) ||
    state.pendingWeaponKeys.includes(nextWeaponKey)
  ) {
    return weaponMeta.label;
  }

  const { weaponSlots } = getJourneyCarryLimits(state);
  if (state.inventoryWeaponKeys.length < weaponSlots) {
    state.inventoryWeaponKeys = [...state.inventoryWeaponKeys, nextWeaponKey];
    if (!state.equippedWeaponKey) {
      state.equippedWeaponKey = nextWeaponKey;
    }
    return weaponMeta.label;
  }

  state.pendingWeaponKeys = [...state.pendingWeaponKeys, nextWeaponKey];
  return `${weaponMeta.label} (inventory full)`;
}

export function keepJourneyPendingWeapon(state, weaponKey) {
  const nextWeaponKey = normalizeJourneyWeaponKey(weaponKey);
  if (!nextWeaponKey) return false;

  state.pendingWeaponKeys = Array.isArray(state.pendingWeaponKeys)
    ? state.pendingWeaponKeys
    : [];
  state.inventoryWeaponKeys = Array.isArray(state.inventoryWeaponKeys)
    ? state.inventoryWeaponKeys
    : [];

  if (!state.pendingWeaponKeys.includes(nextWeaponKey)) {
    return false;
  }

  const { weaponSlots } = getJourneyCarryLimits(state);
  if (state.inventoryWeaponKeys.length >= weaponSlots) {
    return false;
  }

  state.pendingWeaponKeys = state.pendingWeaponKeys.filter(
    (entry) => entry !== nextWeaponKey
  );
  state.inventoryWeaponKeys = [...state.inventoryWeaponKeys, nextWeaponKey];
  if (!state.equippedWeaponKey) {
    state.equippedWeaponKey = nextWeaponKey;
  }
  return true;
}

export function replaceJourneyWeapon(state, currentWeaponKey, nextWeaponKey) {
  const equippedKey = normalizeJourneyWeaponKey(currentWeaponKey);
  const incomingKey = normalizeJourneyWeaponKey(nextWeaponKey);
  if (!equippedKey || !incomingKey) return false;

  state.inventoryWeaponKeys = Array.isArray(state.inventoryWeaponKeys)
    ? state.inventoryWeaponKeys
    : [];
  state.pendingWeaponKeys = Array.isArray(state.pendingWeaponKeys)
    ? state.pendingWeaponKeys
    : [];

  if (
    !state.inventoryWeaponKeys.includes(equippedKey) ||
    !state.pendingWeaponKeys.includes(incomingKey)
  ) {
    return false;
  }

  state.inventoryWeaponKeys = state.inventoryWeaponKeys.map((weaponKey) =>
    weaponKey === equippedKey ? incomingKey : weaponKey
  );
  state.pendingWeaponKeys = state.pendingWeaponKeys.filter(
    (weaponKey) => weaponKey !== incomingKey
  );
  if (state.equippedWeaponKey === equippedKey) {
    state.equippedWeaponKey = incomingKey;
  }
  return true;
}

export function dropJourneyWeapon(state, weaponKey) {
  const nextWeaponKey = normalizeJourneyWeaponKey(weaponKey);
  if (!nextWeaponKey) return false;

  state.inventoryWeaponKeys = Array.isArray(state.inventoryWeaponKeys)
    ? state.inventoryWeaponKeys
    : [];
  if (!state.inventoryWeaponKeys.includes(nextWeaponKey)) {
    return false;
  }

  state.inventoryWeaponKeys = state.inventoryWeaponKeys.filter(
    (entry) => entry !== nextWeaponKey
  );
  if (state.equippedWeaponKey === nextWeaponKey) {
    state.equippedWeaponKey = state.inventoryWeaponKeys[0] || "";
  }
  return true;
}

export function discardJourneyPendingWeapon(state, weaponKey) {
  const nextWeaponKey = normalizeJourneyWeaponKey(weaponKey);
  if (!nextWeaponKey) return false;

  state.pendingWeaponKeys = Array.isArray(state.pendingWeaponKeys)
    ? state.pendingWeaponKeys
    : [];
  if (!state.pendingWeaponKeys.includes(nextWeaponKey)) {
    return false;
  }

  state.pendingWeaponKeys = state.pendingWeaponKeys.filter(
    (entry) => entry !== nextWeaponKey
  );
  return true;
}

export function equipJourneyWeapon(state, weaponKey) {
  const nextWeaponKey = normalizeJourneyWeaponKey(weaponKey);
  if (!nextWeaponKey) return false;

  state.inventoryWeaponKeys = Array.isArray(state.inventoryWeaponKeys)
    ? state.inventoryWeaponKeys
    : [];
  if (!state.inventoryWeaponKeys.includes(nextWeaponKey)) {
    return false;
  }

  state.equippedWeaponKey = nextWeaponKey;
  return true;
}

export function settleJourneySupplyOverflow(state, games, sessions) {
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
  const carryLimits = getJourneyCarryLimits(state);
  let changed = false;

  const maxAutoConsumedRations = Math.max(0, earnedRations - state.spentRations);
  const maxAutoConsumedTonics = Math.max(0, earnedTonics - state.spentTonics);

  const normalizedAutoConsumedRations = Math.min(
    Math.max(0, state.autoConsumedRations || 0),
    maxAutoConsumedRations
  );
  if (normalizedAutoConsumedRations !== state.autoConsumedRations) {
    state.autoConsumedRations = normalizedAutoConsumedRations;
    changed = true;
  }

  const normalizedAutoConsumedTonics = Math.min(
    Math.max(0, state.autoConsumedTonics || 0),
    maxAutoConsumedTonics
  );
  if (normalizedAutoConsumedTonics !== state.autoConsumedTonics) {
    state.autoConsumedTonics = normalizedAutoConsumedTonics;
    changed = true;
  }

  const availableRations =
    earnedRations - state.spentRations - state.autoConsumedRations;
  if (availableRations > carryLimits.rationCapacity) {
    state.autoConsumedRations += availableRations - carryLimits.rationCapacity;
    changed = true;
  }

  const availableTonics =
    earnedTonics - state.spentTonics - state.autoConsumedTonics;
  if (availableTonics > carryLimits.tonicCapacity) {
    state.autoConsumedTonics += availableTonics - carryLimits.tonicCapacity;
    changed = true;
  }

  return changed;
}

export function getJourneyVictoryWeaponReward(journeyLevel) {
  if (journeyLevel >= 7) {
    return randomPick(["ember_rod", "warded_stave", "ruin_greatblade"]);
  }
  if (journeyLevel >= 4) {
    return randomPick([
      "weathered_short_sword",
      "hardened_boar_spear",
      "travelers_hatchet",
      "bandit_cut_machete",
      "ashwood_bow",
      "ember_rod",
    ]);
  }
  return randomPick([
    "rust_worn_belt_knife",
    "crude_spear_club",
    "weathered_short_sword",
    "hardened_boar_spear",
    "travelers_hatchet",
    "bandit_cut_machete",
  ]);
}

export function getJourneyVictoryBagReward(state, journeyLevel) {
  const currentBagRank = getJourneyBagMeta(state.bagKey).rank;
  const candidates = Object.entries(JOURNEY_BAG_META)
    .filter(([, meta]) => meta.rank > currentBagRank)
    .map(([bagKey]) => bagKey);

  if (!candidates.length) return "";
  if (journeyLevel >= 6 && candidates.includes("field_kit")) return "field_kit";
  if (journeyLevel >= 3 && candidates.includes("backpack")) return "backpack";
  return candidates[0];
}

export function sendJourneyToTown(
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
  state.currentHp = Math.max(
    state.currentHp,
    Math.max(6, Math.round(currentJourneyStats.maxHp * 0.1))
  );
  state.currentHunger = Math.max(
    state.currentHunger,
    Math.max(8, Math.round(currentJourneyStats.maxHunger * 0.12))
  );
  state.recoveryObjective = buildJourneyRecoveryObjective(
    state,
    currentJourneyLevel,
    currentJourneyStats
  );
  addJourneyLog(state, message, atDate.toISOString());
}

export function addJourneyLog(state, text, at) {
  const safeText = String(text || "").trim();
  if (!safeText) return;

  state.log = [{ text: safeText, at }, ...(Array.isArray(state.log) ? state.log : [])]
    .slice(0, JOURNEY_LOG_LIMIT);
}

export function getJourneyLevel(state, currentTrackerLevel) {
  return (
    Math.max(1, state.highestTrackerLevel || 1, currentTrackerLevel || 1) +
    getJourneyStoryLevelBonus(state.storyXp)
  );
}

export function getJourneyStoryLevelBonus(storyXp) {
  return Math.floor(Math.max(0, Number(storyXp) || 0) / JOURNEY_STORY_XP_PER_LEVEL);
}

export function getUnspentSkillPoints(state, journeyLevel) {
  const spentPoints = JOURNEY_STAT_KEYS.reduce(
    (total, key) => total + (state.allocatedStats[key] || 0),
    0
  );
  return Math.max(
    0,
    journeyLevel - 1 + (state.bonusSkillPoints || 0) - spentPoints
  );
}

export function getJourneyBoss(index) {
  const cycle = Math.floor(index / JOURNEY_BOSS_NAMES.length);
  const baseName = JOURNEY_BOSS_NAMES[index % JOURNEY_BOSS_NAMES.length];

  return {
    name: cycle ? `${baseName} ${romanize(cycle + 1)}` : baseName,
    power: 36 + index * 15 + Math.floor(index / 2) * 6,
  };
}

export function getJourneyZoneName(bossIndex) {
  return JOURNEY_ZONE_NAMES[bossIndex % JOURNEY_ZONE_NAMES.length];
}

export function getJourneySegmentProgress(totalDistance, bossIndex) {
  const segmentStart = bossIndex * JOURNEY_BOSS_DISTANCE;
  const nextBossDistance = (bossIndex + 1) * JOURNEY_BOSS_DISTANCE;
  const distanceIntoSegment = clamp(
    totalDistance - segmentStart,
    0,
    JOURNEY_BOSS_DISTANCE
  );
  const remainingDistance = Math.max(0, nextBossDistance - totalDistance);
  const percent = Math.round(
    clamp((distanceIntoSegment / JOURNEY_BOSS_DISTANCE) * 100, 0, 100)
  );

  return {
    percent,
    remainingDistance,
    currentLabel: `${Math.floor(distanceIntoSegment)} / ${JOURNEY_BOSS_DISTANCE} through this stretch`,
    remainingLabel: `${Math.ceil(remainingDistance)} until the next major threat`,
  };
}

export function getJourneyActivityText(state, boss, progress, journeyStats) {
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
  )} toward ${boss.name}. About ${formatDurationRangeHours(
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour)
  )} away if nothing goes wrong.`;
}

export function getRecoveryText(state) {
  const missionText = state.recoveryObjective
    ? `Mini mission: ${state.recoveryObjective} `
    : "";

  if (!state.restUntil) {
    return `${missionText}Recovering in shelter before risking the road again.`.trim();
  }

  const remainingMs = Math.max(0, new Date(state.restUntil).getTime() - Date.now());
  return `${missionText}Licking your wounds for roughly ${formatDurationRangeMs(
    remainingMs
  )} before heading back out.`.trim();
}

export function getJourneyStatusLabel(status) {
  return status === "recovering" ? "Resting" : "Traveling";
}

export function getJourneyPhase(state) {
  if (state.bossIndex === 0 && state.totalDistance < 42) return "arrival";
  if (state.bossIndex <= 1) return "survival";
  return "frontier";
}

export function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

export function randomPick(values) {
  return values[randomInt(0, values.length - 1)];
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatSignedNumber(value) {
  const numericValue = Math.round(Number(value) || 0);
  return `${numericValue >= 0 ? "+" : ""}${numericValue}`;
}

export function formatDurationHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "under 1h";

  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export function formatDurationRangeHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0.95) return "under 1h";

  const low = Math.max(1, Math.floor(hours));
  const high = Math.max(low + 1, Math.ceil(hours));
  return `${low}-${high}h`;
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "under 1h";
  return formatDurationHours(ms / (1000 * 60 * 60));
}

export function formatDurationRangeMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "under 1h";
  return formatDurationRangeHours(ms / (1000 * 60 * 60));
}

export function differenceInDays(leftMs, rightMs) {
  return Math.floor(Math.max(0, leftMs - rightMs) / (1000 * 60 * 60 * 24));
}

export function romanize(value) {
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
