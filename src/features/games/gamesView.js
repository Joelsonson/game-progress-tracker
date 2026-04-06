import {
  builtInCoverPickerEl,
  completionSpotlightEl,
  gamesListEl,
  homeOverviewEl,
  listSummaryEl,
  mainQuestPanelEl,
  selectedBuiltInCoverImageInput,
} from "../../core/dom.js";
import {
  CARD_TIER_META,
  GAME_DIFFICULTY_META,
  GAME_STATUSES,
} from "../../core/constants.js";
import {
  buildArtBackgroundStyle,
  computeStreak,
  emptySessionStats,
  escapeAttribute,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMinutes,
  getCompletionTier,
  getCompletedStateText,
  getGameActionSheetMetaText,
  getGameCompletionXp,
  getGameDifficultyLabel,
  getGameRewardText,
  getGameObjectiveText,
  getStatusMeta,
  canLogSessionForGame,
  isGameCompletable,
  renderCoverVisual,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";

export function renderPlayerProgress(summary) {
  const playerLevelEl = document.querySelector("#playerLevel");
  const playerRankEl = document.querySelector("#playerRank");
  const totalXpEl = document.querySelector("#totalXp");
  const todayXpEl = document.querySelector("#todayXp");
  const xpToNextLevelEl = document.querySelector("#xpToNextLevel");
  const xpProgressTextEl = document.querySelector("#xpProgressText");
  const xpProgressFillEl = document.querySelector("#xpProgressFill");

  if (!playerLevelEl) return;

  playerRankEl.textContent = summary.rankTitle;
  playerLevelEl.textContent = String(summary.level);
  totalXpEl.textContent = String(summary.totalXp);
  todayXpEl.textContent = String(summary.todayXp);
  xpToNextLevelEl.textContent = t("player.nextLevelValue", {
    xp: summary.xpToNextLevel,
  });
  xpProgressTextEl.textContent = t("player.xpProgressText", {
    current: summary.xpIntoLevel,
    total: summary.currentLevelRequirement,
    nextLevel: summary.level + 1,
  });
  xpProgressFillEl.style.width = `${summary.progressPercent}%`;
}

export function renderBuiltInCoverPicker() {
  if (!builtInCoverPickerEl) return;

  builtInCoverPickerEl.innerHTML = renderBuiltInCoverPickerOptions();
}

export function syncHomeGoalCapsuleImageStates() {
  if (!homeOverviewEl) return;

  const mediaElements = homeOverviewEl.querySelectorAll("[data-goal-capsule-media]");

  for (const mediaElement of mediaElements) {
    if (!(mediaElement instanceof HTMLElement)) {
      continue;
    }

    const image = mediaElement.querySelector(".goal-capsule-image");
    if (!(image instanceof HTMLImageElement)) {
      continue;
    }

    const markLoaded = () => {
      mediaElement.classList.remove("is-loading", "is-error");
      mediaElement.classList.add("is-loaded");
    };
    const markError = () => {
      mediaElement.classList.remove("is-loading", "is-loaded");
      mediaElement.classList.add("is-error");
    };

    mediaElement.classList.remove("is-loaded", "is-error");
    mediaElement.classList.add("is-loading");

    if (image.complete) {
      if (image.naturalWidth > 0) {
        markLoaded();
      } else {
        markError();
      }
      continue;
    }

    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markError, { once: true });
  }
}

export function renderStats(games, sessions) {
  const totalGamesEl = document.querySelector("#totalGames");
  const inProgressCountEl = document.querySelector("#inProgressCount");
  const completedCountEl = document.querySelector("#completedCount");
  const totalSessionsEl = document.querySelector("#totalSessions");
  const mainGameNameEl = document.querySelector("#mainGameName");
  const currentStreakEl = document.querySelector("#currentStreak");

  if (
    !totalGamesEl ||
    !inProgressCountEl ||
    !completedCountEl ||
    !totalSessionsEl ||
    !mainGameNameEl ||
    !currentStreakEl
  ) {
    return;
  }

  totalGamesEl.textContent = String(games.length);
  inProgressCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.IN_PROGRESS).length
  );
  completedCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.COMPLETED).length
  );
  totalSessionsEl.textContent = String(sessions.length);

  const mainGame = games.find((game) => game.isMain);
  mainGameNameEl.textContent = mainGame ? mainGame.title : t("common.noneSet");

  const streak = computeStreak(sessions);
  currentStreakEl.textContent = `${streak} ${t("common.dayWord", { count: streak })}`;
}

