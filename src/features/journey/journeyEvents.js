import { JOURNEY_CLASS_META, JOURNEY_FLAG_KEYS } from "../../core/constants.js";

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

  const effects = choice.effects && typeof choice.effects === "object"
    ? choice.effects
    : {};
  const normalizedFlags = JOURNEY_FLAG_KEYS.reduce((accumulator, key) => {
    if (effects.flags?.[key] !== undefined) {
      accumulator[key] = Boolean(effects.flags[key]);
    }
    return accumulator;
  }, {});

  return {
    id: String(choice.id || crypto.randomUUID()),
    label: String(choice.label || "Choose"),
    preview: String(choice.preview || "See what happens."),
    resultText: String(choice.resultText || choice.preview || ""),
    effects: {
      hp: Math.round(Number(effects.hp) || 0),
      hunger: Math.round(Number(effects.hunger) || 0),
      distance: Math.round(Number(effects.distance) || 0),
      storyXp: Math.round(Number(effects.storyXp) || 0),
      bonusRations: Math.round(Number(effects.bonusRations) || 0),
      bonusTonics: Math.round(Number(effects.bonusTonics) || 0),
      bonusSkillPoints: Math.round(Number(effects.bonusSkillPoints) || 0),
      weaponName:
        typeof effects.weaponName === "string" ? effects.weaponName.trim() : "",
      unlockClass: JOURNEY_CLASS_META[effects.unlockClass]
        ? effects.unlockClass
        : "",
      flags: normalizedFlags,
    },
  };
}
