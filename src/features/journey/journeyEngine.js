import { setMeta } from "../../data/metaRepo.js";
import {
  GAME_STATUSES,
  JOURNEY_COMPLETED_EVENT_LIMIT,
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
  JOURNEY_STAT_META,
  JOURNEY_STORY_XP_PER_LEVEL,
  JOURNEY_TICK_MS,
  JOURNEY_WEAPON_META,
  JOURNEY_ZONE_NAMES,
} from "../../core/constants.js";
import { computeStreak } from "../../core/formatters.js";
import { getCurrentLocale } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { normalizeJourneyChoice, normalizeJourneyEvent } from "./journeyEvents.js";

const JOURNEY_HISTORY_LIMIT = 24;
const JOURNEY_AMBIENT_LOG_COOLDOWN_MS = 1000 * 60 * 60 * 4;
const JOURNEY_AMBIENT_REPEAT_MEMORY = 3;
const JOURNEY_EVENT_COOLDOWN_MIN_HOURS = 1;
const JOURNEY_EVENT_COOLDOWN_MAX_HOURS = 3;
const JOURNEY_EVENT_HP_GAIN_MULTIPLIER = 2;
const JOURNEY_EVENT_HP_LOSS_MULTIPLIER = 3;
const JOURNEY_BOSS_BATTLE_MAX_HP = 100;
const JOURNEY_BOSS_BATTLE_TURN_LIMIT = 3;
const JOURNEY_STRETCH_FAILURE_HP_RATIO = 0.05;
const JOURNEY_TRAVELER_AID_LOG =
  "A passing traveler shared dried meat and better directions after seeing the state you were in.";
const JOURNEY_ZONE_NAMES_JA = [
  "未知の森",
  "小川沿いの茂み",
  "打ち捨てられた細道",
  "寂れた集落外れ",
  "壊れた監視街道",
  "霧沼の渡り",
  "石路峠道",
  "旧辺境街道",
  "裂け松の谷",
  "沈んだ土手道",
  "いばらの関道",
  "灯籠街道",
  "灰の九十九折り",
  "廃門前街道",
];
const JOURNEY_BOSS_NAMES_JA = [
  "追い詰められた森猪",
  "飢えた狼の群れ",
  "橋の伏兵",
  "沼牙の潜伏者",
  "丘賊の頭目",
  "遺跡の追跡者",
  "墓道のオーガ",
  "嵐尾根のワーム",
  "境界の暴君",
  "関道の略奪者",
  "泥鏡の蛇",
  "黒い茨角の鹿",
  "門楼の亡霊",
  "灰降りのキメラ",
];

function isJourneyJapaneseLocale() {
  return getCurrentLocale() === "ja";
}

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
  const legacyClearedRoads = buildLegacyClearedRoadHistory(source.log, nowIso);
  const legacyRetreatHistory = buildLegacyRetreatHistory(source.log, nowIso);
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
  const permanentBonuses = Array.isArray(source.permanentBonuses)
    ? source.permanentBonuses
        .map((entry) => normalizeJourneyPermanentBonus(entry))
        .filter(Boolean)
    : [];

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
    version: 9,
    classType,
    unlockedClasses,
    allocatedStats,
    storyFlags,
    statModifiers,
    permanentBonuses,
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
    nextEventAt: source.nextEventAt || null,
    restUntil: source.restUntil || null,
    recoveryStartedAt: source.recoveryStartedAt || null,
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
    completedEventKeys: Array.isArray(source.completedEventKeys)
      ? source.completedEventKeys
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
          .slice(0, JOURNEY_COMPLETED_EVENT_LIMIT)
      : [],
    debugHistory: Array.isArray(source.debugHistory)
      ? source.debugHistory
          .slice(0, JOURNEY_DEBUG_HISTORY_LIMIT)
          .map((entry) => createJourneyDebugSnapshot(entry))
          .filter(Boolean)
      : [],
    clearedRoads: normalizeJourneyHistoryEntries(
      source.clearedRoads,
      nowIso,
      legacyClearedRoads
    ),
    retreatHistory: normalizeJourneyHistoryEntries(
      source.retreatHistory,
      nowIso,
      legacyRetreatHistory
    ),
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

function normalizeJourneyHistoryEntries(sourceEntries, nowIso, fallbackEntries = []) {
  const entries = Array.isArray(sourceEntries) ? sourceEntries : fallbackEntries;

  return entries
    .slice(0, JOURNEY_HISTORY_LIMIT)
    .map((entry) => ({
      title: String(entry?.title || "").trim(),
      detail: String(entry?.detail || "").trim(),
      at: entry?.at || nowIso,
    }))
    .filter((entry) => entry.title && entry.at);
}

function buildLegacyClearedRoadHistory(logEntries, nowIso) {
  if (!Array.isArray(logEntries)) return [];

  return logEntries
    .map((entry) => parseLegacyClearedRoadEntry(entry, nowIso))
    .filter(Boolean)
    .slice(0, JOURNEY_HISTORY_LIMIT);
}

function parseLegacyClearedRoadEntry(entry, nowIso) {
  const text = String(entry?.text || "").trim();
  const at = entry?.at || nowIso;

  if (!text) return null;

  if (text.startsWith("You survived the boar and cleared the stretch.")) {
    return {
      title: JOURNEY_ZONE_NAMES[0] || "Unknown Forest",
      detail: "Cleared by surviving Cornered Forest Boar.",
      at,
    };
  }

  const clearedMatch = text.match(
    /^You cleared (.+?) with .*? The path opened into (.+?)\. Rewards:/
  );
  if (!clearedMatch) return null;

  const bossName = clearedMatch[1].trim();
  const nextZoneName = clearedMatch[2].trim();
  const nextZoneIndex = JOURNEY_ZONE_NAMES.findIndex(
    (zoneName) => zoneName === nextZoneName
  );
  const clearedZoneName =
    nextZoneIndex > 0 ? JOURNEY_ZONE_NAMES[nextZoneIndex - 1] : nextZoneName;

  return {
    title: clearedZoneName,
    detail: `Cleared by defeating ${bossName}.`,
    at,
  };
}

function buildLegacyRetreatHistory(logEntries, nowIso) {
  if (!Array.isArray(logEntries)) return [];

  return logEntries
    .map((entry) => parseLegacyRetreatEntry(entry, nowIso))
    .filter(Boolean)
    .slice(0, JOURNEY_HISTORY_LIMIT);
}

function parseLegacyRetreatEntry(entry, nowIso) {
  const text = String(entry?.text || "").trim();
  const at = entry?.at || nowIso;

  if (!text) return null;

  if (text.startsWith("Recovering after ")) {
    return {
      title: "Forced retreat",
      detail: text,
      at,
    };
  }

  if (
    text === "You were in no state to continue and had to crawl back toward safety." ||
    text ===
      "The aftermath forced you to stop and recover before you could go any farther."
  ) {
    return {
      title: "Forced retreat",
      detail: text,
      at,
    };
  }

  return null;
}

function addJourneyHistoryEntry(collection, entry) {
  if (!Array.isArray(collection)) {
    return [entry].slice(0, JOURNEY_HISTORY_LIMIT);
  }

  return [entry, ...collection].slice(0, JOURNEY_HISTORY_LIMIT);
}

function addJourneyRoadClear(state, title, detail, at) {
  const safeTitle = String(title || "").trim();
  if (!safeTitle) return;

  state.clearedRoads = addJourneyHistoryEntry(state.clearedRoads, {
    title: safeTitle,
    detail: String(detail || "").trim(),
    at,
  });
}

function addJourneyRetreat(state, title, detail, at) {
  const safeTitle = String(title || "").trim();
  if (!safeTitle) return;

  state.retreatHistory = addJourneyHistoryEntry(state.retreatHistory, {
    title: safeTitle,
    detail: String(detail || "").trim(),
    at,
  });
}

export function randomJourneyStarterItem() {
  return JOURNEY_STARTER_ITEMS[randomInt(0, JOURNEY_STARTER_ITEMS.length - 1)];
}

