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
import { CARD_TIER_META, GAME_DIFFICULTY_META, GAME_STATUSES, XP_RULES } from "../../core/constants.js";
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
  isGameCompletable,
  renderCoverVisual,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";

export function renderPlayerProgress(summary) {
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
    total: XP_RULES.xpPerLevel,
    nextLevel: summary.level + 1,
  });
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
  mainGameNameEl.textContent = mainGame ? mainGame.title : t("common.noneSet");

  const streak = computeStreak(sessions);
  currentStreakEl.textContent = `${streak} ${t("common.dayWord", { count: streak })}`;
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
      ${renderCompletionCard(game, sessionStats.get(game.id) || emptySessionStats())}
      <div class="game-card-footer completed-card-actions">
        <button
          type="button"
          class="secondary-button game-card-action-trigger"
          data-action="open-game-actions"
          data-id="${game.id}"
        >
          ${escapeHtml(t("tracker.manageCard"))}
        </button>
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
    (game.status === GAME_STATUSES.COMPLETED ? getGameCompletionXp(game) : 0);

  const mainBadge = game.isMain
    ? `<span class="badge badge-main">${escapeHtml(
        t("tracker.mainQuest.badge")
      )}</span>`
    : "";

  const statusMeta = getStatusMeta(game.status);
  const difficultyMeta = GAME_DIFFICULTY_META[game.difficulty];

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
                <p class="game-meta">${escapeHtml(
                  t("tracker.summaryPills.platform", {
                    value: getPlatformText(game),
                  })
                )}</p>
              </div>
              <div class="game-card-banner-badges">
                ${mainBadge}
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

export function renderGameActions(game) {
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
    actions.push(
      createActionButton("download-card", game.id, {
        label: t("tracker.actionsMenu.downloadCard"),
        className: "secondary-button action-success",
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

  actions.push(
    createActionButton("pick-cover-art", game.id, {
      label: game.coverImage
        ? t("tracker.actionsMenu.changeCover")
        : t("tracker.actionsMenu.addCover"),
      className: "secondary-button",
    })
  );

  actions.push(
    createActionButton("pick-banner-art", game.id, {
      label: game.bannerImage
        ? t("tracker.actionsMenu.changeBanner")
        : t("tracker.actionsMenu.addBanner"),
      className: "secondary-button",
    })
  );

  if (game.coverImage || game.bannerImage) {
    actions.push(
      createActionButton("clear-art", game.id, {
        label: t("tracker.actionsMenu.clearArt"),
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

      <div class="game-actions game-actions-sheet" aria-label="${escapeAttribute(
        `${t("tracker.actions")} ${game.title}`
      )}">
        ${renderGameActions(game)}
      </div>
    </div>
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
    </article>
  `;
}

function getPlatformText(game) {
  const value = String(game?.platform || "").trim();
  return !value || value === "Unspecified" ? t("common.unspecified") : value;
}
