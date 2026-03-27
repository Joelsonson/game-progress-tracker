import { isMainEligibleStatus, normalizeGameRecord } from "../data/db.js";
import {
  FOCUS_TAX_META,
  GAME_STATUSES,
  SESSION_ALLOWED_STATUSES,
  STATUS_META,
  XP_RULES,
} from "./constants.js";

export function buildSessionStats(sessions) {
  const stats = new Map();

  for (const session of sessions) {
    const current = stats.get(session.gameId) || emptySessionStats();

    current.sessionCount += 1;
    current.totalMinutes += session.minutes;
    current.totalXp += calculateSessionXp(session);

    if (
      !current.lastPlayedAt ||
      new Date(session.playedAt) > new Date(current.lastPlayedAt)
    ) {
      current.lastPlayedAt = session.playedAt;
    }

    if (
      !current.latestSession ||
      new Date(session.playedAt) > new Date(current.latestSession.playedAt)
    ) {
      current.latestSession = session;
    }

    if (session.meaningfulProgress) {
      current.meaningfulCount += 1;
    }

    stats.set(session.gameId, current);
  }

  return stats;
}

export function buildXpSummary(games, sessions) {
  const currentStreak = computeStreak(sessions);
  const todayKey = toDayKey(new Date());

  const sessionXp = sessions.reduce(
    (total, session) => total + calculateSessionXp(session),
    0
  );

  const todayXp = sessions.reduce((total, session) => {
    if (toDayKey(new Date(session.playedAt)) !== todayKey) return total;
    return total + calculateSessionXp(session);
  }, 0);

  const completionXp =
    games.filter((game) => game.status === GAME_STATUSES.COMPLETED).length *
    XP_RULES.completionBonus;

  const streakBonus = Math.max(0, currentStreak - 1) * 5;
  const totalXp = Math.max(0, sessionXp + completionXp + streakBonus);

  const level = Math.floor(totalXp / XP_RULES.xpPerLevel) + 1;
  const xpIntoLevel = totalXp % XP_RULES.xpPerLevel;
  const xpToNextLevel =
    xpIntoLevel === 0 ? XP_RULES.xpPerLevel : XP_RULES.xpPerLevel - xpIntoLevel;

  return {
    totalXp,
    todayXp,
    currentStreak,
    level,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent: (xpIntoLevel / XP_RULES.xpPerLevel) * 100,
    rankTitle: getRankTitle(level),
  };
}

export function calculateSessionXp(session) {
  const minuteXp = Math.min(
    XP_RULES.maxChunkXp,
    Math.floor(session.minutes / XP_RULES.minutesPerChunk) * XP_RULES.xpPerChunk
  );

  return (
    XP_RULES.baseSessionXp +
    minuteXp +
    (session.meaningfulProgress ? XP_RULES.meaningfulBonus : 0) +
    Math.round(Number(session.focusPenaltyXp) || 0)
  );
}

export function getRankTitle(level) {
  if (level >= 12) return "Legendary Finisher";
  if (level >= 8) return "Boss Hunter";
  if (level >= 5) return "Focused Finisher";
  if (level >= 3) return "Momentum Builder";
  return "Side Quest Starter";
}

export function buildGameForStatus(game, nextStatus) {
  const now = new Date().toISOString();
  const updatedGame = {
    ...game,
    status: nextStatus,
    isMain: false,
    completedAt: null,
    pausedAt: null,
    droppedAt: null,
    updatedAt: now,
  };

  if (nextStatus === GAME_STATUSES.COMPLETED) {
    updatedGame.completedAt = now;
  }

  if (nextStatus === GAME_STATUSES.PAUSED) {
    updatedGame.pausedAt = now;
  }

  if (nextStatus === GAME_STATUSES.DROPPED) {
    updatedGame.droppedAt = now;
  }

  return normalizeGameRecord(updatedGame);
}

export function buildCompletionMessage(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();
  return `🏆 Finished "${game.title}" — ${formatMinutes(
    stats.totalMinutes
  )} across ${stats.sessionCount} ${
    stats.sessionCount === 1 ? "session" : "sessions"
  } • +${XP_RULES.completionBonus} XP.`;
}

export function enforceMainGameRules(games) {
  const normalizedGames = games.map((game) => normalizeGameRecord(game));
  const mainCandidates = normalizedGames
    .filter((game) => game.isMain && isMainEligibleStatus(game.status))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const activeMainId = mainCandidates[0]?.id || null;

  return normalizedGames.map((game) => ({
    ...game,
    isMain: Boolean(activeMainId) && game.id === activeMainId,
  }));
}

export function canLogSessionForGame(game) {
  return SESSION_ALLOWED_STATUSES.has(game.status);
}

export function sortGames(games) {
  return [...games].sort((a, b) => {
    if (a.isMain !== b.isMain) return Number(b.isMain) - Number(a.isMain);
    if (a.status !== b.status) {
      return getStatusSortOrder(a.status) - getStatusSortOrder(b.status);
    }
    return a.title.localeCompare(b.title);
  });
}