export function renderHomeOverview(
  games,
  sessions,
  sessionStats,
  xpSummary,
  activeLibraryFilter = "all",
  homeLibraryExpanded = false
) {
  if (!homeOverviewEl) return;

  const normalizedFilter = normalizeHomeLibraryFilter(activeLibraryFilter);
  const filteredGames = getHomeLibraryGames(games, normalizedFilter);
  const canExpandLibrary = filteredGames.length > 6;
  const visibleGames =
    homeLibraryExpanded || !canExpandLibrary
      ? filteredGames
      : filteredGames.slice(0, 6);
  const filterOptions = getHomeLibraryFilterOptions();

  homeOverviewEl.innerHTML = `
    <section class="panel home-library-panel">
      <div class="home-library-toolbar">
        <label class="home-library-filter-shell">
          <select
            class="home-library-filter-select"
            data-home-filter-select
            aria-label="${escapeAttribute(t("home.libraryFilterLabel"))}"
          >
            ${filterOptions
              .map(
                (option) => `
                  <option value="${option.value}" ${
                    option.value === normalizedFilter ? "selected" : ""
                  }>
                    ${escapeHtml(option.label)}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>
      </div>

      ${
        visibleGames.length
          ? `
            <div class="home-capsule-grid" role="list">
              ${visibleGames
                .map((game, index) =>
                  renderHomeGoalCapsule(
                    game,
                    sessionStats.get(game.id) || emptySessionStats(),
                    index
                  )
                )
                .join("")}
            </div>
            ${
              canExpandLibrary
                ? `
                  <div class="home-library-more">
                    <button
                      type="button"
                      class="secondary-button home-library-more-button"
                      data-home-library-toggle
                    >
                      ${escapeHtml(
                        homeLibraryExpanded
                          ? t("home.libraryShowLess")
                          : t("home.libraryShowMore", {
                              count: filteredGames.length - visibleGames.length,
                            })
                      )}
                    </button>
                  </div>
                `
                : ""
            }
          `
          : `
            <div class="home-library-empty">
              <h3>${escapeHtml(t("home.libraryEmptyTitle"))}</h3>
              <p class="muted-text">${escapeHtml(
                normalizedFilter === "all"
                  ? t("home.libraryEmptyBody")
                  : t("home.libraryEmptyFiltered", {
                      statusLabel: getStatusMeta(normalizedFilter).label,
                    })
              )}</p>
              <div class="home-library-empty-actions">
                <button
                  type="button"
                  class="primary-button home-library-empty-button"
                  data-home-shortcut="add-goal"
                >
                  ${escapeHtml(t("home.libraryEmptyAction"))}
                </button>
              </div>
            </div>
          `
      }
    </section>

    <div class="home-dashboard-grid">
      <section class="panel player-panel home-progress-panel">
        <div class="player-panel-header">
          <div>
            <p class="eyebrow">${escapeHtml(t("home.playerProgressEyebrow"))}</p>
            <h2 id="playerRank">Side Quest Starter</h2>
            <p id="xpProgressText" class="muted-text">
              0 / 100 XP to next level
            </p>
          </div>
          <div class="level-chip">Lvl <span id="playerLevel">1</span></div>
        </div>

        <div class="xp-bar">
          <div id="xpProgressFill" class="xp-bar-fill" style="width: 0%"></div>
        </div>

        <div class="summary-row">
          <span class="summary-pill">Total XP: <strong id="totalXp">0</strong></span>
          <span class="summary-pill">Today: <strong id="todayXp">0</strong></span>
          <span class="summary-pill">
            Next level: <strong id="xpToNextLevel">100 XP</strong>
          </span>
        </div>

      </section>

      <section class="panel home-snapshot-panel">
        <div class="section-header home-section-header">
          <div>
            <p class="eyebrow">${escapeHtml(t("home.snapshotEyebrow"))}</p>
            <h2>${escapeHtml(t("home.snapshotTitle"))}</h2>
          </div>
        </div>

        <div class="home-stat-grid">
          <article class="home-stat-card">
            <p class="stat-label">${escapeHtml(t("home.totalGames"))}</p>
            <p id="totalGames" class="stat-value">0</p>
          </article>
          <article class="home-stat-card">
            <p class="stat-label">${escapeHtml(t("home.inProgress"))}</p>
            <p id="inProgressCount" class="stat-value">0</p>
          </article>
          <article class="home-stat-card">
            <p class="stat-label">${escapeHtml(t("home.completed"))}</p>
            <p id="completedCount" class="stat-value">0</p>
          </article>
          <article class="home-stat-card">
            <p class="stat-label">${escapeHtml(t("home.totalSessions"))}</p>
            <p id="totalSessions" class="stat-value">0</p>
          </article>
          <article class="home-stat-card home-stat-card-wide">
            <p class="stat-label">${escapeHtml(t("home.mainGame"))}</p>
            <p id="mainGameName" class="stat-value">None yet</p>
          </article>
          <article class="home-stat-card home-stat-card-wide">
            <p class="stat-label">${escapeHtml(t("home.currentStreak"))}</p>
            <p id="currentStreak" class="stat-value">0 days</p>
          </article>
        </div>
      </section>
    </div>
  `;
}

const HOME_LIBRARY_FILTER_ORDER = [
  "all",
  GAME_STATUSES.IN_PROGRESS,
  GAME_STATUSES.BACKLOG,
  GAME_STATUSES.COMPLETED,
  GAME_STATUSES.PAUSED,
  GAME_STATUSES.DROPPED,
];

function normalizeHomeLibraryFilter(filterValue) {
  const safeFilter = String(filterValue || "").trim();
  return HOME_LIBRARY_FILTER_ORDER.includes(safeFilter) ? safeFilter : "all";
}

function getHomeLibraryGames(games, filterValue) {
  if (filterValue === "all") {
    return games;
  }

  return games.filter((game) => game.status === filterValue);
}

function getHomeLibraryFilterOptions() {
  return HOME_LIBRARY_FILTER_ORDER.map((value) => ({
    value,
    label:
      value === "all" ? t("home.libraryFilters.all") : getStatusMeta(value).label,
  }));
}

function renderHomeGoalCapsule(game, stats, index = 0) {
  const isCompleted = game.status === GAME_STATUSES.COMPLETED;
  const tier = isCompleted ? getCompletionTier(game, stats) : "";
  const tierMeta = tier ? CARD_TIER_META[tier] : null;
  const completedClass = isCompleted ? ` is-completed ${tierMeta?.className || ""}` : "";
  const holographicStyle = isCompleted
    ? ` style="${escapeAttribute(buildCompletedCapsuleStyle(game, tierMeta, index))}"`
    : "";
  const action = isCompleted ? "open-completion-showcase" : "open-game-actions";
  const ariaLabel = isCompleted
    ? t("tracker.completionShowcase.openLabel", { title: game.title })
    : t("tracker.manageCard");

  return `
    <article
      class="goal-capsule-card${isCompleted ? " is-completed-shell" : ""}"
      role="listitem"
    >
      <button
        type="button"
        class="goal-capsule-button ${game.isMain ? "is-focus" : ""}${completedClass}"
        data-action="${action}"
        data-id="${game.id}"
        aria-label="${escapeAttribute(ariaLabel)}"
        ${holographicStyle}
      >
        ${renderHomeGoalCapsuleArt(game)}
        <div class="goal-capsule-overlay" aria-hidden="true"></div>
        <div class="goal-capsule-title-wrap">
          <h3 class="goal-capsule-title">${escapeHtml(game.title)}</h3>
        </div>
      </button>
    </article>
  `;
}

function renderHomeGoalCapsuleArt(game) {
  const image = game.coverImage;
  const monogram = getGoalCapsuleMonogram(game.title);
  if (image) {
    return `
      <div class="goal-capsule-media-shell" data-goal-capsule-media>
        <div class="goal-capsule-placeholder" aria-hidden="true">
          <span>${escapeHtml(monogram)}</span>
        </div>
        <img
          class="goal-capsule-image"
          src="${escapeAttribute(image)}"
          alt="${escapeAttribute(game.title)}"
          loading="eager"
          decoding="async"
        />
      </div>
    `;
  }

  return `
    <div class="goal-capsule-placeholder" aria-hidden="true">
      <span>${escapeHtml(monogram)}</span>
    </div>
  `;
}

function getGoalCapsuleMonogram(title) {
  const parts = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const monogram = parts.map((part) => part[0]?.toUpperCase() || "").join("");
  return monogram || "GO";
}

function buildCompletedCapsuleStyle(game, tierMeta, index) {
  const seed = hashString(`${game.id}:${game.title}:${index}`);
  const shift = 14 + (seed % 52);
  const drift = -10 + (seed % 21);
  const rotate = -7 + (seed % 15);
  const delay = -0.35 * (index % 6);

  return [
    `--goal-holo-accent-a:${tierMeta?.accentA || "#c084fc"}`,
    `--goal-holo-accent-b:${tierMeta?.accentB || "#7c3aed"}`,
    `--goal-holo-accent-text:${tierMeta?.accentText || "#f8fafc"}`,
    `--goal-holo-shift:${shift}%`,
    `--goal-holo-drift:${drift}%`,
    `--goal-holo-rotate:${rotate}deg`,
    `--goal-holo-delay:${delay}s`,
  ].join(";");
}

function hashString(value) {
  return Array.from(String(value || "")).reduce(
    (accumulator, character) =>
      (accumulator * 31 + character.charCodeAt(0)) % 2147483647,
    7
  );
}

export function renderCompletionSpotlight(games, sessionStats) {
  const latestCompletedGame = [...games]
    .filter(
      (game) =>
        game.status === GAME_STATUSES.COMPLETED && Boolean(game.completedAt)
    )
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

  if (!latestCompletedGame) {
    completionSpotlightEl.hidden = true;
    completionSpotlightEl.innerHTML = "";
    return;
  }

  const stats = sessionStats.get(latestCompletedGame.id) || emptySessionStats();

  completionSpotlightEl.hidden = false;
  completionSpotlightEl.innerHTML = `
    <div class="completion-spotlight-heading">
      <div>
        <p class="eyebrow">${escapeHtml(t("tracker.completionSpotlight.eyebrow"))}</p>
        <h2>${escapeHtml(t("tracker.completionSpotlight.title"))}</h2>
        <p class="completion-meta">
          ${escapeHtml(
            t("tracker.completionSpotlight.meta", {
              date: formatDate(latestCompletedGame.completedAt),
              sessions: stats.sessionCount,
              sessionWord: t("common.sessionWord", { count: stats.sessionCount }),
              playTime: formatMinutes(stats.totalMinutes),
            })
          )}
        </p>
      </div>
      <button
        class="secondary-button action-success"
        data-action="download-card"
        data-id="${latestCompletedGame.id}"
      >
        ${escapeHtml(t("tracker.actionsMenu.downloadCard"))}
      </button>
    </div>

    ${renderCompletionCard(latestCompletedGame, stats)}

    <p class="completion-note">
      ${escapeHtml(t("tracker.completionSpotlight.note"))}
    </p>
  `;
}

export function renderMainQuest(games, sessionStats) {
  if (!mainQuestPanelEl) return;

  const mainGame =
    games.find((game) => game.isMain) ||
    games.find((game) => game.status === GAME_STATUSES.IN_PROGRESS);

  if (!mainGame) {
    mainQuestPanelEl.innerHTML = `
      <p class="eyebrow">${escapeHtml(t("tracker.mainQuest.eyebrow"))}</p>
      <h2>${escapeHtml(t("tracker.mainQuest.emptyTitle"))}</h2>
      <p class="muted-text">
        ${escapeHtml(t("tracker.mainQuest.emptyBody"))}
      </p>
    `;
    return;
  }

  const stats = sessionStats.get(mainGame.id) || emptySessionStats();
  const objective = escapeHtml(getGameObjectiveText(mainGame));
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const bannerStyle = buildArtBackgroundStyle(
    mainGame.bannerImage || mainGame.coverImage
  );

  mainQuestPanelEl.innerHTML = `
    <div class="quest-shell">
      <p class="eyebrow">${escapeHtml(t("tracker.mainQuest.eyebrow"))}</p>

      <div class="quest-hero-banner"${bannerStyle}>
        <div class="quest-hero-content">
          <div class="quest-hero-top">
            ${renderCoverVisual(mainGame, "quest-cover-thumb")}
            <div class="quest-hero-text">
              <div class="game-title-row">
                <h2>🎯 ${escapeHtml(mainGame.title)}</h2>
                <span class="badge badge-main">${escapeHtml(
                  t("tracker.mainQuest.badge")
                )}</span>
              </div>
              <p class="muted-text">
                ${escapeHtml(
                  t("tracker.mainQuest.heroMeta", {
                    sessions: stats.sessionCount,
                    sessionWord: t("common.sessionWord", {
                      count: stats.sessionCount,
                    }),
                    playTime: formatMinutes(stats.totalMinutes),
                    meaningful: stats.meaningfulCount,
                  })
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-row">
        <span class="summary-pill">${escapeHtml(
          t("tracker.summaryPills.questXp", { xp: stats.totalXp })
        )}</span>
        <span class="summary-pill">${escapeHtml(
          t("tracker.summaryPills.lastPlayed", {
            value: stats.lastPlayedAt
              ? formatDateTime(stats.lastPlayedAt)
              : t("common.never"),
          })
        )}</span>
        <span class="summary-pill">${escapeHtml(
          t("tracker.summaryPills.platform", {
            value: getPlatformText(mainGame),
          })
        )}</span>
        <span class="summary-pill">${escapeHtml(
          t("tracker.summaryPills.difficulty", {
            value: getGameDifficultyLabel(mainGame.difficulty),
          })
        )}</span>
      </div>

      ${
        objective
          ? `<div class="note-block"><p class="note-label">${escapeHtml(
              t("tracker.notes.currentObjective")
            )}</p><p class="game-notes">${objective}</p></div>`
          : `<p class="muted-text">${escapeHtml(
              t("tracker.mainQuest.noObjective")
            )}</p>`
      }

      ${
        latestSessionNote
          ? `<div class="note-block"><p class="note-label">${escapeHtml(
              t("tracker.notes.latestSession")
            )}</p><p class="session-note">${latestSessionNote}</p></div>`
          : `<p class="muted-text">${escapeHtml(
              t("tracker.mainQuest.noSessionNote")
            )}</p>`
      }
    </div>
  `;
}

function renderHomeFocusCard(game, stats) {
  const bannerImage = game.bannerImage || game.coverImage;
  const bannerArt = bannerImage
    ? `<img class="game-card-banner-image" src="${escapeAttribute(
        bannerImage
      )}" alt="" aria-hidden="true" />`
    : "";
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const objective = escapeHtml(getGameObjectiveText(game));
  const difficultyMeta = GAME_DIFFICULTY_META[game.difficulty];
  const statusMeta = getStatusMeta(game.status);

  return `
    <div class="home-focus-card">
      <div class="game-card-banner home-focus-banner">
        ${bannerArt}
        <div class="game-card-banner-content">
          <div class="game-card-banner-hero">
            ${renderCoverVisual(game, "game-cover-thumb")}
            <div class="game-card-banner-copy">
              <div class="game-card-banner-heading">
                <h3 class="game-title">${escapeHtml(game.title)}</h3>
                <p class="game-meta">${escapeHtml(
                  t("tracker.summaryPills.platform", {
                    value: getPlatformText(game),
                  })
                )}</p>
              </div>
              <div class="game-card-banner-badges">
                <span class="badge badge-main">${escapeHtml(
                  t("tracker.mainQuest.badge")
                )}</span>
                <span class="badge badge-status ${statusMeta.badgeClass}">${escapeHtml(
                  statusMeta.label
                )}</span>
                <span class="badge badge-difficulty ${difficultyMeta?.badgeClass || ""}">${escapeHtml(
                  getGameDifficultyLabel(game.difficulty)
                )}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="home-focus-body">
        <div class="summary-row">
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.questXp", { xp: stats.totalXp })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.sessions", { count: stats.sessionCount })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.playTime", {
              value: formatMinutes(stats.totalMinutes),
            })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.lastPlayed", {
              value: stats.lastPlayedAt
                ? formatDateTime(stats.lastPlayedAt)
                : t("common.never"),
            })
          )}</span>
        </div>

        ${
          objective
            ? `<div class="note-block"><p class="note-label">${escapeHtml(
                t("tracker.notes.currentObjective")
              )}</p><p class="game-notes">${objective}</p></div>`
            : `<p class="muted-text">${escapeHtml(t("tracker.mainQuest.noObjective"))}</p>`
        }

        ${
          latestSessionNote
            ? `<div class="note-block"><p class="note-label">${escapeHtml(
                t("tracker.notes.latestSession")
              )}</p><p class="session-note">${latestSessionNote}</p></div>`
            : ""
        }

        <div class="home-action-grid">
          <button type="button" class="primary-button" data-home-shortcut="log-session">
            ${escapeHtml(t("home.quickLogSession"))}
          </button>
          <button type="button" class="secondary-button" data-home-shortcut="tracker">
            ${escapeHtml(t("home.quickViewTracker"))}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderGames(games, sessionStats) {
  if (games.length === 0) {
    listSummaryEl.textContent = t("tracker.emptySummary");
    gamesListEl.innerHTML = `
      <div class="empty-state">
        ${escapeHtml(t("tracker.emptyState"))}
      </div>
    `;
    return;
  }

  const counts = {
    inProgress: games.filter(
      (game) => game.status === GAME_STATUSES.IN_PROGRESS
    ).length,
    backlog: games.filter((game) => game.status === GAME_STATUSES.BACKLOG)
      .length,
    completed: games.filter(
      (game) => game.status === GAME_STATUSES.COMPLETED
    ).length,
  };

  listSummaryEl.textContent = t("tracker.listSummary", {
    tracked: games.length,
    inProgress: counts.inProgress,
    completed: counts.completed,
    backlog: counts.backlog,
  });

  const mainGame = games.find((game) => game.isMain) || null;

  const sections = [
    {
      key: "main-quest",
      title: t("tracker.sections.mainTitle"),
      description: t("tracker.sections.mainDescription"),
      games: mainGame ? [mainGame] : [],
      empty: t("tracker.sections.mainEmpty"),
      sectionClass: "games-section-main",
    },
    {
      key: GAME_STATUSES.IN_PROGRESS,
      title: getStatusMeta(GAME_STATUSES.IN_PROGRESS).label,
      description: getStatusMeta(GAME_STATUSES.IN_PROGRESS).description,
      games: games.filter(
        (game) => game.status === GAME_STATUSES.IN_PROGRESS && !game.isMain
      ),
      empty: getStatusMeta(GAME_STATUSES.IN_PROGRESS).empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.COMPLETED,
      title: t("tracker.sections.completedTitle"),
      description: t("tracker.sections.completedDescription"),
      games: games.filter((game) => game.status === GAME_STATUSES.COMPLETED),
      empty: getStatusMeta(GAME_STATUSES.COMPLETED).empty,
      sectionClass: "completed-deck-section",
    },
    {
      key: GAME_STATUSES.PAUSED,
      title: getStatusMeta(GAME_STATUSES.PAUSED).label,
      description: getStatusMeta(GAME_STATUSES.PAUSED).description,
      games: games.filter((game) => game.status === GAME_STATUSES.PAUSED),
      empty: getStatusMeta(GAME_STATUSES.PAUSED).empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.BACKLOG,
      title: getStatusMeta(GAME_STATUSES.BACKLOG).label,
      description: getStatusMeta(GAME_STATUSES.BACKLOG).description,
      games: games.filter((game) => game.status === GAME_STATUSES.BACKLOG),
      empty: getStatusMeta(GAME_STATUSES.BACKLOG).empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.DROPPED,
      title: getStatusMeta(GAME_STATUSES.DROPPED).label,
      description: getStatusMeta(GAME_STATUSES.DROPPED).description,
      games: games.filter((game) => game.status === GAME_STATUSES.DROPPED),
      empty: getStatusMeta(GAME_STATUSES.DROPPED).empty,
      sectionClass: "",
    },
  ];

  gamesListEl.innerHTML = sections
    .map((section) =>
      section.key === GAME_STATUSES.COMPLETED
        ? renderCompletedDeckSection(section, sessionStats)
        : renderGameSection(section, sessionStats)
    )
    .join("");
}

export function renderGameSection(section, sessionStats) {
  return `
    <section class="games-section ${section.sectionClass || ""}">
      <div class="games-section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          <p class="muted-text">${escapeHtml(section.description)}</p>
        </div>
        <span class="section-count">${section.games.length}</span>
      </div>

      <div class="games-list">
        ${
          section.games.length
            ? section.games
                .map((game) => renderGameCard(game, sessionStats))
                .join("")
            : `<div class="empty-state">${escapeHtml(section.empty)}</div>`
        }
      </div>
    </section>
  `;
}

export function renderCompletedDeckSection(section, sessionStats) {
  const deckId = "completedDeckTrack";

  if (!section.games.length) {
    return `
      <section class="games-section ${section.sectionClass || ""}">
        <div class="games-section-header">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p class="muted-text">${escapeHtml(section.description)}</p>
          </div>
          <span class="section-count">0</span>
        </div>
        <div class="empty-state">${escapeHtml(section.empty)}</div>
      </section>
    `;
  }

  return `
    <section class="games-section ${section.sectionClass || ""}">
      <div class="games-section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          <p class="muted-text">${escapeHtml(section.description)}</p>
        </div>
        <span class="section-count">${section.games.length}</span>
      </div>

      <div class="deck-toolbar">
        <div class="summary-row">
          <span class="summary-pill">${escapeHtml(t("tracker.deckHint"))}</span>
        </div>

        <div class="deck-nav">
          <button
            class="secondary-button"
            data-action="scroll-deck"
            data-target="${deckId}"
            data-direction="left"
          >
            ←
          </button>
          <button
            class="secondary-button"
            data-action="scroll-deck"
            data-target="${deckId}"
            data-direction="right"
          >
            →
          </button>
        </div>
      </div>

      <div id="${deckId}" class="completed-deck-track">
        ${section.games
          .map((game) => renderCompletedDeckItem(game, sessionStats))
          .join("")}
      </div>
    </section>
  `;
}

export function renderCompletedDeckItem(game, sessionStats) {
  return `
    <article class="completed-deck-item">
      <button
        type="button"
        class="completion-card-button"
        data-action="open-completion-showcase"
        data-id="${game.id}"
        aria-label="${escapeAttribute(
          t("tracker.completionShowcase.openLabel", { title: game.title })
        )}"
      >
        ${renderCompletionCard(game, sessionStats.get(game.id) || emptySessionStats())}
      </button>
    </article>
  `;
}

export function renderGameCard(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();
  const safeNotes = escapeHtml(getGameObjectiveText(game));
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? getGameCompletionXp(game) : 0);

  const mainBadge = game.isMain
    ? `<span class="badge badge-main">${escapeHtml(
        t("tracker.mainQuest.badge")
      )}</span>`
    : "";

  const statusMeta = getStatusMeta(game.status);
  const statusBadge = TRACKER_BANNER_STATUSES.has(game.status)
    ? `<span class="badge badge-status ${statusMeta.badgeClass}">${escapeHtml(
        statusMeta.label
      )}</span>`
    : "";
  const bannerBadges = [mainBadge, statusBadge].filter(Boolean).join("");

  const cardClasses = ["game-card"];
  if (game.isMain) cardClasses.push("game-card-main");
  if (game.status === GAME_STATUSES.COMPLETED) {
    cardClasses.push("game-card-completed");
  }

  const bannerImage = game.bannerImage || game.coverImage;
  const bannerArt = bannerImage
    ? `<img class="game-card-banner-image" src="${escapeAttribute(
        bannerImage
      )}" alt="" aria-hidden="true" />`
    : "";

  return `
    <article class="${cardClasses.join(" ")}">
      <div class="game-card-banner">
        ${bannerArt}
        <div class="game-card-banner-content">
          <div class="game-card-banner-hero">
            ${renderCoverVisual(game, "game-cover-thumb")}
            <div class="game-card-banner-copy">
              <div class="game-card-banner-heading">
                <h4 class="game-title">${escapeHtml(game.title)}</h4>
              </div>
              ${bannerBadges
                ? `<div class="game-card-banner-badges">${bannerBadges}</div>`
                : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="game-card-body">
        ${renderGameStateHighlight(game)}

        <div class="summary-row">
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.questXp", { xp: totalQuestXp })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.sessions", { count: stats.sessionCount })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.playTime", {
              value: formatMinutes(stats.totalMinutes),
            })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.meaningfulSessions", {
              count: stats.meaningfulCount,
            })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            t("tracker.summaryPills.lastPlayed", {
              value: stats.lastPlayedAt
                ? formatDateTime(stats.lastPlayedAt)
                : t("common.never"),
            })
          )}</span>
          <span class="summary-pill">${escapeHtml(
            getGameRewardText(game)
          )}</span>
        </div>

        ${
          safeNotes
            ? `
            <div class="note-block">
              <p class="note-label">${escapeHtml(t("tracker.notes.currentObjective"))}</p>
              <p class="game-notes">${safeNotes}</p>
            </div>
          `
            : ""
        }

        ${
          latestSessionNote
            ? `
            <div class="note-block">
              <p class="note-label">${escapeHtml(t("tracker.notes.latestSession"))}</p>
              <p class="session-note">${latestSessionNote}</p>
            </div>
          `
            : `<p class="game-meta">${escapeHtml(
                t("tracker.notes.noSessionNote")
              )}</p>`
        }
      </div>

      <div class="game-card-footer">
        <button
          type="button"
          class="secondary-button game-card-action-trigger"
          data-action="open-game-actions"
          data-id="${game.id}"
        >
          ${escapeHtml(t("tracker.actions"))}
        </button>
      </div>
    </article>
  `;
}