function normalizeJourneyPermanentBonus(rawBonus) {
  if (!rawBonus || typeof rawBonus !== "object") return null;

  const statKey = JOURNEY_STAT_META[rawBonus.statKey] ? rawBonus.statKey : "";
  const amount = Math.round(Number(rawBonus.amount) || 0);
  const title =
    typeof rawBonus.title === "string" ? rawBonus.title.trim() : "";
  const detail =
    typeof rawBonus.detail === "string" ? rawBonus.detail.trim() : "";
  const id =
    typeof rawBonus.id === "string" && rawBonus.id.trim()
      ? rawBonus.id.trim()
      : crypto.randomUUID();

  if (!statKey || !amount || !title) {
    return null;
  }

  return {
    id,
    statKey,
    amount,
    title,
    detail,
  };
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
  const modifierSourcesByStat = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    accumulator[key] = [];
    return accumulator;
  }, {});
  for (const bonus of Array.isArray(state.permanentBonuses) ? state.permanentBonuses : []) {
    if (!bonus || !modifierSourcesByStat[bonus.statKey]) continue;
    modifierSourcesByStat[bonus.statKey].push(bonus);
  }
  const statBreakdown = {};
  const stats = JOURNEY_STAT_KEYS.reduce((accumulator, key) => {
    const breakdown = {
      base: 2,
      classBonus: classBonuses[key] || 0,
      weaponBonus: weaponBonuses[key] || 0,
      modifier: Math.round(Number(state.statModifiers?.[key]) || 0),
      modifierSources: modifierSourcesByStat[key],
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
  const speedPerHour = 3.2 + stats.finesse * 0.34 + stats.resolve * 0.08;
  const regenPerHour = 0.8 + stats.vitality * 0.28 + stats.resolve * 0.08;
  const hungerDrainPerHour = Math.max(1.35, 4.1 - stats.resolve * 0.18);

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
  const hpRatio = journeyStats.maxHp
    ? clamp(state.currentHp / journeyStats.maxHp, 0, 1)
    : 0;
  const hungerRatio = journeyStats.maxHunger
    ? clamp(state.currentHunger / journeyStats.maxHunger, 0, 1)
    : 0;
  const conditionPower = state.currentHp * 0.08 + state.currentHunger * 0.06;
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
  const earlyStretchGrace =
    state.bossIndex === 0 ? 0.07 : state.bossIndex === 1 ? 0.03 : 0;
  const laterStretchPressure = Math.min(0.18, state.bossIndex * 0.015);
  const healthPenalty = (1 - hpRatio) * 0.24;
  const hungerPenalty = (1 - hungerRatio) * 0.09;
  const successChance = clamp(
    0.1 +
      powerRatio * 0.5 +
      Math.max(0, journeyStats.level - state.bossIndex) * 0.016 +
      earlyStretchGrace -
      laterStretchPressure -
      healthPenalty -
      hungerPenalty,
    0.08,
    0.84
  );

  return {
    boss,
    successChance,
    successPercent: Math.round(successChance * 100),
  };
}

export function buildJourneyStretchPresentation(
  state,
  boss,
  progress,
  journeyStats,
  supplies = null
) {
  const goalMeta = getJourneyGoalMeta(state, boss, progress, journeyStats, supplies);
  const isJa = isJourneyJapaneseLocale();

  return {
    ...goalMeta,
    currentLabel:
      state.status === "recovering"
        ? isJa
          ? `この区間の ${progress.percent}% を乗り越えた。`
          : `${progress.percent}% of this stretch is behind you.`
        : isJa
          ? `${goalMeta.goalAction}まで ${progress.percent}%。`
          : `${progress.percent}% of the way to ${goalMeta.goalAction}.`,
    remainingLabel: getJourneyProgressFeeling(state, progress.percent),
    innerThoughts: buildJourneyInnerThoughts(state, goalMeta, journeyStats),
  };
}

function getJourneyConditionState(state, journeyStats, supplies = null) {
  const hpRatio = journeyStats.maxHp
    ? state.currentHp / journeyStats.maxHp
    : 0;
  const hungerRatio = journeyStats.maxHunger
    ? state.currentHunger / journeyStats.maxHunger
    : 0;
  const availableRations = Math.max(0, Number(supplies?.availableRations) || 0);

  return {
    hpRatio,
    hungerRatio,
    availableRations,
    needsShelter: hpRatio <= 0.38,
    needsFood: hungerRatio <= 0.46 && availableRations === 0,
    foodLow: hungerRatio <= 0.62,
  };
}

export function getJourneyGoalMeta(state, boss, progress, journeyStats, supplies = null) {
  const condition = getJourneyConditionState(state, journeyStats, supplies);
  const isJa = isJourneyJapaneseLocale();

  if (isJa) {
    if (state.status === "recovering") {
      return {
        goalTitle: "立て直して態勢を整える",
        goalAction: "立て直し",
        innerThoughtAction: "立て直すこと",
        horizonLabel: "今は",
        horizonValue: state.recoveryObjective || "距離より、生き延びることの方が大事だ。",
      };
    }

    if (state.bossIndex === 0) {
      if (progress.percent < 18) {
        return {
          goalTitle: "勝手をつかむ",
          goalAction: "勝手をつかむ",
          innerThoughtAction: "勝手をつかむこと",
          horizonLabel: "今は",
          horizonValue: "まだ何ひとつ見覚えがない。",
        };
      }

      if (progress.percent < 38) {
        return {
          goalTitle: "ちゃんと先へ繋がる道を見つける",
          goalAction: "先へ繋がる道を見つける",
          innerThoughtAction: "先へ繋がる道を見つけること",
          horizonLabel: "この先",
          horizonValue: "ちゃんと先へ続く道筋が必要だ。",
        };
      }

      if (!state.storyFlags.foundWeapon || progress.percent < 56) {
        return {
          goalTitle: "戦える物を見つける",
          goalAction: "戦える物を見つける",
          innerThoughtAction: "戦える物を見つけること",
          horizonLabel: "この先",
          horizonValue: "いつまでも丸腰ではいられない。",
        };
      }

      if (progress.percent < 78) {
        if (condition.needsFood || condition.foodLow) {
          return {
            goalTitle: "食べ物を見つけて立て直す",
            goalAction: "食べ物を見つけて立て直す",
            innerThoughtAction: "食べ物を見つけて立て直すこと",
            horizonLabel: "必要",
            horizonValue:
              condition.availableRations > 0
                ? "食料はまだあるけれど、ちゃんと力を戻さないといけない。"
                : "次に備えるだけの力が必要だ。",
          };
        }

        return {
          goalTitle: "猪の縄張りを読む",
          goalAction: "猪の縄張りを読む",
          innerThoughtAction: "猪の縄張りを読むこと",
          horizonLabel: "痕跡",
          horizonValue: "ようやく森が、狩りに必要な手掛かりを見せ始めている。",
        };
      }

      return {
        goalTitle: "猪の痕を追う",
        goalAction: "猪の痕を追う",
        innerThoughtAction: "猪の痕を追うこと",
        horizonLabel: "痕跡",
        horizonValue: "この辺りの森には新しい猪の痕がそこら中にある。",
      };
    }

    if (state.bossIndex === 1) {
      if (progress.percent < 58) {
        return {
          goalTitle: "狼より先に動く",
          goalAction: "狼より先に動く",
          innerThoughtAction: "狼より先に動くこと",
          horizonLabel: "この先",
          horizonValue: "群れはもう無視できない距離にいる。",
        };
      }

      return {
        goalTitle: "より安全な地まで抜ける",
        goalAction: "より安全な地まで抜ける",
        innerThoughtAction: "より安全な地まで抜けること",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 2) {
      if (progress.percent < 52) {
        return {
          goalTitle: "安全な渡りを見つける",
          goalAction: "安全な渡りを見つける",
          innerThoughtAction: "安全な渡りを見つけること",
          horizonLabel: "この先",
          horizonValue: "道は橋へ向かって狭まっていて、誰かに見張られていそうだ。",
        };
      }

      return {
        goalTitle: "橋の伏兵を崩す",
        goalAction: "橋の伏兵を崩す",
        innerThoughtAction: "橋の伏兵を崩すこと",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 3) {
      if (progress.percent < 56) {
        return {
          goalTitle: "硬い地面を外さない",
          goalAction: "硬い地面を外さない",
          innerThoughtAction: "硬い地面を外さないこと",
          horizonLabel: "必要",
          horizonValue: "沼は、静かな水を浅い水だと思った者から罰してくる。",
        };
      }

      return {
        goalTitle: "潜むものをあぶり出す",
        goalAction: "潜むものをあぶり出す",
        innerThoughtAction: "潜むものをあぶり出すこと",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 4) {
      if (progress.percent < 54) {
        return {
          goalTitle: "目を付けられずに登る",
          goalAction: "目を付けられずに登る",
          innerThoughtAction: "目を付けられずに登ること",
          horizonLabel: "この先",
          horizonValue: "九十九折りの道は、高所を知り尽くした賊に見張られている。",
        };
      }

      return {
        goalTitle: "頭目の支配を崩す",
        goalAction: "頭目の支配を崩す",
        innerThoughtAction: "頭目の支配を崩すこと",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 5) {
      if (progress.percent < 52) {
        return {
          goalTitle: "崩れた一帯を読む",
          goalAction: "崩れた一帯を読む",
          innerThoughtAction: "崩れた一帯を読むこと",
          horizonLabel: "必要",
          horizonValue: "砕けた石は悪い足場や死角だけでなく、盗賊より古い何かまで隠している。",
        };
      }

      return {
        goalTitle: "遺跡で追跡者を狩る",
        goalAction: "遺跡で追跡者を狩る",
        innerThoughtAction: "遺跡で追跡者を狩ること",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 6) {
      if (progress.percent < 50) {
        return {
          goalTitle: "墓道を静かに進む",
          goalAction: "墓道を静かに進む",
          innerThoughtAction: "墓道を静かに進むこと",
          horizonLabel: "この先",
          horizonValue: "古い標が道に近すぎる。まるで見届け人を求めているみたいだ。",
        };
      }

      return {
        goalTitle: "オーガの通行料を生き延びる",
        goalAction: "オーガの通行料を生き延びる",
        innerThoughtAction: "オーガの通行料を生き延びること",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (state.bossIndex === 7) {
      if (progress.percent < 55) {
        return {
          goalTitle: "無事に尾根へ届く",
          goalAction: "無事に尾根へ届く",
          innerThoughtAction: "無事に尾根へ届くこと",
          horizonLabel: "天候",
          horizonValue: "高所の道は、風と露出した岩、それから翼ある厄介ごとばかりだ。",
        };
      }

      return {
        goalTitle: "嵐の上でワームと向き合う",
        goalAction: "嵐の上でワームと向き合う",
        innerThoughtAction: "嵐の上でワームと向き合うこと",
        horizonLabel: "区間終点",
        horizonValue: boss.name,
      };
    }

    if (progress.percent < 62) {
      const zoneName = getJourneyZoneName(state.bossIndex);
      return {
        goalTitle: condition.needsShelter
          ? `${zoneName}で身を寄せる`
          : `${zoneName}を押し通る`,
        goalAction: condition.needsShelter
          ? `${zoneName}で身を寄せる`
          : `${zoneName}を押し通る`,
        innerThoughtAction: condition.needsShelter
          ? `${zoneName}で身を寄せること`
          : `${zoneName}を押し通ること`,
        horizonLabel: condition.needsShelter ? "必要" : "この先",
        horizonValue: condition.needsShelter
          ? "道がさらに何かを求める前に、息をつける場所が要る。"
          : "道はまだ敵意を残したまま、半端にしか読めない。",
      };
    }

    return {
      goalTitle: `${boss.name}へ届く`,
      goalAction: `${boss.name}へ届く`,
      innerThoughtAction: `${boss.name}へ届くこと`,
      horizonLabel: "区間終点",
      horizonValue: boss.name,
    };
  }

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
        innerThoughtAction: "getting my bearings",
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
      if (condition.needsFood || condition.foodLow) {
        return {
          goalTitle: "Find food and steady yourself",
          goalAction: "finding food and steadying yourself",
          horizonLabel: "Need",
          horizonValue:
            condition.availableRations > 0
              ? "You have food left, but you still need to get your strength back."
              : "You need enough strength for whatever comes next.",
        };
      }

      return {
        goalTitle: "Learn the boar's ground",
        goalAction: "learning the boar's ground",
        horizonLabel: "Trail sign",
        horizonValue: "The forest is finally giving up enough signs to read the hunt properly.",
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

  if (state.bossIndex === 2) {
    if (progress.percent < 52) {
      return {
        goalTitle: "Find a safe crossing",
        goalAction: "finding a safe crossing",
        horizonLabel: "Up ahead",
        horizonValue: "The road narrows toward a bridge that somebody is probably watching.",
      };
    }

    return {
      goalTitle: "Break the bridge ambush",
      goalAction: "breaking the bridge ambush",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (state.bossIndex === 3) {
    if (progress.percent < 56) {
      return {
        goalTitle: "Keep to the firmer ground",
        goalAction: "keeping to the firmer ground",
        horizonLabel: "Need",
        horizonValue: "The marsh punishes anyone who mistakes still water for shallow water.",
      };
    }

    return {
      goalTitle: "Flush out the lurker",
      goalAction: "flushing out the lurker",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (state.bossIndex === 4) {
    if (progress.percent < 54) {
      return {
        goalTitle: "Climb without being marked",
        goalAction: "climbing without being marked",
        horizonLabel: "Up ahead",
        horizonValue: "The switchback road is watched by raiders who know the high ground better than you do.",
      };
    }

    return {
      goalTitle: "Break the captain's hold",
      goalAction: "breaking the captain's hold",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (state.bossIndex === 5) {
    if (progress.percent < 52) {
      return {
        goalTitle: "Read the ruined mile",
        goalAction: "reading the ruined mile",
        horizonLabel: "Need",
        horizonValue: "Broken stone hides bad footing, blind corners, and older things than bandits.",
      };
    }

    return {
      goalTitle: "Hunt the stalker through the ruins",
      goalAction: "hunting the stalker through the ruins",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (state.bossIndex === 6) {
    if (progress.percent < 50) {
      return {
        goalTitle: "Keep the grave road quiet",
        goalAction: "keeping the grave road quiet",
        horizonLabel: "Up ahead",
        horizonValue: "The old markers lean too close to the track, as if they want witnesses.",
      };
    }

    return {
      goalTitle: "Survive the ogre's toll",
      goalAction: "surviving the ogre's toll",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (state.bossIndex === 7) {
    if (progress.percent < 55) {
      return {
        goalTitle: "Reach the ridge in one piece",
        goalAction: "reaching the ridge in one piece",
        horizonLabel: "Weather",
        horizonValue: "The higher road is all wind, exposed stone, and trouble with wings.",
      };
    }

    return {
      goalTitle: "Face the wyrm above the storm line",
      goalAction: "facing the wyrm above the storm line",
      horizonLabel: "Stretch end",
      horizonValue: boss.name,
    };
  }

  if (progress.percent < 62) {
    return {
      goalTitle: condition.needsShelter
        ? `Reach shelter in ${getJourneyZoneName(state.bossIndex)}`
        : `Push through ${getJourneyZoneName(state.bossIndex)}`,
      goalAction: condition.needsShelter
        ? `reaching shelter in ${getJourneyZoneName(state.bossIndex).toLowerCase()}`
        : `pushing through ${getJourneyZoneName(state.bossIndex).toLowerCase()}`,
      horizonLabel: condition.needsShelter ? "Need" : "Up ahead",
      horizonValue: condition.needsShelter
        ? "You need a safer place to breathe before the road asks for more."
        : "The road still feels hostile and half-known.",
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
  if (isJourneyJapaneseLocale()) {
    if (state.status === "recovering") {
      return "今は距離よりも、立て直すことを優先したい。";
    }

    if (progressPercent < 20) return "まだようやく感覚をつかみ始めたところだ。";
    if (progressPercent < 45) return "まだ雑だけれど、少なくとも意図を持って動けている。";
    if (progressPercent < 75) return "この区間の輪郭が少しずつ見えてきた。";
    if (progressPercent < 95) return "この区間の終わりがだいぶ近く感じられる。";
    return "もうすぐこの道のりを抜けられそうだ。";
  }

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
  const innerThoughtAction = goalMeta.innerThoughtAction || goalMeta.goalAction;
  const isJa = isJourneyJapaneseLocale();

  if (state.status === "recovering") {
    return isJa
      ? `これ以上進むことを考える前に、まずは落ち着いて${innerThoughtAction}ないといけない。`
      : `I need to slow down and ${innerThoughtAction} before I even think about pushing any farther.`;
  }

  const stretchChallenge = buildJourneyStretchChallenge(state, journeyStats);

  if (stretchChallenge.successChance >= 0.74) {
    return isJa
      ? `たぶんやれる。頭を冷やしていれば、この区間がひどくなる前に${innerThoughtAction}はできるはずだ。`
      : `I think I can handle this. If I keep my head, I should manage ${innerThoughtAction} before this stretch turns ugly.`;
  }

  if (stretchChallenge.successChance >= 0.56) {
    return isJa
      ? `余裕はない。でも、集中を切らさず取り乱さなければ、たぶん${innerThoughtAction}くらいはできる。`
      : `I am not comfortable, but I can probably manage ${innerThoughtAction} if I stay focused and do not panic.`;
  }

  if (stretchChallenge.successChance >= 0.38) {
    return isJa
      ? `ずっと自分を疑ってしまう。${innerThoughtAction}はできるかもしれないけれど、ひとつ間違えれば全部だめになりそうだ。`
      : `I keep second-guessing myself. Maybe I can manage ${innerThoughtAction}, but it feels like one mistake could ruin the whole thing.`;
  }

  return isJa
    ? `かなりまずい。いまは自分の感覚すら信用しきれないし、顔を上げるたびに${innerThoughtAction}が遠のいていく気がする。`
    : `Things are not looking good. I can barely trust my own sense of direction right now, and ${innerThoughtAction} feels farther away every time I look up.`;
}

export function buildJourneyRecoveryObjective(state, journeyLevel, journeyStats) {
  const hpRatio = journeyStats.maxHp
    ? state.currentHp / journeyStats.maxHp
    : 0;
  const hungerRatio = journeyStats.maxHunger
    ? state.currentHunger / journeyStats.maxHunger
    : 0;
  const needsRest = hpRatio <= 0.22;
  const needsFood = hungerRatio <= 0.2;
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

  if (!needsRest && !needsFood) {
    if (hpRatio >= 0.7 && hungerRatio >= 0.7) {
      return `Stay tucked away near ${zoneText} a little longer, take stock of your gear, and head back out once your nerves settle.`;
    }
    if (hpRatio < 0.5) {
      return `Keep your wounds bound and stay off the open road near ${zoneText} until your strength finishes coming back.`;
    }
    if (hungerRatio < 0.55) {
      return `Eat, rest, and give your body another quiet stretch near ${zoneText} before trusting the road again.`;
    }
    return `Keep to shelter near ${zoneText} and finish recovering before you risk another hard march.`;
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

export function rememberJourneyCompletedEventKey(state, eventKey) {
  const safeKey = String(eventKey || "").trim();
  if (!safeKey) return;

  state.completedEventKeys = [
    safeKey,
    ...(Array.isArray(state.completedEventKeys) ? state.completedEventKeys : []).filter(
      (entry) => entry !== safeKey
    ),
  ].slice(0, JOURNEY_COMPLETED_EVENT_LIMIT);
}

export function buildJourneyOutcomeItems(beforeState, afterState, resolution = null) {
  const items = [];
  const addDelta = (label, value) => {
    if (!value) return;

    items.push({
      label: `${label} ${formatSignedNumber(value)}`,
      className: value > 0 ? "is-positive" : "is-negative",
    });
  };

  if (resolution) {
    if (resolution.showRollSummary !== false) {
      items.push({
        label: resolution.success ? "Succeeded" : "Failed",
        className: resolution.success ? "is-positive" : "is-negative",
      });
      items.push({
        label: `${resolution.statLabel} ${resolution.statValue}`,
        className: "is-neutral",
      });
      items.push({
        label: `Chance ${resolution.successPercent}%`,
        className: "is-neutral",
      });
    }

    if (Array.isArray(resolution.extraOutcomeItems)) {
      items.push(...resolution.extraOutcomeItems);
    }
  }

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

  const beforeBonusIds = new Set(
    (beforeState.permanentBonuses || []).map((entry) => entry.id)
  );
  const gainedBonuses = (afterState.permanentBonuses || []).filter(
    (entry) => !beforeBonusIds.has(entry.id)
  );
  for (const bonus of gainedBonuses) {
    const statLabel = JOURNEY_STAT_META[bonus.statKey]?.label || "Stat";
    items.push({
      label: `Boon: ${bonus.title} (${statLabel} ${formatSignedNumber(bonus.amount)})`,
      className: bonus.amount > 0 ? "is-positive" : "is-negative",
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
    if (state.pendingEvents.some((eventEntry) => eventEntry.kind === "boss")) {
      break;
    }

    const sliceMs = Math.min(JOURNEY_TICK_MS, remainingMs);
    const nextCursor = new Date(cursor.getTime() + sliceMs);
    const hours = sliceMs / (1000 * 60 * 60);

    if (state.status === "recovering") {
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
        state.recoveryStartedAt = null;
        state.recoveryObjective = "";
        state.aidUrgency = Math.max(0, state.aidUrgency - 1);
        state.currentHp = Math.max(state.currentHp, journeyStats.maxHp * 0.46);
        state.currentHunger = Math.max(
          state.currentHunger,
          journeyStats.maxHunger * 0.56
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
        state.totalDistance >= getJourneyBossThreshold(state.bossIndex)
      ) {
        if (state.pendingEvents.length) {
          break;
        }

        if (supportsJourneyBossBattle(state)) {
          queueJourneyStretchBossBattle(state, journeyStats, nextCursor);
          break;
        }

        resolveJourneyBoss(state, journeyStats, nextCursor);
      }

      if (state.pendingEvents.length) {
        if (state.pendingEvents.some((eventEntry) => eventEntry.kind === "boss")) {
          break;
        }
        cursor = nextCursor;
        remainingMs -= sliceMs;
        continue;
      }

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
    if (!eventEntry.repeatable) {
      rememberJourneyCompletedEventKey(state, eventEntry.eventKey || eventEntry.title);
    }

    if (eventEntry.kind === "aid") {
      state.aidUrgency = Math.max(0, state.aidUrgency - 2);
    }

    if (state.status !== "adventuring") {
      break;
    }
  }
}

export function supportsJourneyBossBattle(state) {
  return Math.max(0, Math.floor(Number(state?.bossIndex) || 0)) <= 1;
}

export function queueJourneyStretchBossBattle(state, journeyStats, atDate) {
  const nextEvent = buildJourneyStretchBossBattleEvent(state, journeyStats, atDate);
  if (!nextEvent) {
    resolveJourneyBoss(state, journeyStats, atDate);
    return null;
  }

  state.totalDistance = getJourneyBossThreshold(state.bossIndex);
  state.pendingEvents = [nextEvent];
  addJourneyLog(
    state,
    `The road closes in around ${nextEvent.title}. This stretch will not move until the fight is settled.`,
    atDate.toISOString()
  );
  return nextEvent;
}

export function resolveJourneyBossBattleTurn(
  state,
  eventEntry,
  choice,
  journeyStats,
  atIso
) {
  const atDate = new Date(atIso);
  const battle = eventEntry?.battle;
  const boss = getJourneyBoss(state.bossIndex);
  const profile = getJourneyBossBattleProfile(state.bossIndex, boss, journeyStats);
  const currentTurn = getJourneyBossBattleTurnProfile(profile, battle?.turn);
  const move = currentTurn?.moves.find((entry) => entry.key === choice?.id);

  if (!battle || !profile || !move) {
    return null;
  }

  const statKey = JOURNEY_STAT_META[move.statKey] ? move.statKey : "resolve";
  const statValue = Math.max(0, Number(journeyStats?.stats?.[statKey]) || 0);
  const successChance = getJourneyChoiceSuccessChance(choice, journeyStats);
  const successRoll = Math.random();
  const success = successRoll <= successChance;
  const bossDamage = Math.max(
    success ? 14 : 8,
    Math.round(
      (success ? move.bossDamage.successBase : move.bossDamage.failBase) +
        statValue * (success ? move.bossDamage.successPerStat : move.bossDamage.failPerStat) +
        randomInt(0, success ? 4 : 2)
    )
  );
  const incomingDamage = Math.max(
    success ? 3 : 7,
    Math.round(
      (success ? move.selfDamage.successBase : move.selfDamage.failBase) +
        battle.turn * profile.turnPressure -
        statValue * move.selfDamage.reductionPerStat
    )
  );
  const bossHpBefore = battle.bossHp;
  const hpBefore = state.currentHp;
  const hungerBefore = state.currentHunger;

  battle.bossHp = clamp(
    battle.bossHp - bossDamage,
    0,
    battle.bossMaxHp || JOURNEY_BOSS_BATTLE_MAX_HP
  );
  state.currentHp = clamp(state.currentHp - incomingDamage, 0, journeyStats.maxHp);
  state.currentHunger = clamp(
    state.currentHunger - profile.turnHungerCost,
    0,
    journeyStats.maxHunger
  );
  battle.heroHp = Math.round(state.currentHp);
  battle.heroMaxHp = Math.round(journeyStats.maxHp);
  battle.lastBossDamage = Math.round(bossHpBefore - battle.bossHp);
  battle.lastHeroDamage = Math.round(hpBefore - state.currentHp);
  battle.weaponLabel = journeyStats?.equippedWeaponMeta?.label || "";
  battle.heroBattleNote = buildJourneyBossBattleLoadoutNote(state.bossIndex, journeyStats);

  const bossHpPercent = getJourneyBossBattlePercent(battle.bossHp, battle.bossMaxHp);
  const heroHpPercent = getJourneyBossBattlePercent(
    state.currentHp,
    journeyStats.maxHp
  );
  const bossConditionText = describeJourneyBattleCondition(bossHpPercent, "enemy");
  const heroConditionText = describeJourneyBattleCondition(heroHpPercent, "hero");
  const turnText = success ? move.successText : move.failureText;
  const exchangeText = `${turnText} ${profile.counterText(
    battle.turn,
    bossConditionText,
    heroConditionText
  )}`.trim();
  const beforeState = normalizeJourneyState({
    ...state,
    currentHp: hpBefore,
    currentHunger: hungerBefore,
    pendingEvents: [],
    debugHistory: [],
  });

  let finalOutcome = "continue";
  let battleResultText = `${exchangeText} ${buildJourneyBossBattleStatusText(
    battle,
    state,
    journeyStats
  )}`.trim();

  if (battle.bossHp <= 0) {
    finalOutcome = "defeated";
  } else if (state.currentHp <= 0) {
    finalOutcome = "lost";
  } else if (battle.turn >= battle.maxTurns) {
    finalOutcome = heroHpPercent > bossHpPercent ? "outlasted" : "lost";
  }

  const resolution = {
    success,
    statKey,
    statLabel: JOURNEY_STAT_META[statKey].label,
    statValue,
    successChance,
    successPercent: Math.round(successChance * 100),
    successRoll,
    resultText: battleResultText,
    showRollSummary: false,
    extraOutcomeItems: [
      {
        label: `${JOURNEY_STAT_META[statKey].label} check ${
          success ? "succeeded" : "failed"
        }`,
        className: success ? "is-positive" : "is-negative",
      },
      {
        label: `${boss.name}: ${bossConditionText}`,
        className: battle.bossHp <= 0 ? "is-positive" : "is-neutral",
      },
      {
        label: `You: ${heroConditionText}`,
        className: state.currentHp <= 0 ? "is-negative" : "is-neutral",
      },
      {
        label: `Damage dealt ${Math.round(bossHpBefore - battle.bossHp)}`,
        className: "is-positive",
      },
      {
        label: `Damage taken ${Math.round(hpBefore - state.currentHp)}`,
        className: "is-negative",
      },
    ],
  };

  if (finalOutcome === "continue") {
    battle.turn += 1;
    battle.lastExchange = exchangeText;
    const updatedEvent = buildJourneyStretchBossBattleEvent(
      state,
      journeyStats,
      atDate,
      eventEntry,
      battle
    );
    state.pendingEvents = updatedEvent ? [updatedEvent] : [];
    addJourneyLog(state, exchangeText, atIso);
    return {
      beforeState,
      resolution,
      eventEntry,
      updatedEvent,
      finished: false,
    };
  }

  state.pendingEvents = [];

  if (finalOutcome === "defeated" || finalOutcome === "outlasted") {
    const outcomeText = resolveJourneyBossBattleVictory(
      state,
      journeyStats,
      atDate,
      boss,
      finalOutcome
    );
    battleResultText = outcomeText;
    resolution.resultText = battleResultText;
    resolution.outcomeMeta =
      finalOutcome === "defeated" ? "Boss defeated" : "Boss driven off";
    resolution.extraOutcomeItems = [
      {
        label:
          finalOutcome === "defeated" ? "Boss defeated" : "Boss driven off",
        className: "is-positive",
      },
      {
        label: `${JOURNEY_STAT_META[statKey].label} check ${
          success ? "succeeded" : "failed"
        }`,
        className: success ? "is-positive" : "is-negative",
      },
      {
        label: `You: ${describeJourneyBattleCondition(
          getJourneyBossBattlePercent(state.currentHp, journeyStats.maxHp),
          "hero"
        )}`,
        className: "is-neutral",
      },
    ];
    startJourneyEventCooldown(state, atDate);
  } else {
    const outcomeText = resolveJourneyBossBattleLoss(state, journeyStats, atDate, boss);
    battleResultText = outcomeText;
    resolution.resultText = battleResultText;
    resolution.outcomeMeta = "Forced to retreat";
    resolution.extraOutcomeItems = [
      {
        label: "Forced to retreat",
        className: "is-negative",
      },
      {
        label: `${JOURNEY_STAT_META[statKey].label} check ${
          success ? "succeeded" : "failed"
        }`,
        className: success ? "is-positive" : "is-negative",
      },
      {
        label: `You: ${describeJourneyBattleCondition(
          getJourneyBossBattlePercent(state.currentHp, journeyStats.maxHp),
          "hero"
        )}`,
        className: "is-neutral",
      },
    ];
  }

  return {
    beforeState,
    resolution,
    eventEntry,
    updatedEvent: null,
    finished: true,
  };
}

function buildJourneyStretchBossBattleEvent(
  state,
  journeyStats,
  atDate,
  existingEvent = null,
  existingBattle = null
) {
  const boss = getJourneyBoss(state.bossIndex);
  const profile = getJourneyBossBattleProfile(state.bossIndex, boss, journeyStats);
  if (!profile) return null;

  const battle = existingBattle
    ? {
        ...existingBattle,
        bossHp: clamp(
          existingBattle.bossHp,
          0,
          existingBattle.bossMaxHp || JOURNEY_BOSS_BATTLE_MAX_HP
        ),
        heroHp: Math.round(state.currentHp),
        heroMaxHp: Math.round(journeyStats.maxHp),
        lastBossDamage: Math.max(0, Math.round(Number(existingBattle.lastBossDamage) || 0)),
        lastHeroDamage: Math.max(0, Math.round(Number(existingBattle.lastHeroDamage) || 0)),
        weaponLabel: journeyStats?.equippedWeaponMeta?.label || "",
        heroBattleNote: buildJourneyBossBattleLoadoutNote(state.bossIndex, journeyStats),
      }
    : {
        bossIndex: state.bossIndex,
        bossName: boss.name,
        turn: 1,
        maxTurns: JOURNEY_BOSS_BATTLE_TURN_LIMIT,
        bossHp: JOURNEY_BOSS_BATTLE_MAX_HP,
        bossMaxHp: JOURNEY_BOSS_BATTLE_MAX_HP,
        heroHp: Math.round(state.currentHp),
        heroMaxHp: Math.round(journeyStats.maxHp),
        lastBossDamage: 0,
        lastHeroDamage: 0,
        weaponLabel: journeyStats?.equippedWeaponMeta?.label || "",
        heroBattleNote: buildJourneyBossBattleLoadoutNote(state.bossIndex, journeyStats),
        intro: profile.intro,
        opening: profile.opening,
        lastExchange: "",
      };
  const currentTurn = getJourneyBossBattleTurnProfile(profile, battle.turn);
  if (!currentTurn) return null;
  const detail = buildJourneyBossBattleDetail(battle, profile);
  const bossHpPercent = getJourneyBossBattlePercent(battle.bossHp, battle.bossMaxHp);
  const heroHpPercent = getJourneyBossBattlePercent(
    battle.heroHp ?? state.currentHp,
    battle.heroMaxHp ?? journeyStats.maxHp
  );

  return normalizeJourneyEvent(
    {
      id: existingEvent?.id,
      eventKey: `boss:${state.bossIndex}`,
      kind: "boss",
      repeatable: false,
      title: boss.name,
      teaser: `Turn ${battle.turn}/${battle.maxTurns} • Boss ${bossHpPercent}% HP • You ${heroHpPercent}% HP`,
      detail,
      createdAt: existingEvent?.createdAt || atDate.toISOString(),
      battle,
      choices: currentTurn.moves.map((move) => ({
        id: move.key,
        label: move.label,
        preview: move.preview,
        highlightWord: move.highlightWord,
        statKey: move.statKey,
        chanceBase: move.chanceBase,
        chancePerStat: move.chancePerStat,
        minChance: move.minChance,
        maxChance: move.maxChance,
        successText: move.successText,
        failureText: move.failureText,
        successEffects: {},
        failureEffects: {},
      })),
    },
    atDate.toISOString()
  );
}

function buildJourneyBossBattleDetail(battle, profile) {
  const currentTurn = getJourneyBossBattleTurnProfile(profile, battle.turn);
  if (!currentTurn) {
    return `${battle.bossName} is still blocking the road.`;
  }
  const leadText =
    battle.turn === 1
      ? `${battle.intro} ${battle.opening} ${currentTurn.scene}`
      : `${battle.lastExchange || profile.opening} ${currentTurn.scene}`;

  return [leadText, currentTurn.prompt, battle.heroBattleNote].filter(Boolean).join(" ");
}

function buildJourneyBossBattleStatusText(battle, state, journeyStats) {
  const bossHpPercent = getJourneyBossBattlePercent(battle.bossHp, battle.bossMaxHp);
  const heroHpPercent = getJourneyBossBattlePercent(state.currentHp, journeyStats.maxHp);

  if (battle.bossHp <= 0) {
    return `${battle.bossName} crashes down before it can recover.`;
  }

  if (state.currentHp <= 0) {
    return `The hit drops you before the road breaks your way.`;
  }

  if (battle.turn >= battle.maxTurns) {
    return heroHpPercent > bossHpPercent
      ? `${battle.bossName} finally gives ground.`
      : `${battle.bossName} is still winning this exchange.`;
  }

  return `Both of you are still in it, and the next clean hit could swing the road.`;
}

function buildJourneyBossBattleLoadoutNote(bossIndex, journeyStats) {
  const weaponLabel = String(journeyStats?.equippedWeaponMeta?.label || "").trim();

  if (weaponLabel) {
    return bossIndex === 0
      ? `You keep ${weaponLabel} ready and wait for one clean opening.`
      : `You keep ${weaponLabel} ready and look for the next opening.`;
  }

  return bossIndex === 0
    ? "You have no proper weapon, so every opening has to come from timing, footing, and nerve."
    : "You are fighting without a proper weapon, so space and timing matter more than ever.";
}

function resolveJourneyBossBattleVictory(
  state,
  journeyStats,
  atDate,
  boss,
  finalOutcome
) {
  const clearedZoneName = getJourneyZoneName(state.bossIndex);
  const resultVerb =
    finalOutcome === "defeated" ? `defeating ${boss.name}` : `driving ${boss.name} off`;

  state.bossIndex += 1;
  state.storyXp += state.bossIndex === 1 ? 24 : 16;
  state.bonusSkillPoints += 1;
  state.aidUrgency = Math.max(0, state.aidUrgency - 1);

  const rewardText = applyJourneyVictoryRewards(state, journeyStats.level, atDate);
  addJourneyRoadClear(
    state,
    clearedZoneName,
    `Cleared by ${resultVerb}. The road opened into ${getJourneyZoneName(
      state.bossIndex
    )}.`,
    atDate.toISOString()
  );

  if (state.bossIndex === 1) {
    state.storyFlags.boarDefeated = true;
    state.bonusRations += 1;
  }

  const victoryText =
    finalOutcome === "defeated"
      ? `You bring ${boss.name} down and clear the stretch. You finish the fight ${describeJourneyBattleCondition(
          getJourneyBossBattlePercent(state.currentHp, journeyStats.maxHp),
          "hero"
        )}. Rewards: ${rewardText}.`
      : `You outlast ${boss.name} and force it to back off. You finish the fight ${describeJourneyBattleCondition(
          getJourneyBossBattlePercent(state.currentHp, journeyStats.maxHp),
          "hero"
        )}. Rewards: ${rewardText}.`;
  addJourneyLog(state, victoryText, atDate.toISOString());
  return victoryText;
}

function resolveJourneyBossBattleLoss(state, journeyStats, atDate, boss) {
  state.totalDistance = Math.max(
    getJourneySegmentStartDistance(state.bossIndex) +
      Math.round(getJourneyStretchDistance(state.bossIndex) * 0.22),
    state.totalDistance - randomInt(18, 34)
  );
  state.currentHp = Math.max(
    1,
    Math.round(journeyStats.maxHp * JOURNEY_STRETCH_FAILURE_HP_RATIO)
  );
  state.currentHunger = Math.min(
    clamp(state.currentHunger - randomInt(14, 24), 0, journeyStats.maxHunger),
    Math.round(journeyStats.maxHunger * 0.28)
  );
  state.storyXp += 4;
  const defeatText = `${boss.name} overwhelms you before the stretch breaks, and you have to fall back in rough shape.`;
  addJourneyLog(state, defeatText, atDate.toISOString());
  sendJourneyToTown(
    state,
    atDate,
    `Recovering after ${boss.name}.`,
    5,
    9,
    journeyStats.level,
    journeyStats
  );
  return `${defeatText} You are forced into recovery before you can try again.`;
}

function getJourneyBossBattleProfile(bossIndex, boss, journeyStats = null) {
  const hasWeapon = Boolean(journeyStats?.equippedWeaponMeta);

  if (bossIndex === 0) {
    return {
      intro:
        "The thick undergrowth bursts open and a huge boar charges low, all muscle, mud, and broken tusk.",
      opening:
        "There is no more road beyond this point until one of you gives way.",
      turnPressure: 1.5,
      turnHungerCost: 2,
      counterText: () =>
        "The boar wheels hard in the mud and comes again before the trail settles.",
      turns: [
        {
          scene:
            "The boar tears straight down the middle of the trail, flattening young trees as it commits to the first charge.",
          prompt:
            "This first clash is about surviving the rush and taking control before it owns the whole path.",
          moves: [
            {
              key: "boar:shoulder-cut",
              label: hasWeapon
                ? "Slide wide and cut behind the shoulder"
                : "Slide wide and smash into its shoulder",
              preview: "Use footwork and timing to punish the charge.",
              highlightWord: hasWeapon ? "cut" : "smash",
              statKey: "finesse",
              chanceBase: 0.38,
              chancePerStat: 0.05,
              minChance: 0.26,
              maxChance: 0.86,
              bossDamage: { successBase: 27, successPerStat: 2.3, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 8, failBase: 16, reductionPerStat: 0.55 },
              successText:
                hasWeapon
                  ? "You slip outside the tusks and cut deep behind the shoulder before the boar can turn."
                  : "You slip outside the tusks and hammer into its shoulder before the boar can turn.",
              failureText:
                hasWeapon
                  ? "You almost clear the tusks, but the boar clips you and your hit lands shallow."
                  : "You almost clear the tusks, but the boar clips you and your hit glances off.",
            },
            {
              key: "boar:brace-thrust",
              label: hasWeapon
                ? "Brace low and drive straight into the charge"
                : "Brace low and crash into the charge",
              preview: "Meet force with force and try to stop it cold.",
              highlightWord: "Brace",
              statKey: "might",
              chanceBase: 0.34,
              chancePerStat: 0.05,
              minChance: 0.24,
              maxChance: 0.82,
              bossDamage: { successBase: 31, successPerStat: 2.5, failBase: 12, failPerStat: 1 },
              selfDamage: { successBase: 10, failBase: 18, reductionPerStat: 0.48 },
              successText:
                hasWeapon
                  ? "You plant your feet and drive your weapon in hard enough to send the boar screaming past."
                  : "You plant your feet and slam into the rush hard enough to throw the boar off line.",
              failureText:
                hasWeapon
                  ? "The impact lands uglier than planned. You hurt it, but the charge tears through your guard."
                  : "The impact lands uglier than planned. You check the rush, but it tears through your guard anyway.",
            },
            {
              key: "boar:root-feint",
              label: hasWeapon
                ? "Bait it across the roots and strike when it stumbles"
                : "Bait it across the roots and hit when it stumbles",
              preview: "Keep your nerve and make the ground fight for you.",
              highlightWord: "Bait",
              statKey: "resolve",
              chanceBase: 0.4,
              chancePerStat: 0.045,
              minChance: 0.3,
              maxChance: 0.84,
              bossDamage: { successBase: 24, successPerStat: 2.1, failBase: 9, failPerStat: 0.7 },
              selfDamage: { successBase: 7, failBase: 14, reductionPerStat: 0.58 },
              successText:
                hasWeapon
                  ? "You hold your nerve, the boar hits the roots wrong, and you strike as it loses its footing."
                  : "You hold your nerve, the boar hits the roots wrong, and you crash into it as it loses its footing.",
              failureText:
                "You wait a beat too long and the boar blows through the trap before you can turn it.",
            },
          ],
        },
        {
          scene:
            "Blood and foam streak the boar's jaw now, and it starts circling tighter through the mud instead of charging in a straight line.",
          prompt:
            "The next clash is uglier. You need to break its balance before it keeps pushing you around at close range.",
          moves: [
            {
              key: "boar:eye-dust",
              label: hasWeapon
                ? "Kick dirt high and strike through the opening"
                : "Kick dirt high and drive in while it blinks",
              preview: "Create a split-second blind spot and use it.",
              highlightWord: hasWeapon ? "strike" : "blinks",
              statKey: "finesse",
              chanceBase: 0.36,
              chancePerStat: 0.05,
              minChance: 0.25,
              maxChance: 0.84,
              bossDamage: { successBase: 25, successPerStat: 2.2, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 8, failBase: 15, reductionPerStat: 0.55 },
              successText:
                hasWeapon
                  ? "Dirt flashes into its face and your strike lands in the opening."
                  : "Dirt flashes into its face and you drive in before it can recover.",
              failureText:
                "The dirt buys less than you hoped, and the boar shoulders you backward.",
            },
            {
              key: "boar:jaw-hook",
              label: "Catch the tusk line and wrench its head aside",
              preview: "Turn the weight of the beast off-center with raw force.",
              highlightWord: "wrench",
              statKey: "might",
              chanceBase: 0.33,
              chancePerStat: 0.05,
              minChance: 0.22,
              maxChance: 0.8,
              bossDamage: { successBase: 30, successPerStat: 2.4, failBase: 11, failPerStat: 0.9 },
              selfDamage: { successBase: 11, failBase: 18, reductionPerStat: 0.46 },
              successText:
                "You catch the tusk line at the right instant and wrench the boar hard off its own charge.",
              failureText:
                "You get hands on it, but not enough leverage. The boar rips free and drags you with it.",
            },
            {
              key: "boar:tree-line",
              label: "Give ground and pin it against the tree line",
              preview: "Stay calm, cede space, then trap the rebound.",
              highlightWord: "trap",
              statKey: "resolve",
              chanceBase: 0.39,
              chancePerStat: 0.045,
              minChance: 0.29,
              maxChance: 0.84,
              bossDamage: { successBase: 23, successPerStat: 2, failBase: 9, failPerStat: 0.7 },
              selfDamage: { successBase: 7, failBase: 14, reductionPerStat: 0.58 },
              successText:
                "You give it just enough lane to overcommit into the trees, then hammer the rebound.",
              failureText:
                "You sell the retreat, but the boar keeps its footing and crashes into you before the trap closes.",
            },
          ],
        },
        {
          scene:
            "The whole trail is churned into mud, the boar breathing hard and still hunting for one last clean charge.",
          prompt:
            "This last exchange decides the road. Finish it cleanly or leave it in worse shape than you and make it back off.",
          moves: [
            {
              key: "boar:hamstring-finish",
              label: hasWeapon
                ? "Cut low and take its drive away"
                : "Sweep low and take its drive away",
              preview: "A technical finish aimed at ending the charge for good.",
              highlightWord: hasWeapon ? "Cut" : "Sweep",
              statKey: "finesse",
              chanceBase: 0.37,
              chancePerStat: 0.05,
              minChance: 0.26,
              maxChance: 0.84,
              bossDamage: { successBase: 29, successPerStat: 2.3, failBase: 11, failPerStat: 0.8 },
              selfDamage: { successBase: 8, failBase: 15, reductionPerStat: 0.56 },
              successText:
                hasWeapon
                  ? "You go low at the right moment and tear the drive out of its back leg."
                  : "You go low at the right moment and smash through its leg, stealing the rush.",
              failureText:
                "You go low, but not low enough. The boar clips you hard on the way through.",
            },
            {
              key: "boar:front-on-break",
              label: "Meet the final rush and break it head-on",
              preview: "Trust your body for one decisive answer.",
              highlightWord: "break",
              statKey: "vitality",
              chanceBase: 0.35,
              chancePerStat: 0.05,
              minChance: 0.24,
              maxChance: 0.81,
              bossDamage: { successBase: 32, successPerStat: 2.5, failBase: 12, failPerStat: 0.9 },
              selfDamage: { successBase: 10, failBase: 18, reductionPerStat: 0.48 },
              successText:
                "You absorb the last rush without folding and hit back hard enough to break its momentum for good.",
              failureText:
                "You stand into it, but the final rush lands like a falling tree and costs you more than planned.",
            },
            {
              key: "boar:blood-scent",
              label: "Hold your ground until it feels your nerve",
              preview: "Make the beast doubt the trade before it commits.",
              highlightWord: "nerve",
              statKey: "resolve",
              chanceBase: 0.41,
              chancePerStat: 0.045,
              minChance: 0.3,
              maxChance: 0.85,
              bossDamage: { successBase: 24, successPerStat: 2.1, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 7, failBase: 14, reductionPerStat: 0.6 },
              successText:
                "You refuse to flinch. When the boar finally commits, the opening is small but enough.",
              failureText:
                "You hold, but the boar reads weakness in the moment and the collision gets ugly.",
            },
          ],
        },
      ],
    };
  }

  if (bossIndex === 1) {
    return {
      intro:
        "The wolves do not rush all at once. They fan out, testing the edges of the path until the alpha steps into view.",
      opening:
        "This stretch becomes a three-turn contest of space, nerve, and who gets to decide the shape of the pack.",
      turnPressure: 1.8,
      turnHungerCost: 2,
      counterText: () =>
        "The pack shifts again around the alpha, testing whether you are finally ready to break.",
      turns: [
        {
          scene:
            "They start wide, paws silent in the undergrowth, every pair of eyes waiting to see if you give them an easy opening.",
          prompt:
            "This first clash is about stopping the surround before the pack shapes the whole fight.",
          moves: [
            {
              key: "wolves:break-alpha",
              label: "Hit the alpha before the pack closes",
              preview: "A hard opening can shake the rest of them loose.",
              highlightWord: "alpha",
              statKey: "might",
              chanceBase: 0.33,
              chancePerStat: 0.05,
              minChance: 0.22,
              maxChance: 0.8,
              bossDamage: { successBase: 30, successPerStat: 2.4, failBase: 11, failPerStat: 0.8 },
              selfDamage: { successBase: 11, failBase: 18, reductionPerStat: 0.44 },
              successText:
                "You hammer into the lead wolf before the rest can commit, forcing the alpha to yelp and recoil instead of leading the crush.",
              failureText:
                "You reach the alpha, but not cleanly enough. The rest of the pack crashes into the exchange before you can reset.",
            },
            {
              key: "wolves:high-ground",
              label: "Take the stones and cut their angles away",
              preview: "Use positioning to keep the pack from owning the lane.",
              highlightWord: "angles",
              statKey: "finesse",
              chanceBase: 0.39,
              chancePerStat: 0.05,
              minChance: 0.28,
              maxChance: 0.86,
              bossDamage: { successBase: 25, successPerStat: 2.2, failBase: 10, failPerStat: 0.7 },
              selfDamage: { successBase: 8, failBase: 15, reductionPerStat: 0.58 },
              successText:
                "You hop the stones, steal the better footing, and cut every lunge into a narrower, bloodier approach than the pack wanted.",
              failureText:
                "You almost find the high line, but loose rock gives under you and the wolves get a bite at your flank before you recover.",
            },
            {
              key: "wolves:fire-line",
              label: "Use flame and noise to split the charge",
              preview: "Break their rhythm before they decide yours.",
              highlightWord: "split",
              statKey: "arcana",
              chanceBase: 0.36,
              chancePerStat: 0.05,
              minChance: 0.24,
              maxChance: 0.84,
              bossDamage: { successBase: 26, successPerStat: 2.3, failBase: 9, failPerStat: 0.8 },
              selfDamage: { successBase: 9, failBase: 16, reductionPerStat: 0.5 },
              successText:
                "Light, sparks, and a hard shout hit together. The pack splits at the wrong moment and the alpha takes the worst of it.",
              failureText:
                "The flare goes wide and only startles them for a breath. It still buys a cut, but not the clean break you needed.",
            },
          ],
        },
        {
          scene:
            "The alpha stops testing now and starts directing, trying to herd you toward the softer ground where the others can commit together.",
          prompt:
            "Now you need to break their coordination before the full circle closes around you.",
          moves: [
            {
              key: "wolves:callout",
              label: "Roar back and challenge the alpha's lead",
              preview: "Make the pack hesitate for one precious beat.",
              highlightWord: "challenge",
              statKey: "resolve",
              chanceBase: 0.38,
              chancePerStat: 0.045,
              minChance: 0.28,
              maxChance: 0.84,
              bossDamage: { successBase: 24, successPerStat: 2.1, failBase: 9, failPerStat: 0.7 },
              selfDamage: { successBase: 8, failBase: 14, reductionPerStat: 0.58 },
              successText:
                "You answer the alpha with enough force that the whole pack hesitates, and that single beat gives you a bloody opening.",
              failureText:
                "You try to seize the sound of the fight, but the pack hears only strain and surges harder into you.",
            },
            {
              key: "wolves:tree-pivot",
              label: "Use the trees to force them into single-file lunges",
              preview: "Turn the brush into a choke point.",
              highlightWord: "single-file",
              statKey: "finesse",
              chanceBase: 0.4,
              chancePerStat: 0.05,
              minChance: 0.29,
              maxChance: 0.86,
              bossDamage: { successBase: 26, successPerStat: 2.2, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 7, failBase: 14, reductionPerStat: 0.6 },
              successText:
                "You pivot through the trees and turn the pack's numbers against itself, cutting the front lunges before the rear can join them.",
              failureText:
                "You try to thread the trunks, but one wolf beats you to the turn and the rest pile pressure in behind it.",
            },
            {
              key: "wolves:hard-kick",
              label: "Cripple the nearest wolf and break their spacing",
              preview: "A brutal answer meant to reopen the lane.",
              highlightWord: "break",
              statKey: "might",
              chanceBase: 0.34,
              chancePerStat: 0.05,
              minChance: 0.23,
              maxChance: 0.81,
              bossDamage: { successBase: 29, successPerStat: 2.4, failBase: 11, failPerStat: 0.8 },
              selfDamage: { successBase: 10, failBase: 17, reductionPerStat: 0.46 },
              successText:
                "You smash the nearest wolf out of the line hard enough to ruin the pack's spacing and draw the alpha into a worse angle.",
              failureText:
                "You hit one of them hard, but not hard enough to stop the rest from folding into the gap around you.",
            },
          ],
        },
        {
          scene:
            "The alpha is showing blood now, but it keeps circling for one last clean opening while the rest look ready to follow or bolt on its lead.",
          prompt:
            "This is the deciding moment. End the alpha, scare it off, or it will keep the stretch closed.",
          moves: [
            {
              key: "wolves:finish-alpha",
              label: "Sprint the alpha and end the lead outright",
              preview: "A direct finish before the pack can reset behind it.",
              highlightWord: "end",
              statKey: "might",
              chanceBase: 0.34,
              chancePerStat: 0.05,
              minChance: 0.23,
              maxChance: 0.8,
              bossDamage: { successBase: 31, successPerStat: 2.5, failBase: 11, failPerStat: 0.9 },
              selfDamage: { successBase: 11, failBase: 18, reductionPerStat: 0.45 },
              successText:
                "You explode straight through the thin space around the alpha and turn the whole pack's attention into a losing scramble.",
              failureText:
                "You commit to the finish, but the pack sees it and the answer comes from three bodies at once.",
            },
            {
              key: "wolves:scar-line",
              label: "Cut a long scar across the leader and stand firm",
              preview: "Make the alpha feel that you can still win the trade.",
              highlightWord: "firm",
              statKey: "resolve",
              chanceBase: 0.4,
              chancePerStat: 0.045,
              minChance: 0.3,
              maxChance: 0.85,
              bossDamage: { successBase: 25, successPerStat: 2.1, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 8, failBase: 14, reductionPerStat: 0.6 },
              successText:
                "You mark the alpha deep and refuse to yield a single step, forcing the whole pack to read the cost of one more rush.",
              failureText:
                "You land the cut, but the stand costs you and the wolves keep pressing like they still own the ground.",
            },
            {
              key: "wolves:flare-finish",
              label: "Throw the last flare into their retreat line",
              preview: "Blind, split, and make the choice to stay feel wrong.",
              highlightWord: "split",
              statKey: "arcana",
              chanceBase: 0.37,
              chancePerStat: 0.05,
              minChance: 0.26,
              maxChance: 0.84,
              bossDamage: { successBase: 27, successPerStat: 2.3, failBase: 10, failPerStat: 0.8 },
              selfDamage: { successBase: 9, failBase: 15, reductionPerStat: 0.52 },
              successText:
                "The last flare bursts exactly where the pack wants to wheel, and the panic that follows leaves the alpha exposed and unsure.",
              failureText:
                "The flare lands close, but not close enough. The wolves flinch, then come on through the light anyway.",
            },
          ],
        },
      ],
    };
  }

  return null;
}

function getJourneyBossBattleTurnProfile(profile, turn) {
  if (!profile?.turns?.length) return null;
  const safeIndex = Math.max(0, Math.min(profile.turns.length - 1, Number(turn || 1) - 1));
  return profile.turns[safeIndex];
}

function describeJourneyBattleCondition(percent, role = "enemy") {
  const safePercent = clamp(Number(percent) || 0, 0, 100);

  if (role === "hero") {
    if (safePercent <= 0) return "down";
    if (safePercent <= 15) return "about to collapse";
    if (safePercent <= 30) return "barely standing";
    if (safePercent <= 50) return "badly hurt";
    if (safePercent <= 70) return "somewhat injured";
    if (safePercent <= 90) return "steady";
    return "in control";
  }

  if (safePercent <= 0) return "down";
  if (safePercent <= 15) return "about to collapse";
  if (safePercent <= 30) return "barely standing";
  if (safePercent <= 50) return "badly wounded";
  if (safePercent <= 70) return "clearly hurt";
  if (safePercent <= 90) return "dangerous";
  return "strong";
}

function getJourneyBossBattlePercent(current, max) {
  return Math.round((Math.max(0, current) / Math.max(1, max)) * 100);
}

export function startJourneyEventCooldown(
  state,
  atDate,
  minHours = JOURNEY_EVENT_COOLDOWN_MIN_HOURS,
  maxHours = JOURNEY_EVENT_COOLDOWN_MAX_HOURS
) {
  state.nextEventAt = new Date(
    atDate.getTime() + randomInt(minHours, maxHours) * 60 * 60 * 1000
  ).toISOString();
}

export function resolveJourneyBoss(state, journeyStats, atDate) {
  const boss = getJourneyBoss(state.bossIndex);
  const stretchChallenge = buildJourneyStretchChallenge(state, journeyStats);
  const success = Math.random() < stretchChallenge.successChance;
  const clearedZoneName = getJourneyZoneName(state.bossIndex);

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
    startJourneyEventCooldown(state, atDate);
    addJourneyRoadClear(
      state,
      clearedZoneName,
      `Cleared by defeating ${boss.name}. The road opened into ${getJourneyZoneName(
        state.bossIndex
      )}.`,
      atDate.toISOString()
    );

    if (state.bossIndex === 1) {
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
    getJourneySegmentStartDistance(state.bossIndex) +
      Math.round(getJourneyStretchDistance(state.bossIndex) * 0.22),
    state.totalDistance - randomInt(18, 34)
  );
  state.currentHp = Math.max(
    1,
    Math.round(journeyStats.maxHp * JOURNEY_STRETCH_FAILURE_HP_RATIO)
  );
  state.currentHunger = Math.min(
    clamp(state.currentHunger - randomInt(14, 24), 0, journeyStats.maxHunger),
    Math.round(journeyStats.maxHunger * 0.28)
  );
  state.storyXp += 4;
  addJourneyLog(
    state,
    `${boss.name} drove you back and left you barely standing. The stretch only gave you about a ${stretchChallenge.successPercent}% shot and it went bad fast.`,
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
    state.currentHp = clamp(
      state.currentHp + scaleJourneyEventHpDelta(-12),
      0,
      journeyStats.maxHp
    );
    addJourneyLog(
      state,
      "You mistook a pale slime for something edible. It sapped the life out of you and left you permanently weaker.",
      atDate.toISOString()
    );
    return;
  }

  if (journeyContext?.neglectScore >= 3 && incidentRoll < 0.14) {
    state.currentHp = clamp(
      state.currentHp + scaleJourneyEventHpDelta(-8),
      0,
      journeyStats.maxHp
    );
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
      JOURNEY_TRAVELER_AID_LOG,
      atDate.toISOString()
    );
  }
}

export function maybeQueueJourneyEvent(state, atDate, journeyLevel, journeyContext) {
  const aidMode = state.aidUrgency > 0;

  if (state.pendingEvents.length) {
    return;
  }

  if (state.status !== "adventuring" && !aidMode) {
    return;
  }

  if (state.nextEventAt && atDate < new Date(state.nextEventAt)) {
    return;
  }

  const phase = getJourneyPhase(state);
  const baseChance = aidMode
    ? 0.48
    : phase === "arrival"
      ? 0.18
      : phase === "survival"
        ? 0.13
        : 0.08;
  const pressureBonus = journeyContext?.neglectScore
    ? Math.min(0.05, journeyContext.neglectScore * 0.008)
    : 0;
  const eventChance = Math.min(
    aidMode ? 0.72 : 0.3,
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
  const completedKeys = new Set(state.completedEventKeys || []);
  let candidates = allCandidates.filter(
    (candidate) =>
      !pendingKeys.has(candidate.key) &&
      !recentKeys.has(candidate.key) &&
      (candidate.repeatable || !completedKeys.has(candidate.key))
  );

  if (!candidates.length) {
    const latestKey = state.recentEventKeys?.[0] || "";
    candidates = allCandidates.filter(
      (candidate) =>
        !pendingKeys.has(candidate.key) &&
        candidate.key !== latestKey &&
        (candidate.repeatable || !completedKeys.has(candidate.key))
    );
  }

  if (!candidates.length) {
    candidates = allCandidates.filter(
      (candidate) =>
        !pendingKeys.has(candidate.key) &&
        (candidate.repeatable || !completedKeys.has(candidate.key))
    );
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
      repeatable: selected.repeatable,
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

function createJourneyStatChoice({
  label,
  preview,
  highlightWord,
  statKey,
  successText,
  failureText,
  successEffects,
  failureEffects,
  chanceBase = 0.24,
  chancePerStat = 0.08,
  minChance = 0.14,
  maxChance = 0.9,
}) {
  return {
    label,
    preview,
    highlightWord,
    statKey,
    chanceBase,
    chancePerStat,
    minChance,
    maxChance,
    successText,
    failureText,
    successEffects,
    failureEffects,
  };
}

function createJourneyGuaranteedChoice({
  label,
  preview,
  resultText,
  effects,
}) {
  return {
    label,
    preview,
    statKey: "resolve",
    chanceBase: 1,
    chancePerStat: 0,
    minChance: 1,
    maxChance: 1,
    successText: resultText,
    failureText: resultText,
    successEffects: effects,
    failureEffects: effects,
    forceSuccess: true,
  };
}

export function getJourneyEventCandidates(state, journeyLevel, atDate, _journeyContext) {
  const eventTime = atDate.toISOString();
  const candidates = [];
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const journeyPhase = getJourneyPhase(state);
  const currentBagRank = getJourneyBagMeta(state.bagKey).rank;
  const pushCandidate = (
    key,
    weight,
    build,
    kind = "normal",
    repeatable = false
  ) => {
    candidates.push({ key, weight, build, kind, repeatable });
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
          createJourneyGuaranteedChoice({
            label: "Take the healer's aid",
            preview: "Let the treatment land and get back on your feet.",
            resultText:
              "The healer cleans the worst of the damage, binds you properly, and presses a tonic and trail food into your hands before sending you back to the road.",
            effects: {
              hp: 22,
              hunger: 8,
              bonusTonics: 1,
              bonusRations: 1,
              storyXp: 10,
            },
          }),
        ],
        autoResolve: true,
      }),
      "aid",
      true
    );

    pushCandidate(
      "aid:herbalist",
      6 + state.aidUrgency,
      () => ({
        title: "A traveling herbalist waves you over",
        teaser: "She has a sharp eye for exhaustion and a pack full of remedies.",
        detail:
          "An herbalist sorting roots by the roadside sees you limping, waves you in without bargaining, and starts putting together exactly the kind of help your body has been begging for.",
        createdAt: eventTime,
        choices: [
          createJourneyGuaranteedChoice({
            label: "Take the herbalist's help",
            preview: "Drink, eat, and listen while she patches the worst of it.",
            resultText:
              "She talks you through what to eat, what to avoid, and which salve to keep for later. By the time you leave, the ache is quieter and your pack is heavier with useful supplies.",
            effects: {
              hp: 10,
              hunger: 16,
              bonusRations: 2,
              bonusTonics: 1,
              storyXp: 10,
            },
          }),
        ],
        autoResolve: true,
      }),
      "aid",
      true
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
          createJourneyGuaranteedChoice({
            label: "Drink from the spring",
            preview: "Take the quiet gift and keep moving.",
            resultText:
              "The water goes through you like cold light. The worst of the ache eases, your breathing settles, and you manage to bottle enough of it to keep some of that strange calm for later.",
            effects: {
              hp: 16,
              hunger: 12,
              bonusTonics: 1,
              storyXp: 12,
            },
          }),
        ],
        autoResolve: true,
      }),
      "aid",
      true
    );

    pushCandidate(
      "aid:bandit-camp",
      5 + state.aidUrgency,
      () => ({
        title: "A raider's camp by the looted carriage",
        teaser: "The bandit looks half-asleep beside a pile of stolen supplies.",
        detail:
          "You spot the carriage first, wheels sunk in the mud, then the camp beyond it. One bandit is dozing by a tent with the wagon's missing goods stacked close at hand.",
        createdAt: eventTime,
        choices: [
          createJourneyGuaranteedChoice({
            label: "Take what you can and go",
            preview: "A quick grab, a quick exit, and no heroics.",
            resultText:
              "You wait for the bandit to drift the wrong way, snatch the nearest bundle of supplies, and leave before the camp ever properly wakes around you.",
            effects: {
              hunger: 10,
              bonusRations: 2,
              bonusTonics: 1,
              storyXp: 10,
            },
          }),
        ],
        autoResolve: true,
      }),
      "aid",
      true
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
            createJourneyStatChoice({
              label: "Tease the knife free from the frame",
              preview: "Trust careful hands with the tight, dangerous work.",
              highlightWord: "Tease",
              statKey: "finesse",
              chanceBase: 0.28,
              chancePerStat: 0.08,
              successText:
                "The rusted knife comes loose with only a scrape across your knuckles, but now you finally have a real blade.",
              failureText:
                "The blade gives all at once and slices your palm on the way out. It still ends up in your hand, warm with your own blood.",
              successEffects: {
                hp: -2,
                distance: 4,
                storyXp: 14,
                weaponName: "Rust-worn belt knife",
                flags: { foundWeapon: true },
              },
              failureEffects: {
                hp: -6,
                distance: 2,
                storyXp: 0,
                weaponName: "Rust-worn belt knife",
                flags: { foundWeapon: true },
              },
            }),
            createJourneyStatChoice({
              label: "Wrench the shaft into something useful",
              preview: "Take the loud, direct option and make it work.",
              highlightWord: "Wrench",
              statKey: "might",
              chanceBase: 0.33,
              chancePerStat: 0.07,
              successText:
                "You rip free the surviving wood and turn it into a crude spear-club sturdy enough to trust in a panic.",
              failureText:
                "The first pull splinters half the shaft, but you still salvage a brutal little club from the wreckage.",
              successEffects: {
                distance: 3,
                storyXp: 11,
                bonusRations: 1,
                weaponName: "Crude spear-club",
                flags: { foundWeapon: true },
              },
              failureEffects: {
                hp: -4,
                storyXp: 0,
                weaponName: "Crude spear-club",
                flags: { foundWeapon: true },
              },
            }),
            createJourneyStatChoice({
              label: "Steady yourself and salvage only what matters",
              preview: "Take a breath, ignore the junk, and leave with the best piece.",
              highlightWord: "Steady",
              statKey: "resolve",
              chanceBase: 0.36,
              chancePerStat: 0.06,
              minChance: 0.28,
              successText:
                "You resist the urge to paw through every scrap, spot the one usable weapon quickly, and get moving before the stop costs too much.",
              failureText:
                "You try to stay disciplined, but hesitation keeps eating the moment. By the time you leave, you have only scraps and lost time.",
              successEffects: {
                distance: 5,
                storyXp: 9,
                weaponName: "Rust-worn belt knife",
                flags: { foundWeapon: true },
              },
              failureEffects: {
                hunger: -5,
                distance: 3,
                storyXp: 0,
              },
            }),
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
            createJourneyStatChoice({
              label: "Sort the safe ones from the rest",
              preview: "Take your time and let small signs guide you.",
              highlightWord: "Sort",
              statKey: "resolve",
              chanceBase: 0.37,
              chancePerStat: 0.06,
              minChance: 0.28,
              successText:
                "You test patiently, keep only what proves itself, and leave with a modest meal that does not fight back.",
              failureText:
                "You stay cautious, but not cautious enough. A few bad berries slip through and sour the whole stop.",
              successEffects: {
                hunger: 10,
                storyXp: 9,
              },
              failureEffects: {
                hunger: 4,
                hp: -3,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Taste them before hunger gets louder",
              preview: "Trust your body to tell you what belongs in it.",
              highlightWord: "Taste",
              statKey: "vitality",
              chanceBase: 0.29,
              chancePerStat: 0.08,
              successText:
                "Your stomach takes the test better than expected. The berries are not perfect, but they fill the ache without doing real harm.",
              failureText:
                "The gamble turns on you fast. You force down enough to matter, then spend the next stretch wishing you had not.",
              successEffects: {
                hunger: 14,
                storyXp: 8,
              },
              failureEffects: {
                hunger: 8,
                hp: -7,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Read what the birds left behind",
              preview: "Look for patterns before you commit your own stomach.",
              highlightWord: "Read",
              statKey: "finesse",
              chanceBase: 0.3,
              chancePerStat: 0.08,
              successText:
                "You notice which branches were pecked clean and which were avoided. The clues are enough to turn the patch into a useful stop.",
              failureText:
                "You misread the signs and collect more trouble than food, leaving with a lighter pack and an annoyed stomach.",
              successEffects: {
                hunger: 11,
                distance: 3,
                storyXp: 10,
              },
              failureEffects: {
                hunger: 5,
                storyXp: 0,
              },
            }),
          ],
        }),
        "normal",
        true
    );

    pushCandidate("arrival:tracks", 3, () => ({
          title: "Heavy tracks near the creek",
          teaser: "Something big has been moving through this area.",
          detail:
            "Fresh prints cut into the mud beside the water. They are too wide to ignore and too recent to feel safe.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Stalk the trail a little farther",
              preview: "Learn what made the tracks before it learns you.",
              highlightWord: "Stalk",
              statKey: "finesse",
              chanceBase: 0.25,
              chancePerStat: 0.09,
              successText:
                "You move lightly enough to watch the creature's route without becoming part of it. The knowledge makes the next miles feel less blind.",
              failureText:
                "A snapped branch gives you away and the lesson becomes a chase. You escape, but not elegantly.",
              successEffects: {
                hp: -2,
                distance: 6,
                storyXp: 13,
              },
              failureEffects: {
                hp: -8,
                distance: 2,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Brace and drive it from the creek",
              preview: "Make noise first and hope confidence carries the rest.",
              highlightWord: "Brace",
              statKey: "might",
              chanceBase: 0.23,
              chancePerStat: 0.09,
              successText:
                "You step in hard, shout louder than you feel, and the beast finally gives way. The water is yours for a brief, dangerous minute.",
              failureText:
                "You come on strong, but the animal does not care. You retreat bruised, angry, and very aware of your own size.",
              successEffects: {
                hp: -4,
                hunger: 7,
                storyXp: 14,
              },
              failureEffects: {
                hp: -10,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Push past before your nerves win",
              preview: "Use momentum to outrun the worst of the fear.",
              highlightWord: "Push",
              statKey: "vitality",
              chanceBase: 0.33,
              chancePerStat: 0.07,
              successText:
                "You keep moving at a hard pace until the creek and the tracks are both behind you. It costs energy, but buys real distance.",
              failureText:
                "You force the pace too early and burn yourself out halfway through. The escape still works, just badly.",
              successEffects: {
                distance: 10,
                hunger: -6,
                storyXp: 7,
              },
              failureEffects: {
                distance: 4,
                hunger: -9,
                hp: -3,
                storyXp: 0,
              },
            }),
          ],
        }),
        "normal",
        true
    );

    pushCandidate("arrival:watchtower", 2, () => ({
          title: "A collapsed watchtower in the reeds",
          teaser: "Most of it is rotten, but the top still overlooks the road ahead.",
          detail:
            "A watchtower leans at an ugly angle above the marsh grass. The lower door is jammed, the ladder is splintered, and old signal marks still cling to the timber.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Climb the frame before it gives way",
              preview: "Risk the old height for a better read of the road.",
              highlightWord: "Climb",
              statKey: "vitality",
              chanceBase: 0.26,
              chancePerStat: 0.08,
              successText:
                "You reach the upper ledge, catch a long view of the route ahead, and come down with a clearer line through the next stretch.",
              failureText:
                "Halfway up, the frame shudders and drops you back into the reeds. You salvage a glimpse, but not without pain.",
              successEffects: {
                distance: 12,
                storyXp: 10,
              },
              failureEffects: {
                hp: -7,
                distance: 4,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Force the lower door open",
              preview: "The quiet route is ruined anyway, so lean into it.",
              highlightWord: "Force",
              statKey: "might",
              chanceBase: 0.3,
              chancePerStat: 0.08,
              successText:
                "The rotten latch gives under your shoulder. Inside, you find a dry corner with a little food and an old watchman's tonic.",
              failureText:
                "You batter the door apart, but most of what waited inside has already gone bad. Only scraps remain worth taking.",
              successEffects: {
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 9,
              },
              failureEffects: {
                hp: -3,
                bonusRations: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Trace the old signal marks",
              preview: "Let the people who built this place tell you what they saw.",
              highlightWord: "Trace",
              statKey: "arcana",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "The chalk and carved lines resolve into a warning route and a safer one. You leave with a strange little confidence about where to step next.",
              failureText:
                "You find a pattern in the marks, but it is only half the truth. The detour helps less than expected, though the lesson stays with you.",
              successEffects: {
                distance: 8,
                bonusSkillPoints: 1,
                storyXp: 12,
              },
              failureEffects: {
                distance: 3,
                storyXp: 0,
              },
            }),
          ],
        }),
        "normal",
        true
    );

    if (currentBagRank < 1) {
      pushCandidate("arrival:forager-satchel", 4, () => ({
            title: "A torn satchel caught in the briars",
            teaser: "The strap is snagged high in the brush, but the bag itself still looks sound.",
            detail:
              "You spot a leather satchel hanging where a traveler must have torn free of the thicket in a hurry. The pouch is within reach if you are willing to make the attempt count.",
            createdAt: eventTime,
            choices: [
              createJourneyStatChoice({
                label: "Ease the strap loose without ripping it",
                preview: "Careful hands might save the bag intact.",
                highlightWord: "Ease",
                statKey: "finesse",
                chanceBase: 0.3,
                chancePerStat: 0.08,
                successText:
                  "You work the strap free thread by thread until the satchel drops cleanly into your hands, still sturdy enough to use.",
                failureText:
                  "The briars bite back and the strap tears in the worst possible place. You salvage a little food, but not the bag.",
                successEffects: {
                  bagKey: "satchel",
                  bonusRations: 1,
                  storyXp: 10,
                },
                failureEffects: {
                  hp: -4,
                  bonusRations: 1,
                  storyXp: 0,
                },
              }),
              createJourneyStatChoice({
                label: "Yank it free before the thorns take more skin",
                preview: "Rough force might still win the bag.",
                highlightWord: "Yank",
                statKey: "might",
                chanceBase: 0.27,
                chancePerStat: 0.08,
                successText:
                  "One hard pull tears the satchel loose along with half the thorn branch holding it. The leather complains, but it will serve.",
                failureText:
                  "You wrench too hard, split the seam, and end up with only the spilled contents and bleeding knuckles.",
                successEffects: {
                  bagKey: "satchel",
                  bonusRations: 1,
                  storyXp: 9,
                },
                failureEffects: {
                  hp: -5,
                  hunger: -2,
                  storyXp: 0,
                },
              }),
              createJourneyStatChoice({
                label: "Judge whether it is worth the trouble first",
                preview: "Take a breath and only commit if the prize is real.",
                highlightWord: "Judge",
                statKey: "resolve",
                chanceBase: 0.35,
                chancePerStat: 0.06,
                minChance: 0.28,
                successText:
                  "You slow yourself down, spot the weak points in the thorn snare, and recover the satchel without ruining it.",
                failureText:
                  "You hesitate just long enough for the leather to give under its own weight. By the time you reach it, only scraps remain useful.",
                successEffects: {
                  bagKey: "satchel",
                  bonusRations: 1,
                  storyXp: 8,
                },
                failureEffects: {
                  bonusRations: 1,
                  storyXp: 0,
                },
              }),
            ],
          })
      );
    }
  }

  if (journeyPhase !== "frontier") {
    pushCandidate("weather:cold-rain", 2, () => ({
          title: "Cold rain before dusk",
          teaser: "You need to decide whether to stop or suffer through it.",
          detail:
            "The weather turns without warning. The air is suddenly bitter and the path is starting to vanish under rain and leaf litter.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Knot together rough shelter",
              preview: "Lose distance now so the night does not take more later.",
              highlightWord: "Knot",
              statKey: "resolve",
              chanceBase: 0.37,
              chancePerStat: 0.06,
              minChance: 0.28,
              successText:
                "Your hands stay steady long enough to make a miserable little shelter that still keeps the worst of the cold off you.",
              failureText:
                "The shelter goes up crooked and late. It helps, but not before the weather has already worked its way into your bones.",
              successEffects: {
                distance: -4,
                hp: 6,
                storyXp: 9,
              },
              failureEffects: {
                distance: -2,
                hp: -2,
                hunger: -2,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Shoulder through the storm",
              preview: "Trade comfort for distance and trust your legs.",
              highlightWord: "Shoulder",
              statKey: "vitality",
              chanceBase: 0.31,
              chancePerStat: 0.08,
              successText:
                "You keep your body moving hard enough to stay warm, forcing out useful ground before the storm can claim the evening.",
              failureText:
                "The cold drains you faster than expected. You still make progress, but every step after feels heavier than the last.",
              successEffects: {
                distance: 10,
                hp: -4,
                hunger: -4,
                storyXp: 8,
              },
              failureEffects: {
                distance: 5,
                hp: -8,
                hunger: -6,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Rig the runoff before the light dies",
              preview: "Use quick hands to turn the rain into something useful.",
              highlightWord: "Rig",
              statKey: "finesse",
              chanceBase: 0.29,
              chancePerStat: 0.08,
              successText:
                "You angle cloth, bark, and broken branches just right, saving clean runoff and a little dignity before the storm can strip both away.",
              failureText:
                "The runoff spills where you do not need it and the setup collapses twice before you give up cold and irritated.",
              successEffects: {
                hunger: 8,
                bonusRations: 1,
                storyXp: 9,
              },
              failureEffects: {
                hunger: -3,
                storyXp: 0,
              },
            }),
          ],
        }),
        "normal",
        true
    );
  }

  if (journeyPhase === "frontier" && currentBagRank < 2 && journeyLevel >= 3) {
    pushCandidate("frontier:abandoned-pack-mule", 4, () => ({
          title: "An abandoned pack frame by the road",
          teaser: "The mule is gone, but the frame and bedroll are still wedged under the brush.",
          detail:
            "Off the side of the road, you find the remains of a trader's pack rig: split straps, scattered buckles, and a traveler's backpack pinned beneath a warped frame.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Slip the backpack free from the frame",
              preview: "Careful hands might save the best part intact.",
              highlightWord: "Slip",
              statKey: "finesse",
              chanceBase: 0.27,
              chancePerStat: 0.08,
              successText:
                "You work the straps loose in the right order and recover the backpack with only surface damage.",
              failureText:
                "One bad tug snaps a key buckle and the whole frame collapses on your hand. You salvage trail food, but not a usable pack.",
              successEffects: {
                bagKey: "backpack",
                bonusRations: 1,
                storyXp: 11,
              },
              failureEffects: {
                hp: -5,
                bonusRations: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Heave the whole rig over and strip it fast",
              preview: "If subtlety is gone already, win with force.",
              highlightWord: "Heave",
              statKey: "might",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "You flip the crushed frame aside and wrestle the backpack out before the rotten wood can tear it open.",
              failureText:
                "The frame shifts the wrong way and crushes the pack flat. You pull out a few intact supplies and little else.",
              successEffects: {
                bagKey: "backpack",
                bonusRations: 2,
                storyXp: 10,
              },
              failureEffects: {
                hp: -6,
                bonusRations: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Check the stitching before you commit",
              preview: "A steady eye might tell you where the pack can still hold.",
              highlightWord: "Check",
              statKey: "resolve",
              chanceBase: 0.33,
              chancePerStat: 0.07,
              minChance: 0.26,
              successText:
                "You find the surviving seams, cut only where you need to, and come away with a backpack still fit for the road.",
              failureText:
                "You read the damage too generously. The leather gives as soon as the weight shifts, leaving you with frustration and a handful of dried food.",
              successEffects: {
                bagKey: "backpack",
                bonusRations: 1,
                storyXp: 9,
              },
              failureEffects: {
                hunger: -2,
                bonusRations: 1,
                storyXp: 0,
              },
            }),
          ],
        })
    );
  }

  if (journeyPhase === "frontier" && currentBagRank < 3 && journeyLevel >= 6) {
    pushCandidate("frontier:field-kit-cache", 2, () => ({
          title: "A sealed supply niche in a ruined gate",
          teaser: "Someone hid real expedition gear here and hoped to come back for it.",
          detail:
            "Inside a broken gatehouse, you find a fitted wall niche behind a loose stone. The cache holds a field kit wrapped in oilcloth, but the lock and stonework both look ready to fight you for it.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Pick the clasp before the rust gives you away",
              preview: "One patient touch could save the whole kit.",
              highlightWord: "Pick",
              statKey: "finesse",
              chanceBase: 0.22,
              chancePerStat: 0.09,
              successText:
                "The clasp yields just enough for you to work the cache open quietly. Inside is a field kit built for roads far harsher than this one.",
              failureText:
                "The clasp snaps loud enough to echo through the stone. You grab what loose supplies you can and abandon the rest before company arrives.",
              successEffects: {
                bagKey: "field_kit",
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 12,
              },
              failureEffects: {
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Break the niche open and trust the stone to lose first",
              preview: "Brute force will settle the argument quickly.",
              highlightWord: "Break",
              statKey: "might",
              chanceBase: 0.2,
              chancePerStat: 0.1,
              successText:
                "You batter the loosened stone aside and haul the field kit free before the wall can bury it again.",
              failureText:
                "The wall gives, but so does the ledge under your footing. You wrench free only the smaller supplies while the real prize disappears into rubble.",
              successEffects: {
                bagKey: "field_kit",
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 11,
              },
              failureEffects: {
                hp: -8,
                bonusTonics: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Wait out the echoes and open it cleanly",
              preview: "Let caution buy you the better prize.",
              highlightWord: "Wait",
              statKey: "resolve",
              chanceBase: 0.28,
              chancePerStat: 0.08,
              successText:
                "You pace the ruin, listen for movement, and choose the one quiet minute that lets you take the field kit without ruining it.",
              failureText:
                "You wait too long and the niche shifts under its own weight. The field kit is lost, though a tonic and some food survive the collapse.",
              successEffects: {
                bagKey: "field_kit",
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 10,
              },
              failureEffects: {
                bonusRations: 1,
                bonusTonics: 1,
                storyXp: 0,
              },
            }),
          ],
        })
    );
  }

  if (journeyPhase === "frontier") {
    pushCandidate("frontier:waystone-cache", 3, () => ({
          title: "A waystone with a hidden compartment",
          teaser: "The stone still marks the road, but someone carved more into it than directions.",
          detail:
            "At a fork in the road stands an old waystone etched with faded route marks and a seam near the base where a compartment might once have been hidden.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Trace the old marks until they mean something",
              preview: "Let the stone tell you more than distance.",
              highlightWord: "Trace",
              statKey: "arcana",
              chanceBase: 0.25,
              chancePerStat: 0.09,
              successText:
                "The marks resolve into more than directions: a warning line, a safer turn, and a clue to where travelers once hid supplies.",
              failureText:
                "You follow the patterns too far into your own guesses and only come away with a partial read and lost time.",
              successEffects: {
                distance: 8,
                bonusTonics: 1,
                storyXp: 11,
              },
              failureEffects: {
                distance: 2,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Pry the base open before the road notices you",
              preview: "If there is a cache, force will find it faster than patience.",
              highlightWord: "Pry",
              statKey: "might",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "You crack the hidden panel wide enough to pull out a small cache of trail food and a wrapped blade.",
              failureText:
                "The stone shifts against you and nearly traps your hand. You wrench it free with only bruises and a few crumbs to show for it.",
              successEffects: {
                bonusRations: 2,
                weaponName: "Traveler's hatchet",
                storyXp: 10,
              },
              failureEffects: {
                hp: -5,
                bonusRations: 1,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Circle behind the hedgerow and search the blind side",
              preview: "Use the road's habits against it.",
              highlightWord: "Circle",
              statKey: "finesse",
              chanceBase: 0.29,
              chancePerStat: 0.08,
              successText:
                "You find the stash where most eyes would never look: tucked into the blind side with dry food and a route note worth following.",
              failureText:
                "You misjudge the footing on the far side and announce yourself with loose stone. Whatever was hidden there, someone gets to it before you do.",
              successEffects: {
                bonusRations: 1,
                distance: 7,
                storyXp: 9,
              },
              failureEffects: {
                hunger: -3,
                storyXp: 0,
              },
            }),
          ],
        }),
        "normal",
        true
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
            createJourneyStatChoice({
              label: "Match his stance and hold it",
              preview: "Meet the lesson directly and let the bruises come.",
              highlightWord: "Match",
              statKey: "might",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "You meet every correction with force instead of flinching. By the time the fire burns low, the guard nods once and says you finally look like a warrior.",
              failureText:
                "You can feel the shape of the lesson, but not hold it. The guard still leaves you with hard advice and a few new bruises.",
              successEffects: {
                hp: -4,
                storyXp: 20,
                unlockClass: "warrior",
              },
              failureEffects: {
                hp: -6,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Absorb the drill and keep rising",
              preview: "Treat stubborn endurance as its own kind of weapon.",
              highlightWord: "rising",
              statKey: "vitality",
              chanceBase: 0.28,
              chancePerStat: 0.08,
              successText:
                "He knocks you down until your body learns not to stay there. The lesson sinks in through sheer repetition and pain.",
              failureText:
                "You last longer than he expects, but not long enough to earn the full lesson. The practice still leaves a mark.",
              successEffects: {
                hp: -3,
                storyXp: 18,
                unlockClass: "warrior",
              },
              failureEffects: {
                hp: -5,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Study the rhythm behind each strike",
              preview: "Look past the strength and read the intent.",
              highlightWord: "rhythm",
              statKey: "resolve",
              chanceBase: 0.29,
              chancePerStat: 0.07,
              successText:
                "You stop reacting to each blow and start understanding the cadence beneath them. The guard notices, and the lesson finally clicks into place.",
              failureText:
                "You catch part of what he means, but only part. The rest will have to wait for another road and another fire.",
              successEffects: {
                bonusRations: 1,
                storyXp: 18,
                unlockClass: "warrior",
              },
              failureEffects: {
                hunger: -2,
                storyXp: 0,
              },
            }),
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
            createJourneyStatChoice({
              label: "Trace the current through the spring",
              preview: "Follow the strange feeling instead of recoiling from it.",
              highlightWord: "Trace",
              statKey: "arcana",
              chanceBase: 0.22,
              chancePerStat: 0.1,
              successText:
                "You stop fighting the sensation and let the shrine's strange logic pass through you. When you leave, magic feels less like rumor and more like grammar.",
              failureText:
                "You brush the edge of understanding before the current slips away. Even the incomplete lesson changes how the air feels around your hands.",
              successEffects: {
                hunger: -3,
                storyXp: 22,
                bonusTonics: 1,
                unlockClass: "mage",
              },
              failureEffects: {
                hp: -2,
                storyXp: 0,
                bonusTonics: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Endure the pressure and keep hold",
              preview: "Treat the shrine like something to survive, then master.",
              highlightWord: "Endure",
              statKey: "vitality",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "The force of the shrine presses through you like cold iron, but you hold on until the pattern settles. What remains is the first hard shape of a mage's discipline.",
              failureText:
                "The pressure throws you back before the lesson finishes. You recover, shaken but changed.",
              successEffects: {
                hp: 6,
                storyXp: 19,
                unlockClass: "mage",
              },
              failureEffects: {
                hp: -4,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Center your breath and wait",
              preview: "Let steadiness do what force cannot.",
              highlightWord: "Center",
              statKey: "resolve",
              chanceBase: 0.27,
              chancePerStat: 0.08,
              successText:
                "You quiet yourself until the shrine stops feeling distant. The answer arrives softly, but it stays, leaving you with a mage's first certainty.",
              failureText:
                "You find stillness for a moment, then lose it. The shrine gives you only a passing blessing before the silence breaks.",
              successEffects: {
                hp: 8,
                storyXp: 18,
                unlockClass: "mage",
              },
              failureEffects: {
                hp: 2,
                storyXp: 0,
              },
            }),
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
            createJourneyStatChoice({
              label: "Shadow the way she circles you",
              preview: "Learn by copying what you almost missed.",
              highlightWord: "Shadow",
              statKey: "finesse",
              chanceBase: 0.23,
              chancePerStat: 0.1,
              successText:
                "You mirror her footwork just well enough that she stops laughing and starts teaching. By the end, silence feels like something you can wear.",
              failureText:
                "You try to match her steps and spend half the attempt announcing yourself to the forest. She still offers advice, but not the deeper trick of it.",
              successEffects: {
                storyXp: 18,
                unlockClass: "thief",
              },
              failureEffects: {
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Notice the route hidden in her basket",
              preview: "Read what she gathered and what that says about the land.",
              highlightWord: "Notice",
              statKey: "arcana",
              chanceBase: 0.26,
              chancePerStat: 0.08,
              successText:
                "You identify more from the roots and leaves than she expected. Impressed, she trades the full lesson for your sharp eye.",
              failureText:
                "You spot a few clues, but not enough to earn the real teaching. She sends you onward with only a safer route and a smirk.",
              successEffects: {
                distance: 10,
                storyXp: 17,
                unlockClass: "thief",
              },
              failureEffects: {
                distance: 6,
                storyXp: 0,
              },
            }),
            createJourneyStatChoice({
              label: "Wait until she decides you are worth teaching",
              preview: "Give away nothing, then let patience do the rest.",
              highlightWord: "Wait",
              statKey: "resolve",
              chanceBase: 0.3,
              chancePerStat: 0.07,
              successText:
                "You do not rush the exchange, and eventually she answers stillness with trust. Her lesson is brief, precise, and exactly the one you needed.",
              failureText:
                "You stay guarded too long and the moment cools. She leaves you with directions, but not with her best secrets.",
              successEffects: {
                bonusRations: 1,
                storyXp: 17,
                unlockClass: "thief",
              },
              failureEffects: {
                storyXp: 0,
                distance: 2,
              },
            }),
          ],
        })
    );
  }

  if (journeyPhase === "survival") {
    pushCandidate("survival:charcoal-burners", 3, () => ({
          title: "Smoke from a charcoal pit",
          teaser: "Working folk are camped ahead, and they look like people who notice everything.",
          detail:
            "You find a ring of charcoal burners tending low earthen mounds and blackened stacks of wood. They are wary, practical people, the sort who have learned to measure strangers by how much trouble they bring with them.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Earn their trust before asking for anything",
              preview: "Offer honest help and let patience do the bargaining.",
              highlightWord: "trust",
              statKey: "resolve",
              chanceBase: 0.31,
              chancePerStat: 0.07,
              minChance: 0.22,
              successText:
                "You stack wood, keep your mouth shut when it would only hurt, and let the burners decide you are not another road leech. When you leave, they send you off with food, a coal-warmed flask, and the safer trail.",
              failureText:
                "You help well enough, but not long enough to cross the distance between caution and trust. They still give you directions, though the rest you wanted stays behind with the smoke.",
              successEffects: {
                bonusRations: 2,
                bonusTonics: 1,
                distance: 6,
                storyXp: 12,
              },
              failureEffects: {
                distance: 3,
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Shift the heaviest timber for them",
              preview: "Speak in effort and let the work make your case.",
              highlightWord: "heaviest",
              statKey: "might",
              chanceBase: 0.28,
              chancePerStat: 0.08,
              successText:
                "You shoulder the backbreaking pieces nobody wants and win their respect the hard way. One old burner laughs, claps your shoulder, and presses supplies into your hands.",
              failureText:
                "You get the timber moving, but at the cost of torn breath and aching ribs. They feed you out of basic decency, not admiration.",
              successEffects: {
                hp: -2,
                hunger: 10,
                bonusRations: 2,
                storyXp: 11,
              },
              failureEffects: {
                hp: -7,
                hunger: 5,
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Read the soot marks on their wagons",
              preview: "Look for the road knowledge hidden in their routine.",
              highlightWord: "soot",
              statKey: "finesse",
              chanceBase: 0.29,
              chancePerStat: 0.08,
              successText:
                "You notice the coded slashes and soot circles they use to mark safe turns, bad crossings, and bandit country. The lesson buys you distance and a little welcome besides.",
              failureText:
                "You think you have their signs understood, but only half of them. The mistake costs time before one of the burners sighs and points you back on course.",
              successEffects: {
                distance: 11,
                bonusRations: 1,
                storyXp: 10,
              },
              failureEffects: {
                distance: 4,
                hunger: -2,
                storyXp: 1,
              },
            }),
          ],
        }),
        "normal",
        true
    );
  }

  if (journeyPhase === "frontier") {
    pushCandidate("frontier:rope-ferry", 3, () => ({
          title: "A rope ferry over black water",
          teaser: "The crossing is still usable, but only just.",
          detail:
            "At the edge of a dark cut in the land, you find a flat ferry platform tethered to a rope thick as your wrist. The current below is mean, fast, and loud enough to make every bad outcome sound plausible.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Haul the ferry hand over hand",
              preview: "Beat the current with stubborn muscle.",
              highlightWord: "Haul",
              statKey: "might",
              chanceBase: 0.25,
              chancePerStat: 0.08,
              successText:
                "You drag the ferry across inch by inch, shoulders burning, but you reach the far side with your gear and pride both intact.",
              failureText:
                "The rope jerks, your footing goes wild, and the crossing turns into a bruising, ugly fight for balance before you scrape through.",
              successEffects: {
                distance: 12,
                storyXp: 12,
              },
              failureEffects: {
                hp: -9,
                distance: 5,
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Work the pulleys and knots first",
              preview: "Let clever hands do what brute force cannot.",
              highlightWord: "knots",
              statKey: "finesse",
              chanceBase: 0.29,
              chancePerStat: 0.08,
              successText:
                "You re-seat the slipping knots, free the jammed guide ring, and make the whole crossing almost respectable before you trust it with your life.",
              failureText:
                "You fix part of the rig and miss the worst of it. The ferry still gets you across, just with one sudden lurch that nearly throws you to the water.",
              successEffects: {
                distance: 14,
                bonusTonics: 1,
                storyXp: 11,
              },
              failureEffects: {
                hp: -4,
                distance: 6,
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Listen to the current before committing",
              preview: "Find the crossing rhythm hidden under the noise.",
              highlightWord: "Listen",
              statKey: "arcana",
              chanceBase: 0.23,
              chancePerStat: 0.09,
              successText:
                "You catch a strange pattern in the current and time the pull with it, as though the water is willing to lend you one careful favor.",
              failureText:
                "You think you hear a pattern, but it breaks under you halfway out. The far bank still takes you, though not gently.",
              successEffects: {
                distance: 13,
                bonusRations: 1,
                storyXp: 13,
              },
              failureEffects: {
                hp: -5,
                hunger: -3,
                distance: 6,
                storyXp: 1,
              },
            }),
          ],
        }),
        "normal",
        true
    );

    pushCandidate("frontier:pilgrim-lanterns", 2, () => ({
          title: "Lanterns hung for the dead",
          teaser: "Someone still tends this old roadside custom.",
          detail:
            "At dusk you come upon a line of small lanterns hung from iron hooks and thorn branches, each flame set before an old roadside name. The air is quiet in the reverent way a chapel is quiet after everybody has gone home.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Name your own dead and light one more lantern",
              preview: "Meet the road's grief honestly and see what it gives back.",
              highlightWord: "light",
              statKey: "resolve",
              chanceBase: 0.26,
              chancePerStat: 0.08,
              successText:
                "You speak into the dusk more honestly than you meant to. When the lantern catches, some knot in you loosens, and the road afterward feels fractionally less cruel.",
              failureText:
                "The words refuse to come cleanly. You still leave a light behind, but the comfort of it never quite reaches your chest.",
              successEffects: {
                hp: 8,
                hunger: 6,
                storyXp: 12,
              },
              failureEffects: {
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Read the old names and symbols",
              preview: "Treat the memorials like a text the road still remembers.",
              highlightWord: "Read",
              statKey: "arcana",
              chanceBase: 0.24,
              chancePerStat: 0.09,
              successText:
                "The names and sigils line up into a pattern of warnings, blessings, and distances. You leave with a clearer route and the unsettled sense that the road has begun to recognize you.",
              failureText:
                "You understand only fragments of the old marks. They help, but only in the crooked partial way of half-remembered prayer.",
              successEffects: {
                distance: 10,
                bonusTonics: 1,
                storyXp: 13,
              },
              failureEffects: {
                distance: 4,
                storyXp: 1,
              },
            }),
            createJourneyStatChoice({
              label: "Move among the lanterns without disturbing them",
              preview: "Respect the place with quiet feet and quicker hands.",
              highlightWord: "quiet",
              statKey: "finesse",
              chanceBase: 0.27,
              chancePerStat: 0.08,
              successText:
                "You slip through the lantern line without dimming a single flame and find a votive cache of wax, dried fruit, and a folded route charm left for travelers who know how to be gentle.",
              failureText:
                "One lantern knocks and hisses out under your sleeve. You still find the cache, but you leave feeling watched in the disappointed way only sacred places manage.",
              successEffects: {
                bonusRations: 2,
                distance: 7,
                storyXp: 11,
              },
              failureEffects: {
                bonusRations: 1,
                storyXp: 1,
              },
            }),
          ],
        }),
        "normal",
        true
    );
  }

  if (journeyPhase === "frontier" && journeyLevel >= 5) {
    pushCandidate("legend:last-hearth", 1, () => ({
          title: "The Last Hearth Below the Hill",
          teaser: "A ruined shrine still keeps one ember alive beneath the rain.",
          detail:
            "Beyond a tumble of leaning stones, you find the shell of an old roadside shrine. Its roof is gone, its icons broken, and yet one ember still glows in the drowned hearth at its center. A half-legible carving names this place the Last Hearth, where travelers once swore what they would not let the dark take from them.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Kneel and speak a vow into the ember",
              preview: "If the old road still listens, give it a promise worth hearing.",
              highlightWord: "vow",
              statKey: "resolve",
              chanceBase: 0.15,
              chancePerStat: 0.06,
              minChance: 0.1,
              maxChance: 0.42,
              successText:
                "The ember brightens without wind or tinder. It brands no flesh, yet something in you comes away marked all the same, steadier than it was when you knelt.",
              failureText:
                "The vow leaves your mouth and dies in the wet air. The hearth gives you warmth for a minute, but not the blessing hidden beneath it.",
              successEffects: {
                hp: 10,
                storyXp: 24,
                permanentStatBonus: {
                  statKey: "resolve",
                  amount: 1,
                  title: "Brand of the Last Hearth",
                  detail: "The old vow-fire remembers you whenever the road tries to thin your courage.",
                },
              },
              failureEffects: {
                hp: 4,
                storyXp: 3,
              },
            }),
            createJourneyStatChoice({
              label: "Feed the ember a drop of your blood",
              preview: "Make the road's old bargain in the oldest currency.",
              highlightWord: "blood",
              statKey: "vitality",
              chanceBase: 0.13,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.4,
              successText:
                "Pain flashes bright, then folds inward. The hearth takes its due and returns something harder in its place, as if your body has been reminded how stubborn life can be.",
              failureText:
                "The ember drinks the offering and gives back only heat and a sharp lesson about old things that owe you nothing.",
              successEffects: {
                hp: -3,
                storyXp: 24,
                permanentStatBonus: {
                  statKey: "vitality",
                  amount: 1,
                  title: "Ash-Marrow Vigor",
                  detail: "The Last Hearth left a little of its stubborn warmth in your bones.",
                },
              },
              failureEffects: {
                hp: -8,
                storyXp: 3,
              },
            }),
            createJourneyStatChoice({
              label: "Read the smoke-script in the broken stones",
              preview: "Treat the ruin like a text still writing itself.",
              highlightWord: "smoke",
              statKey: "arcana",
              chanceBase: 0.14,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.42,
              successText:
                "You follow the curling soot patterns until they resolve into an older kind of language. When the meaning lands, the ember answers with a hush of blue light and leaves part of that grammar in you.",
              failureText:
                "You almost catch the hidden text before it blurs back into smoke and old weathering. The shrine still yields a fragment, but not the deeper lesson.",
              successEffects: {
                bonusTonics: 1,
                storyXp: 26,
                permanentStatBonus: {
                  statKey: "arcana",
                  amount: 1,
                  title: "Cinder-Script Memory",
                  detail: "You now hear a trace of meaning in the old magic threaded through road shrines and boundary stones.",
                },
              },
              failureEffects: {
                bonusTonics: 1,
                storyXp: 3,
              },
            }),
          ],
        })
    );
  }

  if (journeyPhase === "frontier" && journeyLevel >= 6) {
    pushCandidate("legend:oath-cairn", 1, () => ({
          title: "An oath-cairn of the first wardens",
          teaser: "The stones are too massive to have been stacked by ordinary hands.",
          detail:
            "On a wind-scoured rise stands a cairn built from slabs no farmer's cart could have moved. Iron rings, now red with age, are set into the stone at shoulder height. A weather-soft inscription says the first wardens came here to swear which burden they would carry for the frontier and which fear they would never carry home.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Lift the oath-ring and hold it high",
              preview: "Take the wardens' burden into your own shoulders for a breath.",
              highlightWord: "Lift",
              statKey: "might",
              chanceBase: 0.14,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.4,
              successText:
                "The ring rises only an inch at first, then a handspan, then enough. The cairn answers with a deep stone hum that runs up your arms and settles there as lasting strength.",
              failureText:
                "You strain until your vision whitens, but the oath-ring does not quite acknowledge you. It leaves you shaking, wiser, and empty-handed.",
              successEffects: {
                hp: -4,
                storyXp: 25,
                permanentStatBonus: {
                  statKey: "might",
                  amount: 1,
                  title: "Warden's Burden",
                  detail: "The old frontier stones taught your body how to carry force without yielding to it.",
                },
              },
              failureEffects: {
                hp: -9,
                storyXp: 3,
              },
            }),
            createJourneyStatChoice({
              label: "Walk the cairn's rim in the wind",
              preview: "Accept the height, the drop, and the need for one clean step after another.",
              highlightWord: "wind",
              statKey: "finesse",
              chanceBase: 0.15,
              chancePerStat: 0.07,
              minChance: 0.09,
              maxChance: 0.42,
              successText:
                "You let the gale take everything unnecessary and keep only balance. By the time you step down, your body remembers the lesson with unsettling clarity.",
              failureText:
                "A loose edge of stone nearly teaches you the lesson by force. You recover before the fall, but not before fear has had its say.",
              successEffects: {
                distance: 8,
                storyXp: 24,
                permanentStatBonus: {
                  statKey: "finesse",
                  amount: 1,
                  title: "Step of the First Scout",
                  detail: "The oath-cairn taught your balance to trust narrow ground and dangerous timing.",
                },
              },
              failureEffects: {
                hp: -7,
                storyXp: 3,
              },
            }),
            createJourneyStatChoice({
              label: "Listen to the names the stones still keep",
              preview: "Treat the cairn like a memory that has not decided to die.",
              highlightWord: "names",
              statKey: "resolve",
              chanceBase: 0.16,
              chancePerStat: 0.06,
              minChance: 0.1,
              maxChance: 0.42,
              successText:
                "The wind through the stones starts sounding less like weather and more like witness. You leave with the impossible conviction that the old wardens have counted you among the stubborn.",
              failureText:
                "You wait and hear only wind, but even that leaves you quieter than before and not entirely unchanged.",
              successEffects: {
                hp: 6,
                storyXp: 23,
                permanentStatBonus: {
                  statKey: "resolve",
                  amount: 1,
                  title: "Witness of the Wardens",
                  detail: "The cairn's old oath-song steadies you whenever fear starts speaking too loudly.",
                },
              },
              failureEffects: {
                hp: 2,
                storyXp: 3,
              },
            }),
          ],
        })
    );
  }

  if (journeyPhase === "frontier" && journeyLevel >= 7) {
    pushCandidate("legend:mirror-spring", 1, () => ({
          title: "The mirror spring under moonlight",
          teaser: "The surface shows more than one sky.",
          detail:
            "Hidden in a fold of stone is a spring so still it reflects the moon twice: once above, once from some pale depth below the waterline. Old chalk marks on the surrounding rock suggest travelers came here seeking revelations and usually left with scars.",
          createdAt: eventTime,
          choices: [
            createJourneyStatChoice({
              label: "Look straight into the second reflection",
              preview: "Accept that some knowledge only arrives by being endured.",
              highlightWord: "reflection",
              statKey: "arcana",
              chanceBase: 0.13,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.4,
              successText:
                "The lower sky opens like a book written in cold light. You do not understand all of it, but enough remains in your head to change the way the world fits together.",
              failureText:
                "The second reflection looks back harder than you were ready for. You jerk away with only a headache and a splinter of meaning.",
              successEffects: {
                bonusTonics: 1,
                storyXp: 28,
                permanentStatBonus: {
                  statKey: "arcana",
                  amount: 1,
                  title: "Moon-Glass Insight",
                  detail: "You carry a lucid fragment of the hidden sky beneath the world.",
                },
              },
              failureEffects: {
                hp: -5,
                storyXp: 4,
              },
            }),
            createJourneyStatChoice({
              label: "Cut a path around the spring without breaking the image",
              preview: "Let grace be the price of entry to a sacred danger.",
              highlightWord: "grace",
              statKey: "finesse",
              chanceBase: 0.14,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.4,
              successText:
                "You move around the pool so lightly that the surface never shivers. Something in the spring seems to approve, and your steps afterward carry that impossible precision.",
              failureText:
                "One loose pebble breaks the mirrored sky. The blessing goes thin at once, leaving you with only a sharper respect for places like this.",
              successEffects: {
                distance: 9,
                storyXp: 26,
                permanentStatBonus: {
                  statKey: "finesse",
                  amount: 1,
                  title: "Stillwater Footing",
                  detail: "The mirror spring taught your body how to move without disturbing what watches back.",
                },
              },
              failureEffects: {
                distance: 3,
                storyXp: 4,
              },
            }),
            createJourneyStatChoice({
              label: "Drink from the edge and trust what survives",
              preview: "Invite the spring into your body before your fear can object.",
              highlightWord: "Drink",
              statKey: "vitality",
              chanceBase: 0.12,
              chancePerStat: 0.07,
              minChance: 0.08,
              maxChance: 0.38,
              successText:
                "The water is ice and starlight together. It hurts in a way that feels almost surgical, stripping weakness down to what can regrow stronger.",
              failureText:
                "The spring goes through you like winter steel. You survive it, but the deeper change refuses to take hold.",
              successEffects: {
                hp: 12,
                storyXp: 27,
                permanentStatBonus: {
                  statKey: "vitality",
                  amount: 1,
                  title: "Star-Cooled Blood",
                  detail: "Some part of your body now remembers the cold clarity of the moonlit spring.",
                },
              },
              failureEffects: {
                hp: -10,
                storyXp: 4,
              },
            }),
          ],
        })
    );
  }

  return candidates;
}

export function maybeAddAmbientJourneyLog(state, atDate) {
  if (Math.random() > 0.08) return;

  const phase = getJourneyPhase(state);
  const pool = JOURNEY_AMBIENT_INTERACTIONS[phase] || JOURNEY_AMBIENT_INTERACTIONS.frontier;
  if (!pool?.length) return;

  const recentLogs = Array.isArray(state.log) ? state.log : [];
  const recentAmbientTexts = recentLogs
    .map((entry) => String(entry?.text || "").trim())
    .filter((text) => pool.includes(text))
    .slice(0, JOURNEY_AMBIENT_REPEAT_MEMORY);
  const latestAmbientEntry = recentLogs.find((entry) =>
    pool.includes(String(entry?.text || "").trim())
  );

  if (latestAmbientEntry?.at) {
    const elapsedSinceLastAmbient =
      atDate.getTime() - new Date(latestAmbientEntry.at).getTime();
    if (elapsedSinceLastAmbient < JOURNEY_AMBIENT_LOG_COOLDOWN_MS) {
      return;
    }
  }

  const filteredPool = pool.filter((text) => !recentAmbientTexts.includes(text));
  const candidatePool = filteredPool.length ? filteredPool : pool;
  addJourneyLog(
    state,
    candidatePool[randomInt(0, candidatePool.length - 1)],
    atDate.toISOString()
  );
}

export function getJourneyChoiceSuccessChance(choice, journeyStats) {
  if (!choice?.statKey || !JOURNEY_STAT_META[choice.statKey]) {
    return 1;
  }

  const statValue = Math.max(0, Number(journeyStats?.stats?.[choice.statKey]) || 0);
  const rawChance = (Number(choice.chanceBase) || 0.24) + statValue * (Number(choice.chancePerStat) || 0.08);
  const minChance = Number.isFinite(choice.minChance) ? choice.minChance : 0.14;
  const maxChance = Number.isFinite(choice.maxChance) ? choice.maxChance : 0.9;

  return clamp(rawChance, minChance, maxChance);
}

function applyJourneyPermanentStatBonus(state, rawBonus) {
  const bonus = normalizeJourneyPermanentBonus(rawBonus);
  if (!bonus) return "";

  state.permanentBonuses = Array.isArray(state.permanentBonuses)
    ? state.permanentBonuses
    : [];
  const alreadyGranted = state.permanentBonuses.some(
    (entry) =>
      entry.title === bonus.title &&
      entry.statKey === bonus.statKey &&
      entry.amount === bonus.amount
  );
  if (alreadyGranted) return "";

  state.statModifiers[bonus.statKey] =
    Math.round(Number(state.statModifiers?.[bonus.statKey]) || 0) + bonus.amount;
  state.permanentBonuses = [...state.permanentBonuses, bonus];
  const statLabel = JOURNEY_STAT_META[bonus.statKey]?.label || "Stat";
  const detailText = bonus.detail ? ` ${bonus.detail}` : "";

  return `${bonus.title} gained. ${statLabel} ${formatSignedNumber(
    bonus.amount
  )}.${detailText}`.trim();
}

export function applyJourneyChoiceEffects(state, choice, journeyStats, atIso) {
  const successChance = getJourneyChoiceSuccessChance(choice, journeyStats);
  const successRoll = choice.forceSuccess ? 0 : Math.random();
  const success = choice.forceSuccess || successRoll <= successChance;
  const effects = success ? choice.successEffects : choice.failureEffects;
  const notes = [];
  const hpDelta = scaleJourneyEventHpDelta(effects.hp);
  const storyXpDelta = success
    ? effects.storyXp
    : Math.min(1, Math.round(Number(effects.storyXp) || 0));

  state.currentHp = clamp(
    state.currentHp + hpDelta,
    0,
    journeyStats.maxHp
  );
  state.currentHunger = clamp(
    state.currentHunger + effects.hunger,
    0,
    journeyStats.maxHunger
  );
  state.totalDistance = Math.max(0, state.totalDistance + effects.distance);
  state.storyXp = Math.max(0, state.storyXp + storyXpDelta);
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

  if (effects.bagKey) {
    const bagRewardText = awardJourneyBag(state, effects.bagKey);
    if (bagRewardText) {
      notes.push(`Bag found: ${bagRewardText}.`);
    }
  }
  if (effects.permanentStatBonus) {
    const permanentBonusText = applyJourneyPermanentStatBonus(
      state,
      effects.permanentStatBonus
    );
    if (permanentBonusText) {
      notes.push(permanentBonusText);
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

  const resultText = success ? choice.successText : choice.failureText;
  addJourneyLog(state, resultText, atIso);

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

  if (
    !success &&
    effects.hp >= 0 &&
    effects.hunger >= 0 &&
    effects.distance >= 0 &&
    storyXpDelta >= 0 &&
    !effects.weaponName &&
    !effects.bagKey &&
    !effects.permanentStatBonus &&
    !effects.unlockClass
  ) {
    state.currentHunger = clamp(state.currentHunger - 3, 0, journeyStats.maxHunger);
    notes.push("The failed attempt still drained more out of you than you expected.");
  }

  if (unlockedText) {
    notes.push(unlockedText);
  }

  const finalText = notes.length
    ? `${resultText} ${notes.join(" ")}`
    : resultText;
  const statKey = JOURNEY_STAT_META[choice.statKey] ? choice.statKey : "resolve";

  return {
    success,
    statKey,
    statLabel: JOURNEY_STAT_META[statKey].label,
    statValue: Math.max(0, Number(journeyStats?.stats?.[statKey]) || 0),
    successChance,
    successPercent: Math.round(successChance * 100),
    successRoll,
    resultText: finalText,
    showRollSummary: !choice.forceSuccess,
  };
}

function scaleJourneyEventHpDelta(delta) {
  const amount = Math.round(Number(delta) || 0);
  if (amount > 0) {
    return Math.round(amount * JOURNEY_EVENT_HP_GAIN_MULTIPLIER);
  }
  if (amount < 0) {
    return -Math.round(Math.abs(amount) * JOURNEY_EVENT_HP_LOSS_MULTIPLIER);
  }
  return 0;
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
  state.recoveryStartedAt = atDate.toISOString();
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
  addJourneyRetreat(
    state,
    `Retreated from ${getJourneyZoneName(state.bossIndex)}`,
    message,
    atDate.toISOString()
  );
  state.recoveryObjective = buildJourneyRecoveryObjective(
    state,
    currentJourneyLevel,
    currentJourneyStats
  );
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
  const bossNames = isJourneyJapaneseLocale() ? JOURNEY_BOSS_NAMES_JA : JOURNEY_BOSS_NAMES;
  const baseName = bossNames[index % bossNames.length];

  return {
    name: cycle ? `${baseName} ${romanize(cycle + 1)}` : baseName,
    power: 36 + index * 15 + Math.floor(index / 2) * 6,
  };
}

export function getJourneyZoneName(bossIndex) {
  const zoneNames = isJourneyJapaneseLocale() ? JOURNEY_ZONE_NAMES_JA : JOURNEY_ZONE_NAMES;
  return zoneNames[bossIndex % zoneNames.length];
}

export function getJourneyStretchDistance(bossIndex) {
  if (bossIndex === 0) return 70;
  if (bossIndex === 1) return 90;
  return JOURNEY_BOSS_DISTANCE;
}

export function getJourneySegmentStartDistance(bossIndex) {
  let total = 0;

  for (let index = 0; index < bossIndex; index += 1) {
    total += getJourneyStretchDistance(index);
  }

  return total;
}

export function getJourneyBossThreshold(bossIndex) {
  return (
    getJourneySegmentStartDistance(bossIndex) +
    getJourneyStretchDistance(bossIndex)
  );
}

export function getJourneySegmentProgress(totalDistance, bossIndex) {
  const stretchDistance = getJourneyStretchDistance(bossIndex);
  const segmentStart = getJourneySegmentStartDistance(bossIndex);
  const nextBossDistance = getJourneyBossThreshold(bossIndex);
  const distanceIntoSegment = clamp(
    totalDistance - segmentStart,
    0,
    stretchDistance
  );
  const remainingDistance = Math.max(0, nextBossDistance - totalDistance);
  const percent = Math.round(
    clamp((distanceIntoSegment / Math.max(1, stretchDistance)) * 100, 0, 100)
  );

  return {
    percent,
    remainingDistance,
    currentLabel: `${Math.floor(distanceIntoSegment)} / ${stretchDistance} through this stretch`,
    remainingLabel: `${Math.ceil(remainingDistance)} until the next major threat`,
  };
}

export function getJourneyActivityText(
  state,
  boss,
  progress,
  journeyStats,
  supplies = null
) {
  const condition = getJourneyConditionState(state, journeyStats, supplies);
  const isJa = isJourneyJapaneseLocale();

  if (state.status === "recovering") {
    return state.recoveryObjective || getRecoveryText(state);
  }

  if (isJa) {
    if (state.bossIndex === 0) {
      if (progress.percent < 18) {
        return "弱く、混乱し、ひどく準備不足のまま異世界へ放り出されて、まだ勝手をつかんでいる最中だ。";
      }

      if (progress.percent < 38) {
        return "森で道を見失い、残り少ない体力を焦りで無駄にしないよう必死に踏みとどまっている。";
      }

      if (!state.storyFlags.foundWeapon || progress.percent < 56) {
        return "森の方が自分を食べ物だと判断する前に、せめて武器の代わりになるものを探している。";
      }

      if (progress.percent < 78) {
        if (condition.needsFood || condition.foodLow) {
          return condition.availableRations > 0
            ? "ようやく腹は満たせたが、狩りが本格化する前に本当の意味で力を戻さないといけない。"
            : "食べられるものを探し、何が危険かを覚え、飢えたままでも進む方法を探っている。";
        }

        return "いまは森を前より丁寧に読めている。猪が餌を食み、休み、引き返す場所を少しずつ覚えてきた。";
      }

      return "猪の痕を追い続けたせいで、最初の本物の狩りは可能性というより約束事に近くなってきた。";
    }

    if (state.bossIndex === 1) {
      return `${getJourneyZoneName(
        state.bossIndex
      )}を進みながら、狼を警戒し、ようやく少しだけ知恵をつけた獲物のように動こうとしている。`;
    }

    if (state.bossIndex === 2) {
      return "どの進入路も狭く、目立ちすぎる橋へ近づいている。待ち伏せる側が好みそうな場所そのものだ。";
    }

    if (state.bossIndex === 3) {
      return "濡れた地面と危うい足場を拾いながら、静かな沼と、その下に潜む何かの違いを見極めようとしている。";
    }

    if (state.bossIndex === 4) {
      return "見張りに話を決められる前に頭目へ届くため、賊の領分を一つひとつ登っている。";
    }

    if (state.bossIndex === 5) {
      return "壊れた石と崩れた壁のあいだを縫っている。古い道が覚えている暴力は、あまりに色濃すぎる。";
    }

    if (state.bossIndex === 6) {
      return "生者が夜にそこを歩いていいのか問うてくるような墓道を進んでいる。";
    }

    if (state.bossIndex === 7) {
      return "嵐の境目へ押し上げられている。風が熱も言葉も慎重さも削ぎ落としていく。";
    }

    return `${getJourneyZoneName(
      state.bossIndex
    )}を進み、${boss.name}へ向かっている。何も狂わなければ、あとおよそ ${formatDurationRangeHours(
      progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour)
    )}。`;
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
      if (condition.needsFood || condition.foodLow) {
        return condition.availableRations > 0
          ? "You have finally managed to eat, but you are still trying to get real strength back under you before the hunt turns serious."
          : "You are scavenging for food, learning what hurts, and figuring out how to keep moving while hungry.";
      }

      return "You are reading the forest more carefully now, learning where the boar feeds, rests, and chooses to circle back.";
    }

    return "You have followed the boar's sign long enough that the first true hunt now feels less like a possibility and more like an appointment.";
  }

  if (state.bossIndex === 1) {
    return `You are keeping to ${getJourneyZoneName(
      state.bossIndex
    )}, watching for wolves and trying to move like prey that has finally learned a few tricks.`;
  }

  if (state.bossIndex === 2) {
    return `You are closing on a bridge where every approach feels too narrow and too visible, exactly the sort of place an ambusher would choose.`;
  }

  if (state.bossIndex === 3) {
    return `You are picking your way through wet ground and treacherous footing, trying to tell the difference between a quiet marsh and something patient beneath it.`;
  }

  if (state.bossIndex === 4) {
    return `You are climbing raider country one switchback at a time, trying to reach the captain before his lookouts decide your story for you.`;
  }

  if (state.bossIndex === 5) {
    return `You are threading ruined stone and broken walls where old roads remember more violence than they should.`;
  }

  if (state.bossIndex === 6) {
    return `You are walking a grave road that keeps asking whether the living have any right to be there after dark.`;
  }

  if (state.bossIndex === 7) {
    return `You are pushing up into the storm line, where the wind strips warmth, words, and caution down to their bones.`;
  }

  return `You are moving through ${getJourneyZoneName(
    state.bossIndex
  )} toward ${boss.name}. About ${formatDurationRangeHours(
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour)
  )} away if nothing goes wrong.`;
}

export function getRecoveryText(state) {
  if (isJourneyJapaneseLocale()) {
    const missionText = state.recoveryObjective
      ? `小さな目的: ${state.recoveryObjective} `
      : "";

    if (!state.restUntil) {
      return `${missionText}もう一度道に出る前に、安全な場所で立て直している。`.trim();
    }

    const remainingMs = Math.max(0, new Date(state.restUntil).getTime() - Date.now());
    return `${missionText}あとおよそ ${formatDurationRangeMs(
      remainingMs
    )} は傷を癒やしてから、道へ戻るつもりだ。`.trim();
  }

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
  if (isJourneyJapaneseLocale()) {
    return status === "recovering" ? "療養中" : "旅の途中";
  }

  return status === "recovering" ? "Resting" : "Traveling";
}

export function getJourneyPhase(state) {
  if (
    state.bossIndex === 0 &&
    state.totalDistance < Math.round(getJourneyStretchDistance(0) * 0.6)
  ) {
    return "arrival";
  }
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
  if (!Number.isFinite(hours) || hours <= 0) {
    return isJourneyJapaneseLocale() ? "1時間未満" : "under 1h";
  }

  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (isJourneyJapaneseLocale()) {
    if (wholeHours === 0) return `${minutes}分`;
    if (minutes === 0) return `${wholeHours}時間`;
    return `${wholeHours}時間${minutes}分`;
  }

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export function formatDurationRangeHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0.95) {
    return isJourneyJapaneseLocale() ? "1時間未満" : "under 1h";
  }

  const low = Math.max(1, Math.floor(hours));
  const high = Math.max(low + 1, Math.ceil(hours));
  return isJourneyJapaneseLocale() ? `${low}-${high}時間` : `${low}-${high}h`;
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return isJourneyJapaneseLocale() ? "1時間未満" : "under 1h";
  }
  return formatDurationHours(ms / (1000 * 60 * 60));
}

export function formatDurationRangeMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return isJourneyJapaneseLocale() ? "1時間未満" : "under 1h";
  }
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
