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

export function renderSessionGameOptions(games) {
  const previousValue = sessionGameSelect.value;
  const availableGames = sortSessionTargets(games.filter(canLogSessionForGame));

  if (availableGames.length === 0) {
    sessionGameSelect.innerHTML =
      '<option value="">Move a game to In Progress first</option>';
    sessionGameSelect.disabled = true;
    return;
  }

  sessionGameSelect.disabled = false;

  sessionGameSelect.innerHTML = availableGames
    .map((game) => {
      const prefix = game.isMain ? "🎯 " : "";
      const suffix =
        game.status === GAME_STATUSES.COMPLETED ? " (completed replay)" : "";
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
    recentSessionsSummaryEl.textContent = "No sessions logged yet.";
    recentSessionsListEl.innerHTML = `
      <div class="empty-state">
        Log your first session to start building momentum.
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
      ? "Showing your 1 logged session."
      : `Showing your latest ${visibleSessions.length} of ${sortedSessions.length} sessions.`;

  recentSessionsListEl.innerHTML = `
    ${renderSessionCards(visibleSessions, gameMap)}
    ${
      hiddenSessions.length
        ? `
            <details class="sessions-expand-panel">
              <summary>Show ${hiddenSessions.length} older session${
                hiddenSessions.length === 1 ? "" : "s"
              }</summary>
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
        ? '<span class="badge badge-progress">Meaningful progress</span>'
        : '<span class="badge badge-neutral">Light session</span>';
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
              ? `<div class="note-block"><p class="note-label">Session note</p><p class="session-note">${safeNote}</p></div>`
              : '<p class="session-meta">No note for this session.</p>'
          }
          ${focusTaxNote}
        </article>
      `;
    })
    .join("");
}