const TRACKER_BANNER_STATUSES = new Set([
  GAME_STATUSES.BACKLOG,
  GAME_STATUSES.IN_PROGRESS,
  GAME_STATUSES.COMPLETED,
  GAME_STATUSES.DROPPED,
]);

export function renderGameStateHighlight(game) {
  if (game.status === GAME_STATUSES.COMPLETED && game.completedAt) {
    return `
      <div class="state-highlight state-highlight-completed">
        🏆 ${escapeHtml(
          getCompletedStateText(game, formatDate(game.completedAt))
        )}
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.PAUSED && game.pausedAt) {
    return `
      <div class="state-highlight state-highlight-paused">
        ${escapeHtml(
          t("tracker.state.paused", { date: formatDate(game.pausedAt) })
        )}
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.DROPPED && game.droppedAt) {
    return `
      <div class="state-highlight state-highlight-dropped">
        ${escapeHtml(
          t("tracker.state.dropped", { date: formatDate(game.droppedAt) })
        )}
      </div>
    `;
  }

  return "";
}

export function renderGameStatusActions(game) {
  const actions = [];

  if (game.status === GAME_STATUSES.BACKLOG) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.markInProgress"),
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.drop"),
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.IN_PROGRESS) {
    if (game.isMain) {
      actions.push(
        `<button class="secondary-button" disabled>${escapeHtml(
          t("tracker.actionsMenu.currentMainGame")
        )}</button>`
      );
    } else {
      actions.push(
        createActionButton("make-main", game.id, {
          label: t("tracker.actionsMenu.makeMain"),
          className: "secondary-button",
        })
      );
    }

    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.moveToBacklog"),
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.pause"),
        nextStatus: GAME_STATUSES.PAUSED,
        className: "secondary-button action-warning",
      })
    );
    if (isGameCompletable(game)) {
      actions.push(
        createActionButton("set-status", game.id, {
          label: t("tracker.actionsMenu.complete"),
          nextStatus: GAME_STATUSES.COMPLETED,
          className: "secondary-button action-success",
        })
      );
    }
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.drop"),
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.PAUSED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.resume"),
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.moveToBacklog"),
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    if (isGameCompletable(game)) {
      actions.push(
        createActionButton("set-status", game.id, {
          label: t("tracker.actionsMenu.complete"),
          nextStatus: GAME_STATUSES.COMPLETED,
          className: "secondary-button action-success",
        })
      );
    }
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.drop"),
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.COMPLETED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.playAgain"),
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.moveToBacklog"),
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
  }

  if (game.status === GAME_STATUSES.DROPPED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.moveToBacklog"),
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: t("tracker.actionsMenu.restart"),
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
  }

  return actions.join("");
}

