import {
  completionSpotlightEl,
  completedCountEl,
  currentStreakEl,
  gamesListEl,
  inProgressCountEl,
  listSummaryEl,
  mainGameNameEl,
  mainQuestPanelEl,
  playerLevelEl,
  playerRankEl,
  totalGamesEl,
  totalSessionsEl,
  totalXpEl,
  todayXpEl,
  xpProgressFillEl,
  xpProgressTextEl,
  xpToNextLevelEl,
} from "../../core/dom.js";
import { CARD_TIER_META, GAME_STATUSES, STATUS_META, XP_RULES } from "../../core/constants.js";
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
  getGameObjectiveText,
  renderCoverVisual,
} from "../../core/formatters.js";

export function renderPlayerProgress(summary) {
  if (!playerLevelEl) return;

  playerRankEl.textContent = summary.rankTitle;
  playerLevelEl.textContent = String(summary.level);
  totalXpEl.textContent = String(summary.totalXp);
  todayXpEl.textContent = String(summary.todayXp);
  xpToNextLevelEl.textContent = `${summary.xpToNextLevel} XP`;
  xpProgressTextEl.textContent = `${summary.xpIntoLevel} / ${XP_RULES.xpPerLevel} XP to level ${
    summary.level + 1
  }`;
  xpProgressFillEl.style.width = `${summary.progressPercent}%`;
}

