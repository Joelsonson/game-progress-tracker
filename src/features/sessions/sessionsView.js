import { recentSessionsListEl, recentSessionsSummaryEl, sessionGameSelect } from "../../core/dom.js";
import { GAME_STATUSES } from "../../core/constants.js";
import {
  canLogSessionForGame,
  escapeHtml,
  formatDateTime,
  formatMinutes,
  getSessionXpBreakdown,
  sortSessionTargets,
} from "../../core/formatters.js";
import { t } from "../../core/i18n.js";

export function renderSessionGameOptions(games) {
  const previousValue = sessionGameSelect.value;
  const availableGames = sortSessionTargets(games.filter(canLogSessionForGame));

  if (availableGames.length === 0) {
    sessionGameSelect.innerHTML =
      `<option value="">${escapeHtml(t("sessions.gameEmpty"))}</option>`;
    sessionGameSelect.disabled = true;
    return;
  }

  sessionGameSelect.disabled = false;

  sessionGameSelect.innerHTML = availableGames
    .map((game) => {
      const prefix = game.isMain ? "🎯 " : "";
      const suffix =
        game.status === GAME_STATUSES.COMPLETED
          ? ` ${t("status.completionReplaySuffix")}`
          : "";
      return `<option value="${game.id}">${prefix}${escapeHtml(
        game.title
      )}${suffix}</option>`;
    })
    .join("");

  const hasPreviousValue = availableGames.some(
    (game) => game.id === previousValue
  );
  const defaultGame = hasPreviousValue
    ? previousValue
    : availableGames.find((game) => game.isMain)?.id || availableGames[0].id;

  sessionGameSelect.value = defaultGame;
}

export function renderRecentSessions(games, sessions) {
  if (sessions.length === 0) {
    recentSessionsSummaryEl.textContent = t("sessions.recentEmptySummary");
    recentSessionsListEl.innerHTML = `
      <div class="empty-state">
        ${escapeHtml(t("sessions.recentEmptyState"))}
      </div>
    `;
    return;
  }

  const gameMap = new Map(games.map((game) => [game.id, game]));
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.playedAt) - new Date(a.playedAt)
  );
  const visibleSessions = sortedSessions.slice(0, 3);
  const hiddenSessions = sortedSessions.slice(3);

  recentSessionsSummaryEl.textContent =
    sortedSessions.length === 1
      ? t("sessions.recentSingle")
      : t("sessions.recentMany", {
          visible: visibleSessions.length,
          total: sortedSessions.length,
        });

  recentSessionsListEl.innerHTML = `
    ${renderSessionCards(visibleSessions, gameMap)}
    ${
      hiddenSessions.length
        ? `
            <details class="sessions-expand-panel">
              <summary>${escapeHtml(
                t("sessions.showOlder", {
                  count: hiddenSessions.length,
                  sessionWord: t("common.sessionWord", {
                    count: hiddenSessions.length,
                  }),
                })
              )}</summary>
              <div class="sessions-expand-list">
                ${renderSessionCards(hiddenSessions, gameMap)}
              </div>
            </details>
          `
        : ""
    }
  `;
}

function renderSessionCards(sessions, gameMap) {
  return sessions
    .map((session) => {
      const relatedGame = gameMap.get(session.gameId);
      const gameTitle = escapeHtml(relatedGame?.title || "Unknown game");
      const safeNote = escapeHtml(session.note || "");
      const progressBadge = session.meaningfulProgress
        ? `<span class="badge badge-progress">${escapeHtml(
            t("sessions.card.meaningful")
          )}</span>`
        : `<span class="badge badge-neutral">${escapeHtml(
            t("sessions.card.light")
          )}</span>`;
      const xpBreakdown = getSessionXpBreakdown(session);
      const xpBadgeClass =
        xpBreakdown.total >= 0
          ? "badge session-xp"
          : "badge session-xp session-xp-negative";
      const focusTaxNote = session.focusPenaltyXp
        ? `<p class="focus-tax-note">${escapeHtml(
            session.focusPenaltyReason || "Focus tax"
          )} • ${xpBreakdown.focusPenalty}</p>`
        : "";

      return `
        <article class="session-card">
          <div class="session-card-header">
            <div>
              <h3 class="session-title">${gameTitle}</h3>
              <p class="session-meta">${formatDateTime(
                session.playedAt
              )} • ${formatMinutes(session.minutes)}</p>
            </div>
            <div class="session-badges">
              ${progressBadge}
              <span class="${xpBadgeClass}">${xpBreakdown.totalText}</span>
            </div>
          </div>

          ${
            safeNote
              ? `<div class="note-block"><p class="note-label">${escapeHtml(
                  t("sessions.card.sessionNote")
                )}</p><p class="session-note">${safeNote}</p></div>`
              : `<p class="session-meta">${escapeHtml(
                  t("sessions.card.noNote")
                )}</p>`
          }
          ${focusTaxNote}
        </article>
      `;
    })
    .join("");
}