export function createActionButton(action, id, options) {
  const statusAttr = options.nextStatus
    ? ` data-status="${options.nextStatus}"`
    : "";

  return `
    <button
      type="button"
      class="${options.className}"
      data-action="${action}"
      data-id="${id}"${statusAttr}
    >
      ${escapeHtml(options.label)}
    </button>
  `;
}

export function renderGameActionSheet(game) {
  const statusMeta = getStatusMeta(game.status);
  const mainBadge = game.isMain
    ? `<span class="badge badge-main">${escapeHtml(
        t("tracker.mainQuest.badge")
      )}</span>`
    : "";

  return `
    <div class="game-action-sheet-card">
      <div class="game-action-sheet-hero">
        ${renderCoverVisual(game, "game-action-sheet-cover")}
        <div class="game-action-sheet-copy">
          <div class="game-title-row">
            <h3 class="game-action-sheet-title">${escapeHtml(game.title)}</h3>
            ${mainBadge}
            <span class="badge badge-status ${statusMeta.badgeClass}">${escapeHtml(
              statusMeta.label
            )}</span>
          </div>
          <p class="game-action-sheet-meta">
            ${escapeHtml(getGameActionSheetMetaText(game, getPlatformText(game)))}
          </p>
        </div>
      </div>

      ${renderGameActionSessionPanel(game)}

      ${renderGameActionDisclosure({
        title: t("tracker.actionSheetSections.changeStatusTitle"),
        body: t("tracker.actionSheetSections.changeStatusBody"),
        content: `
          <div class="game-actions game-actions-sheet" aria-label="${escapeAttribute(
            `${t("tracker.actions")} ${game.title}`
          )}">
            ${renderGameStatusActions(game)}
          </div>
        `,
      })}

      ${renderGameActionDisclosure({
        title: t("tracker.actionSheetSections.editGoalTitle"),
        body: t("tracker.actionSheetSections.editGoalBody"),
        content: renderGameEditPanel(game),
      })}
    </div>
  `;
}