export function renderStats(games, sessions) {
  totalGamesEl.textContent = String(games.length);
  inProgressCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.IN_PROGRESS).length
  );
  completedCountEl.textContent = String(
    games.filter((game) => game.status === GAME_STATUSES.COMPLETED).length
  );
  totalSessionsEl.textContent = String(sessions.length);

  const mainGame = games.find((game) => game.isMain);
  mainGameNameEl.textContent = mainGame ? mainGame.title : "None set";

  const streak = computeStreak(sessions);
  currentStreakEl.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
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
        <p class="eyebrow">Finish unlocked</p>
        <h2>Completion card ready</h2>
        <p class="completion-meta">
          Finished ${formatDate(latestCompletedGame.completedAt)} • ${
    stats.sessionCount
  } ${stats.sessionCount === 1 ? "session" : "sessions"} • ${formatMinutes(
    stats.totalMinutes
  )} total play time
        </p>
      </div>
      <button
        class="secondary-button action-success"
        data-action="download-card"
        data-id="${latestCompletedGame.id}"
      >
        Download card
      </button>
    </div>

    ${renderCompletionCard(latestCompletedGame, stats)}

    <p class="completion-note">
      Your latest finished game now gets a collectible-style finish card with art,
      stats, and a printable PNG export.
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
      <p class="eyebrow">Main quest</p>
      <h2>No active quest yet</h2>
      <p class="muted-text">
        Move one game into In Progress and make it your Main Game.
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
      <p class="eyebrow">Main quest</p>

      <div class="quest-hero-banner"${bannerStyle}>
        <div class="quest-hero-content">
          <div class="quest-hero-top">
            ${renderCoverVisual(mainGame, "quest-cover-thumb")}
            <div class="quest-hero-text">
              <div class="game-title-row">
                <h2>🎯 ${escapeHtml(mainGame.title)}</h2>
                <span class="badge badge-main">Main Game</span>
              </div>
              <p class="muted-text">
                ${stats.sessionCount} ${stats.sessionCount === 1 ? "session" : "sessions"} •
                ${formatMinutes(stats.totalMinutes)} played •
                ${stats.meaningfulCount} meaningful
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-row">
        <span class="summary-pill">Quest XP: ${stats.totalXp}</span>
        <span class="summary-pill">Last played: ${
          stats.lastPlayedAt ? formatDateTime(stats.lastPlayedAt) : "Never"
        }</span>
        <span class="summary-pill">Platform: ${escapeHtml(
          mainGame.platform || "Unspecified"
        )}</span>
      </div>

      ${
        objective
          ? `<div class="note-block"><p class="note-label">Current objective</p><p class="game-notes">${objective}</p></div>`
          : '<p class="muted-text">No current objective set yet.</p>'
      }

      ${
        latestSessionNote
          ? `<div class="note-block"><p class="note-label">Latest session</p><p class="session-note">${latestSessionNote}</p></div>`
          : '<p class="muted-text">No session note yet.</p>'
      }
    </div>
  `;
}

export function renderGames(games, sessionStats) {
  if (games.length === 0) {
    listSummaryEl.textContent = "No games saved yet.";
    gamesListEl.innerHTML = `
      <div class="empty-state">
        Add your first game to start building a finishable list.
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

  listSummaryEl.textContent = `${games.length} tracked • ${counts.inProgress} in progress • ${counts.completed} completed • ${counts.backlog} backlog`;

  const mainGame = games.find((game) => game.isMain) || null;

  const sections = [
    {
      key: "main-quest",
      title: "Main Game",
      description:
        "Your current focus target. Keep chipping away until it joins the completed shelf.",
      games: mainGame ? [mainGame] : [],
      empty: "No main game set yet.",
      sectionClass: "games-section-main",
    },
    {
      key: GAME_STATUSES.IN_PROGRESS,
      title: STATUS_META[GAME_STATUSES.IN_PROGRESS].label,
      description: STATUS_META[GAME_STATUSES.IN_PROGRESS].description,
      games: games.filter(
        (game) => game.status === GAME_STATUSES.IN_PROGRESS && !game.isMain
      ),
      empty: STATUS_META[GAME_STATUSES.IN_PROGRESS].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.COMPLETED,
      title: "Completed deck",
      description:
        "Finished games now live in a scrollable card shelf so they feel like actual unlocks instead of plain tracker rows.",
      games: games.filter((game) => game.status === GAME_STATUSES.COMPLETED),
      empty: STATUS_META[GAME_STATUSES.COMPLETED].empty,
      sectionClass: "completed-deck-section",
    },
    {
      key: GAME_STATUSES.PAUSED,
      title: STATUS_META[GAME_STATUSES.PAUSED].label,
      description: STATUS_META[GAME_STATUSES.PAUSED].description,
      games: games.filter((game) => game.status === GAME_STATUSES.PAUSED),
      empty: STATUS_META[GAME_STATUSES.PAUSED].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.BACKLOG,
      title: STATUS_META[GAME_STATUSES.BACKLOG].label,
      description: STATUS_META[GAME_STATUSES.BACKLOG].description,
      games: games.filter((game) => game.status === GAME_STATUSES.BACKLOG),
      empty: STATUS_META[GAME_STATUSES.BACKLOG].empty,
      sectionClass: "",
    },
    {
      key: GAME_STATUSES.DROPPED,
      title: STATUS_META[GAME_STATUSES.DROPPED].label,
      description: STATUS_META[GAME_STATUSES.DROPPED].description,
      games: games.filter((game) => game.status === GAME_STATUSES.DROPPED),
      empty: STATUS_META[GAME_STATUSES.DROPPED].empty,
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
          <span class="summary-pill">Swipe or tap through your finished cards</span>
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
  const stats = sessionStats.get(game.id) || emptySessionStats();

  return `
    <article class="completed-deck-item">
      ${renderCompletionCard(game, stats)}
      <div class="game-actions completed-card-actions">
        ${createActionButton("download-card", game.id, {
          label: "Download Card",
          className: "secondary-button action-success",
        })}
        ${createActionButton("set-status", game.id, {
          label: "Play Again",
          nextStatus: GAME_STATUSES.IN_PROGRESS,
          className: "primary-button",
        })}
        ${createActionButton("pick-cover-art", game.id, {
          label: game.coverImage ? "Change Cover" : "Add Cover",
          className: "secondary-button",
        })}
        ${createActionButton("pick-banner-art", game.id, {
          label: game.bannerImage ? "Change Banner" : "Add Banner",
          className: "secondary-button",
        })}
      </div>
    </article>
  `;
}

export function renderGameCard(game, sessionStats) {
  const stats = sessionStats.get(game.id) || emptySessionStats();
  const safeNotes = escapeHtml(getGameObjectiveText(game));
  const latestSessionNote = escapeHtml(stats.latestSession?.note || "");
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? XP_RULES.completionBonus : 0);

  const mainBadge = game.isMain
    ? '<span class="badge badge-main">Main Game</span>'
    : "";

  const statusMeta =
    STATUS_META[game.status] || STATUS_META[GAME_STATUSES.BACKLOG];

  const cardClasses = ["game-card"];
  if (game.isMain) cardClasses.push("game-card-main");
  if (game.status === GAME_STATUSES.COMPLETED) {
    cardClasses.push("game-card-completed");
  }

  const bannerStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);

  return `
    <article class="${cardClasses.join(" ")}">
      <div class="game-card-banner"${bannerStyle}>
        <div class="game-card-body">
          <div class="game-card-top">
            ${renderCoverVisual(game, "game-cover-thumb")}
            <div class="game-card-info">
              <div class="game-title-row">
                <h4 class="game-title">${escapeHtml(game.title)}</h4>
                ${mainBadge}
                <span class="badge badge-status ${statusMeta.badgeClass}">${escapeHtml(
    statusMeta.label
  )}</span>
              </div>
              <p class="game-meta">Platform: ${escapeHtml(
                game.platform || "Unspecified"
              )}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="game-card-body">
        ${renderGameStateHighlight(game)}

        <div class="summary-row">
          <span class="summary-pill">XP: ${totalQuestXp}</span>
          <span class="summary-pill">Sessions: ${stats.sessionCount}</span>
          <span class="summary-pill">Play time: ${formatMinutes(
            stats.totalMinutes
          )}</span>
          <span class="summary-pill">Meaningful sessions: ${
            stats.meaningfulCount
          }</span>
          <span class="summary-pill">Last played: ${
            stats.lastPlayedAt ? formatDateTime(stats.lastPlayedAt) : "Never"
          }</span>
        </div>

        ${
          safeNotes
            ? `
            <div class="note-block">
              <p class="note-label">Current objective</p>
              <p class="game-notes">${safeNotes}</p>
            </div>
          `
            : ""
        }

        ${
          latestSessionNote
            ? `
            <div class="note-block">
              <p class="note-label">Latest session</p>
              <p class="session-note">${latestSessionNote}</p>
            </div>
          `
            : '<p class="game-meta">No session note yet.</p>'
        }
      </div>

      <div class="game-actions" aria-label="Game actions for ${escapeAttribute(
        game.title
      )}">
        ${renderGameActions(game)}
      </div>
    </article>
  `;
}

