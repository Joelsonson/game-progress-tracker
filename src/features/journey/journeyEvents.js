import {
  JOURNEY_BAG_META,
  JOURNEY_CLASS_META,
  JOURNEY_FLAG_KEYS,
  JOURNEY_STAT_META,
} from "../../core/constants.js";

export function normalizeJourneyEvent(eventEntry, nowIso) {
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
    kind:
      eventEntry.kind === "aid"
        ? "aid"
        : eventEntry.kind === "boss"
          ? "boss"
          : "normal",
    repeatable: Boolean(eventEntry.repeatable),
    autoResolve: Boolean(eventEntry.autoResolve),
    title: String(eventEntry.title || "Journey event"),
    teaser: String(eventEntry.teaser || "A choice is waiting."),
    detail: String(eventEntry.detail || eventEntry.teaser || ""),
    createdAt: eventEntry.createdAt || nowIso,
    battle: normalizeJourneyBattleState(eventEntry.battle),
    choices,
  };
}

export function normalizeJourneyChoice(choice) {
  if (!choice || typeof choice !== "object") return null;

  const hasExplicitOutcomeBranches =
    choice.successText !== undefined ||
    choice.failureText !== undefined ||
    choice.successEffects !== undefined ||
    choice.failureEffects !== undefined ||
    choice.statKey !== undefined;
  const legacyEffects = normalizeJourneyChoiceEffects(choice.effects);
  const statKey = JOURNEY_STAT_META[choice.statKey] ? choice.statKey : "";
  const chanceBase = Number(choice.chanceBase);
  const chancePerStat = Number(choice.chancePerStat);
  const minChance = Number(choice.minChance);
  const maxChance = Number(choice.maxChance);
  const difficultyClass = Number(choice.difficultyClass);

  return {
    id: String(choice.id || crypto.randomUUID()),
    label: String(choice.label || "Choose"),
    preview: String(choice.preview || "See what happens."),
    highlightWord:
      typeof choice.highlightWord === "string" ? choice.highlightWord.trim() : "",
    statKey,
    roadIndex: Math.max(0, Math.floor(Number(choice.roadIndex) || 0)),
    bossCheck: Boolean(choice.bossCheck),
    difficultyClass:
      hasExplicitOutcomeBranches && Number.isFinite(difficultyClass)
        ? Math.max(5, Math.min(25, Math.round(difficultyClass)))
        : undefined,
    chanceBase: hasExplicitOutcomeBranches
      ? (Number.isFinite(chanceBase) ? chanceBase : 0.24)
      : 1,
    chancePerStat: hasExplicitOutcomeBranches
      ? (Number.isFinite(chancePerStat) ? chancePerStat : 0.08)
      : 0,
    minChance: hasExplicitOutcomeBranches
      ? (Number.isFinite(minChance) ? minChance : 0.14)
      : 1,
    maxChance: hasExplicitOutcomeBranches
      ? (Number.isFinite(maxChance) ? maxChance : 0.9)
      : 1,
    successText: String(
      choice.successText || choice.resultText || choice.preview || ""
    ),
    failureText: String(
      choice.failureText || choice.resultText || choice.preview || ""
    ),
    successEffects: hasExplicitOutcomeBranches
      ? normalizeJourneyChoiceEffects(choice.successEffects)
      : legacyEffects,
    failureEffects: hasExplicitOutcomeBranches
      ? normalizeJourneyChoiceEffects(choice.failureEffects)
      : normalizeJourneyChoiceEffects(null),
    forceSuccess: Boolean(choice.forceSuccess),
  };
}