function renderGameActionSessionPanel(game) {
  if (!canLogSessionForGame(game)) {
    return `
      <section class="game-action-sheet-panel game-action-sheet-panel-muted">
        <div class="game-action-sheet-panel-header">
          <div>
            <p class="eyebrow">${escapeHtml(
              t("tracker.actionSheetSections.logSessionTitle")
            )}</p>
            <p class="game-action-sheet-panel-copy">
              ${escapeHtml(t("tracker.actionSheetSections.logSessionLockedBody"))}
            </p>
          </div>
        </div>
      </section>
    `;
  }

  const gameId = escapeAttribute(game.id);

  return `
    <section class="game-action-sheet-panel">
      <div class="game-action-sheet-panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(
            t("tracker.actionSheetSections.logSessionTitle")
          )}</p>
          <p class="game-action-sheet-panel-copy">
            ${escapeHtml(t("tracker.actionSheetSections.logSessionBody"))}
          </p>
        </div>
      </div>

      <form class="stack-form game-action-session-form" data-game-session-form>
        <input type="hidden" name="gameId" value="${gameId}" />

        <div class="game-action-compact-grid">
          <div class="field">
            <label for="gameActionMinutes-${gameId}">${escapeHtml(
              t("sessions.minutesLabel")
            )}</label>
            <input
              id="gameActionMinutes-${gameId}"
              name="minutes"
              type="number"
              min="1"
              step="1"
              placeholder="${escapeAttribute(t("sessions.minutesPlaceholder"))}"
              required
            />
          </div>

          <div class="field game-action-field-wide">
            <label for="gameActionNote-${gameId}">${escapeHtml(
              t("sessions.noteLabel")
            )}</label>
            <textarea
              id="gameActionNote-${gameId}"
              name="note"
              rows="2"
              placeholder="${escapeAttribute(t("sessions.notePlaceholder"))}"
            ></textarea>
          </div>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" name="meaningfulProgress" />
          <span>${escapeHtml(t("sessions.meaningfulLabel"))}</span>
        </label>

        <p class="game-action-feedback" data-game-action-feedback></p>

        <button type="submit" class="primary-button">
          ${escapeHtml(t("sessions.submit"))}
        </button>
      </form>
    </section>
  `;
}