export function sortSessionTargets(games) {
  return [...games].sort((a, b) => {
    if (a.isMain !== b.isMain) return Number(b.isMain) - Number(a.isMain);
    if (a.status !== b.status) {
      return getStatusSortOrder(a.status) - getStatusSortOrder(b.status);
    }
    return a.title.localeCompare(b.title);
  });
}

export function getStatusSortOrder(status) {
  switch (status) {
    case GAME_STATUSES.IN_PROGRESS:
      return 0;
    case GAME_STATUSES.COMPLETED:
      return 1;
    case GAME_STATUSES.PAUSED:
      return 2;
    case GAME_STATUSES.BACKLOG:
      return 3;
    case GAME_STATUSES.DROPPED:
      return 4;
    default:
      return 99;
  }
}

export function getStatusLabel(status) {
  return STATUS_META[status]?.label || "Backlog";
}

export function isValidStatus(status) {
  return Object.values(GAME_STATUSES).includes(status);
}

export function computeStreak(sessions) {
  if (sessions.length === 0) return 0;

  const playedDays = new Set(
    sessions.map((session) => toDayKey(new Date(session.playedAt)))
  );

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor;

  if (playedDays.has(toDayKey(today))) {
    cursor = new Date(today);
  } else if (playedDays.has(toDayKey(yesterday))) {
    cursor = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;

  while (playedDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCompletionTier(game, stats) {
  const score =
    stats.totalMinutes +
    stats.sessionCount * 16 +
    stats.meaningfulCount * 22 +
    stats.totalXp * 2 +
    (game.isMain ? 25 : 0) +
    (game.bannerImage ? 20 : 0) +
    (game.coverImage ? 15 : 0);

  if (score >= 560) return "legendary";
  if (score >= 380) return "prismatic";
  if (score >= 240) return "gold";
  if (score >= 120) return "silver";
  return "bronze";
}

export function renderCoverVisual(game, className) {
  if (game.coverImage) {
    return `<img class="${className}" src="${escapeAttribute(
      game.coverImage
    )}" alt="${escapeAttribute(game.title)} cover art" />`;
  }

  const initials = getInitials(game.title);
  return `<div class="game-art-placeholder ${className}" aria-hidden="true">${escapeHtml(
    initials
  )}</div>`;
}

export function buildArtBackgroundStyle(image) {
  if (!image) return "";

  return ` style="background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.78)), url('${escapeAttribute(
    image
  )}')"`;
}

export function emptySessionStats() {
  return {
    sessionCount: 0,
    totalMinutes: 0,
    lastPlayedAt: null,
    meaningfulCount: 0,
    totalXp: 0,
    latestSession: null,
  };
}

export function formatMinutes(totalMinutes) {
  if (!totalMinutes || totalMinutes < 60) {
    return `${totalMinutes || 0}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function getGameObjectiveText(game) {
  return String(game?.currentObjective || game?.notes || "").trim();
}

export function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#f87171" : "#34d399";
}

export function hasGameChanged(originalGame, updatedGame) {
  const keys = [
    "id",
    "title",
    "platform",
    "currentObjective",
    "notes",
    "coverImage",
    "bannerImage",
    "artUpdatedAt",
    "status",
    "isMain",
    "completedAt",
    "pausedAt",
    "droppedAt",
    "createdAt",
    "updatedAt",
  ];

  return keys.some((key) => originalGame?.[key] !== updatedGame?.[key]);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getInitials(title) {
  return String(title || "Game")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function isCropCancelError(error) {
  return error instanceof Error && error.message === "Image crop cancelled.";
}

export function getSessionXpBreakdown(session) {
  const total = calculateSessionXp(session);
  const focusPenalty = Math.round(Number(session.focusPenaltyXp) || 0);

  return {
    total,
    totalText: `${total >= 0 ? "+" : ""}${total} XP`,
    focusPenalty: focusPenalty ? `${focusPenalty} XP` : "",
  };
}

export function rollFocusPenalty({ selectedGame, allGames, meaningfulProgress, minutes }) {
  const mainGame = allGames.find((game) => game.isMain);

  if (!mainGame || mainGame.id === selectedGame.id) {
    return { penaltyXp: 0, reason: "" };
  }

  const sideQuestCount = allGames.filter(
    (game) =>
      game.status === GAME_STATUSES.IN_PROGRESS &&
      !game.isMain &&
      game.id !== selectedGame.id
  ).length;

  const isReplay = selectedGame.status === GAME_STATUSES.COMPLETED;
  const meta = isReplay ? FOCUS_TAX_META.replay : FOCUS_TAX_META.sideQuest;
  const chanceBase = isReplay ? 0.72 : 0.42;
  const chance = clamp(
    chanceBase + sideQuestCount * 0.08 + (meaningfulProgress ? 0 : 0.12),
    0,
    0.92
  );

  if (Math.random() > chance) {
    return { penaltyXp: 0, reason: "" };
  }

  const minutesPressure = Math.floor(minutes / 45);
  const penalty = randomInt(
    meta.min + minutesPressure,
    meta.max + minutesPressure + (meaningfulProgress ? 0 : 4)
  );

  return {
    penaltyXp: -penalty,
    reason: `${meta.label} away from ${mainGame.title}`,
  };
}

export function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
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

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "under 1h";
  return formatDurationHours(ms / (1000 * 60 * 60));
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