export function renderGameStateHighlight(game) {
  if (game.status === GAME_STATUSES.COMPLETED && game.completedAt) {
    return `
      <div class="state-highlight state-highlight-completed">
        🏆 Finished on ${formatDate(game.completedAt)} • +${XP_RULES.completionBonus} XP
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.PAUSED && game.pausedAt) {
    return `
      <div class="state-highlight state-highlight-paused">
        Paused on ${formatDate(game.pausedAt)}
      </div>
    `;
  }

  if (game.status === GAME_STATUSES.DROPPED && game.droppedAt) {
    return `
      <div class="state-highlight state-highlight-dropped">
        Dropped on ${formatDate(game.droppedAt)}
      </div>
    `;
  }

  return "";
}

export function renderGameActions(game) {
  const actions = [];

  if (game.status === GAME_STATUSES.BACKLOG) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Mark In Progress",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.IN_PROGRESS) {
    if (game.isMain) {
      actions.push(
        '<button class="secondary-button" disabled>Current Main Game</button>'
      );
    } else {
      actions.push(
        createActionButton("make-main", game.id, {
          label: "Make Main",
          className: "secondary-button",
        })
      );
    }

    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Pause",
        nextStatus: GAME_STATUSES.PAUSED,
        className: "secondary-button action-warning",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Complete",
        nextStatus: GAME_STATUSES.COMPLETED,
        className: "secondary-button action-success",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.PAUSED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Resume",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Complete",
        nextStatus: GAME_STATUSES.COMPLETED,
        className: "secondary-button action-success",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Drop",
        nextStatus: GAME_STATUSES.DROPPED,
        className: "secondary-button action-danger",
      })
    );
  }

  if (game.status === GAME_STATUSES.COMPLETED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Play Again",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("download-card", game.id, {
        label: "Download Card",
        className: "secondary-button action-success",
      })
    );
  }

  if (game.status === GAME_STATUSES.DROPPED) {
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Move to Backlog",
        nextStatus: GAME_STATUSES.BACKLOG,
        className: "secondary-button",
      })
    );
    actions.push(
      createActionButton("set-status", game.id, {
        label: "Restart",
        nextStatus: GAME_STATUSES.IN_PROGRESS,
        className: "primary-button",
      })
    );
  }

  actions.push(
    createActionButton("pick-cover-art", game.id, {
      label: game.coverImage ? "Change Cover" : "Add Cover",
      className: "secondary-button",
    })
  );

  actions.push(
    createActionButton("pick-banner-art", game.id, {
      label: game.bannerImage ? "Change Banner" : "Add Banner",
      className: "secondary-button",
    })
  );

  if (game.coverImage || game.bannerImage) {
    actions.push(
      createActionButton("clear-art", game.id, {
        label: "Clear Art",
        className: "secondary-button action-danger",
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
      class="${options.className}"
      data-action="${action}"
      data-id="${id}"${statusAttr}
    >
      ${escapeHtml(options.label)}
    </button>
  `;
}

export function renderCompletionCard(game, stats) {
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? XP_RULES.completionBonus : 0);
  const bannerStyle = buildArtBackgroundStyle(game.bannerImage || game.coverImage);

  return `
    <article class="completion-card ${tierMeta.className}">
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
              ${escapeHtml(game.platform || "Unspecified")} • Finished ${formatDate(
    game.completedAt || game.updatedAt
  )}
            </p>
            <p class="completion-card-flavor">${escapeHtml(tierMeta.subtitle)}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-stat">
            <span class="summary-stat-label">Total play time</span>
            <span class="summary-stat-value">${formatMinutes(
              stats.totalMinutes
            )}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Sessions</span>
            <span class="summary-stat-value">${stats.sessionCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Meaningful sessions</span>
            <span class="summary-stat-value">${stats.meaningfulCount}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Quest XP</span>
            <span class="summary-stat-value">${totalQuestXp}</span>
          </div>
        </div>

        ${
          getGameObjectiveText(game)
            ? `<div class="note-block"><p class="note-label">Final note</p><p class="game-notes">${escapeHtml(
                getGameObjectiveText(game)
              )}</p></div>`
            : ""
        }
      </div>
    </article>
  `;
}