function renderGameActionDisclosure({ title, body, content }) {
  return `
    <details class="game-action-sheet-section">
      <summary class="game-action-sheet-summary">
        <div class="game-action-sheet-summary-copy">
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(body)}</p>
        </div>
      </summary>
      <div class="game-action-sheet-section-body">
        ${content}
      </div>
    </details>
  `;
}

function renderGameEditPanel(game) {
  const gameId = escapeAttribute(game.id);
  const currentObjective = escapeHtml(getGameObjectiveText(game));
  const hasBuiltInCovers = appState.builtInCoverImageOptions.length > 0;

  return `
    <form class="stack-form game-action-edit-form" data-game-edit-form>
      <input type="hidden" name="gameId" value="${gameId}" />

      <div class="field">
        <label for="gameEditTitle-${gameId}">${escapeHtml(
          t("games.add.titleLabel")
        )}</label>
        <input
          id="gameEditTitle-${gameId}"
          name="title"
          type="text"
          value="${escapeAttribute(game.title)}"
          required
        />
      </div>

      <div class="field">
        <label for="gameEditObjective-${gameId}">${escapeHtml(
          t("games.add.objectiveLabel")
        )}</label>
        <textarea
          id="gameEditObjective-${gameId}"
          name="currentObjective"
          rows="3"
          placeholder="${escapeAttribute(t("games.add.objectivePlaceholder"))}"
        >${currentObjective}</textarea>
      </div>

      <p class="game-action-feedback" data-game-action-feedback></p>

      <button type="submit" class="primary-button">
        ${escapeHtml(t("tracker.actionSheetSections.saveGoalDetails"))}
      </button>
    </form>

    <details class="game-action-sheet-subsection">
      <summary class="game-action-sheet-subsummary">
        ${escapeHtml(t("tracker.actionSheetSections.cardImageTitle"))}
      </summary>
      <div class="game-action-sheet-subsection-body">
        <div class="game-actions game-actions-sheet">
          ${createActionButton("pick-cover-art", game.id, {
            label: game.coverImage
              ? t("tracker.actionsMenu.changeCover")
              : t("tracker.actionsMenu.addCover"),
            className: "secondary-button",
          })}
        </div>

        ${
          hasBuiltInCovers
            ? `
              <details class="game-action-sheet-subsection game-action-sheet-subsection-nested">
                <summary class="game-action-sheet-subsummary">
                  ${escapeHtml(t("tracker.actionSheetSections.useBuiltInCover"))}
                </summary>
                <div class="game-action-sheet-subsection-body">
                  <div class="built-in-cover-button-grid">
                    ${renderBuiltInCoverActionButtons(game)}
                  </div>
                </div>
              </details>
            `
            : ""
        }
      </div>
    </details>

    <details class="game-action-sheet-subsection">
      <summary class="game-action-sheet-subsummary">
        ${escapeHtml(t("tracker.actionSheetSections.bannerImageTitle"))}
      </summary>
      <div class="game-action-sheet-subsection-body">
        <div class="game-actions game-actions-sheet">
          ${createActionButton("pick-banner-art", game.id, {
            label: game.bannerImage
              ? t("tracker.actionsMenu.changeBanner")
              : t("tracker.actionsMenu.addBanner"),
            className: "secondary-button",
          })}
          ${
            game.coverImage || game.bannerImage
              ? createActionButton("clear-art", game.id, {
                  label: t("tracker.actionsMenu.clearArt"),
                  className: "secondary-button action-danger",
                })
              : ""
          }
          ${
            game.status === GAME_STATUSES.COMPLETED
              ? createActionButton("download-card", game.id, {
                  label: t("tracker.actionsMenu.downloadCard"),
                  className: "secondary-button action-success",
                })
              : ""
          }
        </div>
      </div>
    </details>
  `;
}

