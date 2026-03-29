import {
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
    kind: eventEntry.kind === "aid" ? "aid" : "normal",
    title: String(eventEntry.title || "Journey event"),
    teaser: String(eventEntry.teaser || "A choice is waiting."),
    detail: String(eventEntry.detail || eventEntry.teaser || ""),
    createdAt: eventEntry.createdAt || nowIso,
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

  return {
    id: String(choice.id || crypto.randomUUID()),
    label: String(choice.label || "Choose"),
    preview: String(choice.preview || "See what happens."),
    highlightWord:
      typeof choice.highlightWord === "string" ? choice.highlightWord.trim() : "",
    statKey,
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
  };
}

function normalizeJourneyChoiceEffects(effects) {
  const safeEffects = effects && typeof effects === "object" ? effects : {};
  const normalizedFlags = JOURNEY_FLAG_KEYS.reduce((accumulator, key) => {
    if (safeEffects.flags?.[key] !== undefined) {
      accumulator[key] = Boolean(safeEffects.flags[key]);
    }
    return accumulator;
  }, {});

  return {
    hp: Math.round(Number(safeEffects.hp) || 0),
    hunger: Math.round(Number(safeEffects.hunger) || 0),
    distance: Math.round(Number(safeEffects.distance) || 0),
    storyXp: Math.round(Number(safeEffects.storyXp) || 0),
    bonusRations: Math.round(Number(safeEffects.bonusRations) || 0),
    bonusTonics: Math.round(Number(safeEffects.bonusTonics) || 0),
    bonusSkillPoints: Math.round(Number(safeEffects.bonusSkillPoints) || 0),
    weaponName:
      typeof safeEffects.weaponName === "string" ? safeEffects.weaponName.trim() : "",
    unlockClass: JOURNEY_CLASS_META[safeEffects.unlockClass]
      ? safeEffects.unlockClass
      : "",
    flags: normalizedFlags,
  };
}