function normalizeJourneyBattleState(rawBattle) {
  if (!rawBattle || typeof rawBattle !== "object") return null;

  const bossName = String(rawBattle.bossName || "").trim();
  if (!bossName) return null;

  return {
    bossIndex: Math.max(0, Math.floor(Number(rawBattle.bossIndex) || 0)),
    bossName,
    turn: clampBattleValue(rawBattle.turn, 1, 3, 1),
    maxTurns: clampBattleValue(rawBattle.maxTurns, 1, 3, 3),
    bossHp: clampBattleValue(rawBattle.bossHp, 0, 100, 100),
    bossMaxHp: clampBattleValue(rawBattle.bossMaxHp, 1, 100, 100),
    heroHp: clampBattleValue(rawBattle.heroHp, 0, 999, 0),
    heroMaxHp: clampBattleValue(rawBattle.heroMaxHp, 1, 999, 1),
    heroHunger: clampBattleValue(rawBattle.heroHunger, 0, 999, 0),
    heroStartHp: clampBattleValue(rawBattle.heroStartHp, 0, 999, 0),
    heroStartHunger: clampBattleValue(rawBattle.heroStartHunger, 0, 999, 0),
    lastBossDamage: clampBattleValue(rawBattle.lastBossDamage, 0, 999, 0),
    lastHeroDamage: clampBattleValue(rawBattle.lastHeroDamage, 0, 999, 0),
    weaponLabel: String(rawBattle.weaponLabel || "").trim(),
    heroBattleNote: String(rawBattle.heroBattleNote || "").trim(),
    lastCheckLabel: String(rawBattle.lastCheckLabel || "").trim(),
    lastCheckSuccess: Boolean(rawBattle.lastCheckSuccess),
    lastCheckDifficultyClass: clampBattleValue(rawBattle.lastCheckDifficultyClass, 0, 99, 0),
    lastCheckRoll: clampBattleValue(rawBattle.lastCheckRoll, 0, 20, 0),
    lastCheckModifier: clampBattleValue(rawBattle.lastCheckModifier, -20, 20, 0),
    lastCheckTotal: clampBattleValue(rawBattle.lastCheckTotal, -20, 40, 0),
    intro: String(rawBattle.intro || "").trim(),
    opening: String(rawBattle.opening || "").trim(),
    lastExchange: String(rawBattle.lastExchange || "").trim(),
  };
}

function clampBattleValue(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeJourneyChoiceEffects(effects) {
  const safeEffects = effects && typeof effects === "object" ? effects : {};
  const normalizedFlags = JOURNEY_FLAG_KEYS.reduce((accumulator, key) => {
    if (safeEffects.flags?.[key] !== undefined) {
      accumulator[key] = Boolean(safeEffects.flags[key]);
    }
    return accumulator;
  }, {});
  const permanentStatBonus = normalizeJourneyPermanentStatBonus(
    safeEffects.permanentStatBonus
  );

  return {
    hp: Math.round(Number(safeEffects.hp) || 0),
    hunger: Math.round(Number(safeEffects.hunger) || 0),
    distance: Math.round(Number(safeEffects.distance) || 0),
    storyXp: Math.round(Number(safeEffects.storyXp) || 0),
    bonusRations: Math.round(Number(safeEffects.bonusRations) || 0),
    bonusTonics: Math.round(Number(safeEffects.bonusTonics) || 0),
    bonusSkillPoints: Math.round(Number(safeEffects.bonusSkillPoints) || 0),
    bagKey: JOURNEY_BAG_META[safeEffects.bagKey] ? safeEffects.bagKey : "",
    weaponName:
      typeof safeEffects.weaponName === "string" ? safeEffects.weaponName.trim() : "",
    unlockClass: JOURNEY_CLASS_META[safeEffects.unlockClass]
      ? safeEffects.unlockClass
      : "",
    permanentStatBonus,
    flags: normalizedFlags,
  };
}

function normalizeJourneyPermanentStatBonus(rawBonus) {
  if (!rawBonus || typeof rawBonus !== "object") return null;

  const statKey = JOURNEY_STAT_META[rawBonus.statKey] ? rawBonus.statKey : "";
  const amount = Math.round(Number(rawBonus.amount) || 0);
  const title =
    typeof rawBonus.title === "string" ? rawBonus.title.trim() : "";
  const detail =
    typeof rawBonus.detail === "string" ? rawBonus.detail.trim() : "";

  if (!statKey || !amount || !title) {
    return null;
  }

  return {
    statKey,
    amount,
    title,
    detail,
  };
}