function renderBuiltInCoverActionButtons(game) {
  return appState.builtInCoverImageOptions.map((option) => {
    const optionLabel = t("games.add.defaultCoverOptionLabel", {
      index: option.index,
    });
    const isSelected = game.coverImage === option.src;

    return `
      <button
        type="button"
        class="built-in-cover-choice-button ${isSelected ? "is-selected" : ""}"
        data-action="set-built-in-cover"
        data-id="${game.id}"
        data-cover-src="${escapeAttribute(option.src)}"
        aria-pressed="${isSelected ? "true" : "false"}"
        title="${escapeAttribute(optionLabel)}"
      >
        <img
          class="built-in-cover-choice-thumb"
          src="${escapeAttribute(option.src)}"
          alt="${escapeAttribute(optionLabel)}"
        />
      </button>
    `;
  }).join("");
}

function renderBuiltInCoverPickerOptions() {
  const noneLabel = t("games.add.defaultCoverNone");
  const selectedCoverSrc = String(selectedBuiltInCoverImageInput?.value || "").trim();
  const loadingMarkup =
    appState.builtInCoverImageOptionsLoading &&
    !appState.builtInCoverImageOptions.length
      ? `
          <div class="built-in-cover-loading" aria-live="polite">
            <span class="built-in-cover-loading-orb" aria-hidden="true"></span>
            <span>${escapeHtml(t("games.add.defaultCoverLoading"))}</span>
          </div>
        `
      : "";
  const optionsMarkup = appState.builtInCoverImageOptions
    .map((option) => {
      const inputId = `defaultCoverImage-${option.index}`;
      const optionLabel = t("games.add.defaultCoverOptionLabel", {
        index: option.index,
      });

      return `
        <input
          id="${escapeAttribute(inputId)}"
          class="built-in-cover-input"
          type="radio"
          name="builtInCoverLibraryOption"
          value="${escapeAttribute(option.src)}"
          ${selectedCoverSrc === option.src ? "checked" : ""}
        />
        <label class="built-in-cover-option" for="${escapeAttribute(inputId)}">
          <img
            class="built-in-cover-thumb"
            src="${escapeAttribute(option.src)}"
            alt="${escapeAttribute(optionLabel)}"
          />
        </label>
      `;
    })
    .join("");

  return `
    <input
      id="defaultCoverImageNone"
      class="built-in-cover-input"
      type="radio"
      name="builtInCoverLibraryOption"
      value=""
      ${selectedCoverSrc ? "" : "checked"}
    />
    <label class="built-in-cover-option is-empty" for="defaultCoverImageNone">
      <span>${escapeHtml(noneLabel)}</span>
    </label>
    ${loadingMarkup}
    ${optionsMarkup}
  `;
}

export function renderCompletionCard(game, stats) {
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? getGameCompletionXp(game) : 0);
  const bannerStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);

  return `
    <div class="completion-card ${tierMeta.className}">
      <div class="completion-card-banner"${bannerStyle}></div>
      <div class="completion-card-content">
        <div class="completion-card-top">
          ${renderCoverVisual(game, "completion-card-cover")}
          <div class="completion-card-heading">
            <div class="game-title-row">
              <h3>${escapeHtml(game.title)}</h3>
              <span class="badge badge-tier ${tierMeta.className}">${escapeHtml(
    tierMeta.label
  )}</span>
            </div>
            <p class="completion-meta">
              ${escapeHtml(
                t("tracker.completionCard.finishedMeta", {
                  platform: getPlatformText(game),
                  date: formatDate(game.completedAt || game.updatedAt),
                })
              )}
            </p>
            <p class="completion-card-flavor">${escapeHtml(tierMeta.subtitle)}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-stat">
            <span class="summary-stat-label">${escapeHtml(
              t("tracker.completionCard.totalPlayTime")
            )}</span>
            <span class="summary-stat-value">${formatMinutes(
              stats.totalMinutes
            )}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">${escapeHtml(
              t("tracker.completionCard.sessions")
            )}</span>
            <span class="summary-stat-value">${stats.sessionCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">${escapeHtml(
              t("tracker.completionCard.meaningful")
            )}</span>
            <span class="summary-stat-value">${stats.meaningfulCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">${escapeHtml(
              t("tracker.completionCard.totalXp")
            )}</span>
            <span class="summary-stat-value">${totalQuestXp}</span>
          </div>
        </div>

        ${
          getGameObjectiveText(game)
            ? `<div class="note-block"><p class="note-label">${escapeHtml(
                t("tracker.notes.currentObjective")
              )}</p><p class="game-notes">${escapeHtml(
                getGameObjectiveText(game)
              )}</p></div>`
            : ""
        }
      </div>
    </div>
  `;
}

export function renderCompletionShowcase(game, statsInput) {
  const stats = statsInput || emptySessionStats();
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? getGameCompletionXp(game) : 0);
  const artStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);
  const showcaseStyle = escapeAttribute(buildCompletionShowcaseStyle(game, tierMeta));
  const metaChips = [
    getPlatformText(game),
    formatDate(game.completedAt || game.updatedAt),
  ]
    .filter(Boolean)
    .map(
      (value) =>
        `<span class="completion-showcase-chip">${escapeHtml(value)}</span>`
    )
    .join("");

  return `
    <div class="completion-showcase-card-shell">
      <article
        class="completion-showcase-card ${tierMeta.className}"
        data-completion-showcase-card
        style="${showcaseStyle}"
      >
        <div class="completion-showcase-card-inner">
          <header class="completion-showcase-header">
            <div class="completion-showcase-nameplate">
              <span class="completion-showcase-tier">${escapeHtml(tierMeta.label)}</span>
              <h2 id="completionShowcaseTitle">${escapeHtml(game.title)}</h2>
            </div>
            <div class="completion-showcase-xp">
              <span class="completion-showcase-xp-label">${escapeHtml(
                t("tracker.completionShowcase.xpShort")
              )}</span>
              <strong>${totalQuestXp}</strong>
            </div>
          </header>

          <div class="completion-showcase-art-shell"${artStyle}>
            <div class="completion-showcase-art-frame">
              ${renderCoverVisual(game, "completion-showcase-cover")}
            </div>
            <div class="completion-showcase-meta-row">
              ${metaChips}
            </div>
          </div>

          <div class="completion-showcase-stats">
            <div class="completion-showcase-stat">
              <span class="completion-showcase-stat-label">${escapeHtml(
                t("tracker.completionShowcase.time")
              )}</span>
              <strong class="completion-showcase-stat-value">${formatMinutes(
                stats.totalMinutes
              )}</strong>
            </div>
            <div class="completion-showcase-stat">
              <span class="completion-showcase-stat-label">${escapeHtml(
                t("tracker.completionShowcase.sessions")
              )}</span>
              <strong class="completion-showcase-stat-value">${stats.sessionCount}</strong>
            </div>
            <div class="completion-showcase-stat">
              <span class="completion-showcase-stat-label">${escapeHtml(
                t("tracker.completionShowcase.meaningful")
              )}</span>
              <strong class="completion-showcase-stat-value">${stats.meaningfulCount}</strong>
            </div>
          </div>
        </div>
      </article>
    </div>
  `;
}

function getPlatformText(game) {
  const value = String(game?.platform || "").trim();
  return !value || value === "Unspecified" ? t("common.unspecified") : value;
}

function buildCompletionShowcaseStyle(game, tierMeta) {
  const seed = hashString(`${game.id}:${game.title}:showcase`);
  const sheenX = 12 + (seed % 58);
  const sheenY = 16 + ((seed >> 3) % 44);
  const glowX = 18 + ((seed >> 5) % 46);
  const glowY = 14 + ((seed >> 7) % 52);
  const drift = -18 + ((seed >> 9) % 36);

  return [
    `--completion-showcase-accent-a:${tierMeta?.accentA || "#c084fc"}`,
    `--completion-showcase-accent-b:${tierMeta?.accentB || "#7c3aed"}`,
    `--completion-showcase-accent-text:${tierMeta?.accentText || "#f8fafc"}`,
    `--completion-showcase-base-sheen-x:${sheenX}%`,
    `--completion-showcase-base-sheen-y:${sheenY}%`,
    `--completion-showcase-base-glow-x:${glowX}%`,
    `--completion-showcase-base-glow-y:${glowY}%`,
    `--completion-showcase-drift:${drift}%`,
    "--completion-showcase-pointer-sheen-x:0%",
    "--completion-showcase-pointer-sheen-y:0%",
    "--completion-showcase-pointer-glow-x:0%",
    "--completion-showcase-pointer-glow-y:0%",
    "--completion-showcase-pointer-drift:0%",
    "--completion-showcase-rotate-x:0deg",
    "--completion-showcase-rotate-y:0deg",
  ].join(";");
}
