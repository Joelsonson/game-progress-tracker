import {
  characterContentEl,
  homeJourneyContentEl,
  journeyContentEl,
  journeyEventBodyEl,
  journeyEventMetaEl,
  journeyEventModal,
  journeyEventTitleEl,
  journeyOutcomeBodyEl,
  journeyOutcomeMetaEl,
  journeyOutcomeModal,
  journeyOutcomeTitleEl,
} from "../../core/dom.js";
import {
  JOURNEY_BASE_CLASS,
  JOURNEY_CLASS_META,
  JOURNEY_STAT_KEYS,
  JOURNEY_STAT_META,
} from "../../core/constants.js";
import {
  clamp,
  escapeAttribute,
  escapeHtml,
  formatDateTime,
} from "../../core/formatters.js";
import { syncBodyScrollLock } from "../../core/ui.js";
import {
  buildJourneyDerived,
  buildJourneyStretchPresentation,
  buildJourneySupplies,
  formatDurationRangeHours,
  getJourneyActivityText,
  getJourneyBoss,
  getJourneyLevel,
  getJourneySegmentProgress,
  getJourneyStatusLabel,
  getJourneyStoryLevelBonus,
  getJourneyZoneName,
  getRecoveryText,
  getUnspentSkillPoints,
} from "./journeyEngine.js";

const JOURNEY_WALK_SPRITE = {
  src: "./assets/journey/sprites/Walking.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 136,
  maxDisplayHeight: 168,
};

const JOURNEY_PORTRAIT_SPRITE = {
  src: "./assets/journey/sprites/Idlethink.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 176,
  maxDisplayHeight: 220,
};

const JOURNEY_SPRITE_BOUNDING_PADDING = 12;
const JOURNEY_SPRITE_BACKGROUND_TOLERANCE = 24;
const JOURNEY_SPRITE_ALPHA_THRESHOLD = 12;
const journeySpriteMetricsCache = new Map();

export function renderHomeJourney(state, xpSummary) {
  if (!homeJourneyContentEl) return;

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats
  );
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const pendingEvent = state.pendingEvents[0] || null;
  const advancedClassCount = state.unlockedClasses.filter(
    (classKey) => classKey !== JOURNEY_BASE_CLASS
  ).length;
  const displayName = getJourneyDisplayName(state);

  homeJourneyContentEl.innerHTML = `
    <div class="journey-home-shell">
      <div class="journey-home-top">
        <div class="journey-home-copy">
          <p class="eyebrow">Journey at a glance</p>
          <h2>${escapeHtml(displayName)}</h2>
          <p class="muted-text">
            ${escapeHtml(getJourneyActivityText(state, boss, progress, journeyStats))}
          </p>

          ${renderJourneySpriteBanner(JOURNEY_WALK_SPRITE, {
            wrapperClass: "journey-home-sprite-banner",
            stageClass: "journey-sprite-stage-banner",
            label: "On the road",
          })}

          <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${progress.percent}%"></div>
          </div>

          <div class="journey-progress-meta">
            <span>${stretchPresentation.currentLabel}</span>
            <span>${stretchPresentation.remainingLabel}</span>
          </div>

          <div class="summary-row">
            <span class="summary-pill">Current goal: ${escapeHtml(
              stretchPresentation.goalTitle
            )}</span>
            <span class="summary-pill">${escapeHtml(
              stretchPresentation.horizonLabel
            )}: ${escapeHtml(stretchPresentation.horizonValue)}</span>
            <span class="summary-pill">Road cleared: ${state.bossIndex}</span>
            <span class="summary-pill">Discipline: ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</span>
            <span class="summary-pill">Unlocked paths: ${advancedClassCount}</span>
            ${
              pendingEvent
                ? `<span class="summary-pill">Event waiting</span>`
                : ""
            }
          </div>
        </div>

        <div class="journey-home-meters">
          <div>
            <p class="journey-overline">Condition</p>
            <h3>Lv. ${journeyLevel} ${escapeHtml(
              JOURNEY_CLASS_META[state.classType].label
            )}</h3>
            <p class="journey-inline-copy">
              Started with a ${escapeHtml(state.starterItem)} • ${getJourneyStatusLabel(state.status)}
            </p>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>Health</span>
              <span>${Math.round(state.currentHp)} / ${journeyStats.maxHp}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-health" style="width: ${hpPercent}%"></div>
            </div>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>Hunger</span>
              <span>${Math.round(state.currentHunger)} / ${journeyStats.maxHunger}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-hunger" style="width: ${hungerPercent}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="journey-home-actions">
        <button type="button" class="secondary-button" data-home-action="open-journey">
          Open journey
        </button>
        ${
          pendingEvent
            ? `
              <button
                type="button"
                class="primary-button"
                data-home-action="open-event"
                data-event-id="${pendingEvent.id}"
              >
                Something happened
              </button>
            `
            : ""
        }
      </div>
    </div>
  `;
}

export function openJourneyEventModal(eventEntry) {
  if (!journeyEventModal || !journeyEventBodyEl || !journeyEventTitleEl || !journeyEventMetaEl) {
    return;
  }

  journeyEventTitleEl.textContent = eventEntry.title;
  journeyEventMetaEl.textContent = `${formatDateTime(eventEntry.createdAt)} • ${eventEntry.teaser}`;
  journeyEventBodyEl.innerHTML = `
    <div class="journey-event-panel">
      <p>${escapeHtml(eventEntry.detail)}</p>
    </div>

    <div class="journey-event-choice-list">
      ${eventEntry.choices
        .map(
          (choice) => `
            <button
              type="button"
              class="secondary-button journey-event-choice"
              data-journey-event-choice="resolve"
              data-event-id="${eventEntry.id}"
              data-choice-id="${choice.id}"
            >
              <strong>${escapeHtml(choice.label)}</strong>
              <span>${escapeHtml(choice.preview)}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  journeyEventModal.hidden = false;
  syncBodyScrollLock();
}

export function closeJourneyEventModal() {
  if (!journeyEventModal) return;
  journeyEventModal.hidden = true;
  if (journeyEventBodyEl) journeyEventBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function openJourneyOutcomeModal(eventEntry, choice, resultText, outcomeItems) {
  if (
    !journeyOutcomeModal ||
    !journeyOutcomeBodyEl ||
    !journeyOutcomeTitleEl ||
    !journeyOutcomeMetaEl
  ) {
    return;
  }

  journeyOutcomeTitleEl.textContent = eventEntry?.title || "What happened next";
  journeyOutcomeMetaEl.textContent = choice?.label
    ? `You chose: ${choice.label}`
    : "The road answered your choice.";
  journeyOutcomeBodyEl.innerHTML = `
    <div class="journey-event-panel journey-outcome-panel">
      <p>${escapeHtml(resultText)}</p>
      ${
        outcomeItems.length
          ? `
            <div class="journey-outcome-pill-row">
              ${outcomeItems
                .map(
                  (item) => `
                    <span class="journey-outcome-pill ${escapeAttribute(
                      item.className
                    )}">${escapeHtml(item.label)}</span>
                  `
                )
                .join("")}
            </div>
          `
          : `<p class="muted-text">Nothing shifted in a way you could clearly measure.</p>`
      }
    </div>
  `;

  journeyOutcomeModal.hidden = false;
  syncBodyScrollLock();
}

export function closeJourneyOutcomeModal() {
  if (!journeyOutcomeModal) return;
  journeyOutcomeModal.hidden = true;
  if (journeyOutcomeBodyEl) journeyOutcomeBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function renderIdleJourney(state, games, sessions, xpSummary) {
  if (!journeyContentEl) return;

  const viewModel = buildJourneyViewModel(state, games, sessions, xpSummary);
  const pendingEventsMarkup = viewModel.state.pendingEvents.length
    ? `
        <article class="journey-side-card journey-alert-card">
          <p class="journey-overline">Event queue</p>
          <h4>Something happened</h4>
          <p class="muted-text">
            The road has a way of forcing decisions on you.
          </p>
          <div class="journey-event-list">
            ${viewModel.state.pendingEvents
              .map(
                (eventEntry) => `
                  <button
                    type="button"
                    class="secondary-button journey-event-button"
                    data-journey-action="open-event"
                    data-event-id="${eventEntry.id}"
                  >
                    <span>
                      <span class="journey-event-kicker">New event</span>
                      <strong>${escapeHtml(eventEntry.title)}</strong>
                    </span>
                    <span class="journey-event-summary">${escapeHtml(eventEntry.teaser)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </article>
      `
    : `
        <article class="journey-side-card">
          <p class="journey-overline">Quiet stretch</p>
          <h4>No immediate event</h4>
          <p class="muted-text">
            Nothing urgent is waiting. For now, the road is only asking you to keep moving.
          </p>
        </article>
      `;

  journeyContentEl.innerHTML = `
    <section class="journey-route-card">
      <div class="journey-route-hero">
        <div class="journey-route-copy">
          <p class="journey-overline">Current stretch</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(viewModel.displayName)} • Lv. ${viewModel.journeyLevel}</h3>
            <span class="journey-chip is-active">${escapeHtml(viewModel.zoneName)}</span>
            <span class="journey-chip">${escapeHtml(viewModel.statusLabel)}</span>
            ${
              viewModel.state.pendingEvents.length
                ? `<span class="journey-chip is-warning">${viewModel.state.pendingEvents.length} event waiting</span>`
                : ""
            }
          </div>
          <p class="journey-zone">${escapeHtml(viewModel.activityText)}</p>
        </div>
        ${renderJourneySpriteBanner(JOURNEY_WALK_SPRITE, {
          wrapperClass: "journey-route-sprite-banner",
          stageClass: "journey-sprite-stage-route",
          label: "Travelling",
        })}
      </div>
      <div class="journey-progress-track">
        <div class="journey-progress-fill" style="width: ${viewModel.progress.percent}%"></div>
      </div>
      <div class="journey-progress-meta">
        <span>${viewModel.stretchPresentation.currentLabel}</span>
        <span>${viewModel.stretchPresentation.remainingLabel}</span>
      </div>

      <div class="journey-story-stats journey-story-stats-compact">
        <div class="journey-story-stat">
          <span>Current goal</span>
          <strong>${escapeHtml(viewModel.stretchPresentation.goalTitle)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>${escapeHtml(viewModel.stretchPresentation.horizonLabel)}</span>
          <strong>${escapeHtml(viewModel.stretchPresentation.horizonValue)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>Next danger</span>
          <strong>${escapeHtml(viewModel.nextThreatLabel)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>Travel pace</span>
          <strong>${viewModel.journeyStats.speedPerHour.toFixed(1)}/hr</strong>
        </div>
      </div>

      <p class="muted-text">
        ${escapeHtml(viewModel.stretchPresentation.innerThoughts)}
      </p>
    </section>

    <section class="journey-adventure-grid">
      ${pendingEventsMarkup}

      <article class="journey-side-card">
        <p class="journey-overline">Expedition focus</p>
        <h4>Keep the road readable</h4>
        <div class="journey-story-stats">
          <div class="journey-story-stat">
            <span>Health</span>
            <strong>${Math.round(viewModel.state.currentHp)} / ${viewModel.journeyStats.maxHp}</strong>
          </div>
          <div class="journey-story-stat">
            <span>Hunger</span>
            <strong>${Math.round(viewModel.state.currentHunger)} / ${viewModel.journeyStats.maxHunger}</strong>
          </div>
          <div class="journey-story-stat">
            <span>Road cleared</span>
            <strong>${viewModel.state.bossIndex}</strong>
          </div>
          <div class="journey-story-stat">
            <span>Retreats</span>
            <strong>${viewModel.state.townVisits}</strong>
          </div>
        </div>
        <p class="muted-text">
          Manage HP, hunger, skills, and inventory from the Character screen so this page can stay focused on travel and events.
        </p>
      </article>
    </section>

    <section class="journey-log-grid">
      <article class="journey-log-card">
        <p class="journey-overline">Travel log</p>
        <h4>Latest hardships</h4>
        <div class="journey-log-list">
          ${viewModel.state.log.length
            ? viewModel.state.log
                .map(
                  (entry) => `
                    <div class="journey-log-entry">
                      <p>${escapeHtml(entry.text)}</p>
                      <time>${formatDateTime(entry.at)}</time>
                    </div>
                  `
                )
                .join("")
            : '<div class="journey-log-entry"><p>You have only just arrived. The first ugly lesson is coming.</p></div>'}
        </div>
      </article>

      <article class="journey-log-card">
        <p class="journey-overline">Road notes</p>
        <h4>What this stretch is asking of you</h4>
        <div class="journey-character-list">
          <div class="journey-log-entry">
            <p>${escapeHtml(
              viewModel.state.status === "recovering"
                ? getRecoveryText(viewModel.state)
                : `Rough ETA to the next threat: ${viewModel.nextThreatLabel}.`
            )}</p>
          </div>
          ${viewModel.knownNotes.length
            ? viewModel.knownNotes
                .map(
                  (note) => `
                    <div class="journey-log-entry">
                      <p>${escapeHtml(note)}</p>
                    </div>
                  `
                )
                .join("")
            : '<div class="journey-log-entry"><p>You are still learning this world the hard way.</p></div>'}
        </div>
      </article>
    </section>

    <details class="journey-debug-panel">
      <summary>Debug tools</summary>
      <div class="journey-debug-panel-body">
        <p class="muted-text">
          Use these to test passive incidents, travel updates, and queued events without leaving this cleaner layout.
        </p>
        <div class="journey-class-list">
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="6">Advance 6h</button>
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="24">Advance 24h</button>
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="72">Advance 3d</button>
          <button type="button" class="secondary-button" data-journey-action="debug-event">Force event</button>
          <button type="button" class="secondary-button" data-journey-action="debug-undo">Undo debug step</button>
          <button type="button" class="secondary-button action-warning" data-journey-action="reset-journey">Reset journey only</button>
        </div>
      </div>
    </details>
  `;
}

export function renderCharacterSheet(state, games, sessions, xpSummary) {
  if (!characterContentEl) return;

  const viewModel = buildJourneyViewModel(state, games, sessions, xpSummary);

  characterContentEl.innerHTML = `
    <section class="character-hero-card">
      <div class="character-hero-layout">
        <div class="character-portrait-panel">
          ${renderJourneySpriteImage(JOURNEY_PORTRAIT_SPRITE, {
            stageClass: "journey-sprite-stage-portrait",
          })}
        </div>

        <div class="character-identity-panel">
          <p class="journey-overline">Character sheet</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(viewModel.displayName)}</h3>
            <span class="journey-chip">${escapeHtml(viewModel.classLabel)}</span>
            <span class="journey-chip">${escapeHtml(viewModel.statusLabel)}</span>
          </div>

          <div class="journey-character-name-row">
            <input
              id="journeyCharacterNameInput"
              type="text"
              maxlength="30"
              placeholder="Name your character"
              value="${escapeAttribute(viewModel.state.characterName)}"
            />
            <button
              type="button"
              class="secondary-button"
              data-journey-action="save-name"
            >
              Save name
            </button>
          </div>

          <div class="character-vitals-grid">
            ${renderCharacterVitalChip({
              icon: "❤",
              label: "HP",
              value: `${Math.round(viewModel.state.currentHp)} / ${viewModel.journeyStats.maxHp}`,
            })}
            ${renderCharacterVitalChip({
              icon: "🍖",
              label: "Hunger",
              value: `${Math.round(viewModel.state.currentHunger)} / ${viewModel.journeyStats.maxHunger}`,
            })}
          </div>

          <div class="summary-row character-summary-row">
            <span class="summary-pill">Journey Lv. <strong>${viewModel.journeyLevel}</strong></span>
            <span class="summary-pill">Tracker Lv. <strong>${viewModel.xpSummary.level}</strong></span>
            <span class="summary-pill">Story bonus <strong>+${viewModel.storyLevelBonus}</strong></span>
            <span class="summary-pill">Story XP <strong>${viewModel.state.storyXp}</strong></span>
            <span class="summary-pill">Skill points <strong>${viewModel.unspentSkillPoints}</strong></span>
          </div>

          ${renderJourneyRadarChart(viewModel.journeyStats.stats)}
        </div>
      </div>
    </section>

    <section class="character-build-grid">
      <article class="journey-side-card">
        <p class="journey-overline">Condition</p>
        <h4>Recovery and upkeep</h4>
        <div class="character-resource-stack">
          ${renderCharacterResourceCard({
            title: "Health",
            current: Math.round(viewModel.state.currentHp),
            max: viewModel.journeyStats.maxHp,
            percent: viewModel.hpPercent,
            statLabel: "Vitality",
            statValue: viewModel.journeyStats.stats.vitality,
            action: "use-tonic",
            actionText: `Use tonic (${viewModel.supplies.availableTonics})`,
            disabled: viewModel.supplies.availableTonics <= 0,
            infoLabel: "Health details",
            infoLines: [
              `Passive regen: ${viewModel.journeyStats.regenPerHour.toFixed(1)}/hr`,
              "Tonics restore a chunk of HP and scale with vitality.",
            ],
            fillClass: "resource-fill-health",
          })}
          ${renderCharacterResourceCard({
            title: "Hunger",
            current: Math.round(viewModel.state.currentHunger),
            max: viewModel.journeyStats.maxHunger,
            percent: viewModel.hungerPercent,
            statLabel: "Resolve",
            statValue: viewModel.journeyStats.stats.resolve,
            action: "use-ration",
            actionText: `Eat ration (${viewModel.supplies.availableRations})`,
            disabled: viewModel.supplies.availableRations <= 0,
            infoLabel: "Hunger details",
            infoLines: [
              `Hunger drain: ${viewModel.journeyStats.hungerDrainPerHour.toFixed(1)}/hr`,
              "Rations restore hunger and scale with resolve.",
            ],
            fillClass: "resource-fill-hunger",
          })}
        </div>
      </article>

      <article class="journey-side-card character-radar-card">
        <p class="journey-overline">Equipment</p>
        <h4>What defines this build</h4>
        <div class="journey-character-list">
          <div class="journey-log-entry">
            <p><strong>Discipline:</strong> ${escapeHtml(viewModel.classLabel)}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>Weapon:</strong> ${escapeHtml(viewModel.state.weaponName || "Still unarmed")}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>Starter keepsake:</strong> ${escapeHtml(viewModel.state.starterItem)}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>Status:</strong> ${escapeHtml(viewModel.statusLabel)}</p>
          </div>
        </div>
      </article>
    </section>

    <section class="character-build-grid">
      <article class="journey-side-card">
        <p class="journey-overline">Inventory</p>
        <h4>What you are carrying</h4>
        <div class="summary-row">
          <span class="summary-pill">Rations: ${viewModel.supplies.availableRations} / ${viewModel.supplies.earnedRations}</span>
          <span class="summary-pill">Tonics: ${viewModel.supplies.availableTonics} / ${viewModel.supplies.earnedTonics}</span>
        </div>
        <div class="journey-character-list">
          ${viewModel.inventoryItems
            .map(
              (item) => `
                <div class="journey-log-entry">
                  <p>${escapeHtml(item)}</p>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="journey-side-card">
        <p class="journey-overline">Class discipline</p>
        <h4>${escapeHtml(viewModel.classLabel)}</h4>
        <p class="muted-text">${escapeHtml(viewModel.classDescription)}</p>
        ${buildJourneyClassSelectionUi(viewModel.state)}
        ${
          viewModel.knownNotes.length
            ? `
              <div class="journey-character-list">
                ${viewModel.knownNotes
                  .map(
                    (note) => `
                      <div class="journey-log-entry">
                        <p>${escapeHtml(note)}</p>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : '<p class="muted-text">Most of what you know has been learned by surviving one ugly stretch at a time.</p>'
        }
      </article>
    </section>

    <section class="journey-stat-grid character-stat-grid">
      ${renderJourneyStatCards(viewModel)}
    </section>
  `;
}

export function buildJourneyClassSelectionUi(state) {
  const unlockedClasses = state.unlockedClasses.filter(
    (classKey) => JOURNEY_CLASS_META[classKey]
  );
  const advancedUnlocked = unlockedClasses.filter(
    (classKey) => classKey !== JOURNEY_BASE_CLASS
  );

  return advancedUnlocked.length
    ? `
        <div class="journey-class-list">
          ${unlockedClasses
            .map((classKey) => {
              const meta = JOURNEY_CLASS_META[classKey];
              return `
                <button
                  type="button"
                  class="secondary-button ${
                    state.classType === classKey ? "action-success" : ""
                  }"
                  data-journey-action="set-class"
                  data-class="${classKey}"
                >
                  ${escapeHtml(meta.label)}
                </button>
              `;
            })
            .join("")}
        </div>
        <p class="muted-text">Other paths are still hidden. They reveal themselves through the road, not the menu.</p>
      `
    : `<p class="muted-text">No discipline has awakened yet. You are still learning the rules of this world the hard way.</p>`;
}

export function getJourneyDisplayName(state) {
  return state.characterName || "Nameless Wanderer";
}

export function initializeJourneySpritePreviews(root = document) {
  const spriteSheets = root.querySelectorAll("[data-journey-sprite-sheet]");

  for (const spriteSheet of spriteSheets) {
    configureJourneySpriteSheet(spriteSheet);
  }
}

function buildJourneyViewModel(state, games, sessions, xpSummary) {
  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const supplies = buildJourneySupplies(games, sessions, state);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats
  );
  const unspentSkillPoints = getUnspentSkillPoints(state, journeyLevel);
  const activityText = getJourneyActivityText(state, boss, progress, journeyStats);
  const nextBossEtaHours =
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour);
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const storyLevelBonus = getJourneyStoryLevelBonus(state.storyXp);
  const displayName = getJourneyDisplayName(state);
  const inventoryItems = getJourneyInventoryItems(state, supplies);
  const knownNotes = getJourneyKnownNotes(state);

  return {
    state,
    xpSummary,
    journeyLevel,
    journeyStats,
    supplies,
    boss,
    progress,
    stretchPresentation,
    unspentSkillPoints,
    activityText,
    nextThreatLabel:
      state.status === "recovering"
        ? "Recovery comes first"
        : formatDurationRangeHours(nextBossEtaHours),
    hpPercent,
    hungerPercent,
    storyLevelBonus,
    displayName,
    inventoryItems,
    knownNotes,
    classLabel: JOURNEY_CLASS_META[state.classType].label,
    classDescription: JOURNEY_CLASS_META[state.classType].description,
    statusLabel: getJourneyStatusLabel(state.status),
    zoneName: getJourneyZoneName(state.bossIndex),
  };
}

function renderJourneyStatCards(viewModel) {
  return JOURNEY_STAT_KEYS.map((statKey) => {
    const statMeta = JOURNEY_STAT_META[statKey];
    const spent = viewModel.state.allocatedStats[statKey] || 0;
    const modifier = viewModel.state.statModifiers[statKey] || 0;
    const modifierText = modifier
      ? ` • Modifier ${modifier > 0 ? "+" : ""}${modifier}`
      : "";

    return `
      <article class="journey-stat-card character-stat-card-item">
        <div class="stat-row">
          <h4>${escapeHtml(statMeta.label)}</h4>
          <strong>${viewModel.journeyStats.stats[statKey]}</strong>
          <span class="journey-chip">Spent ${spent}</span>
        </div>
        <p class="stat-help">${escapeHtml(statMeta.help)}</p>
        <p class="muted-text">Current total includes class bonuses and story modifiers${escapeHtml(modifierText)}.</p>
        <div class="journey-skill-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="spend-stat"
            data-stat="${statKey}"
            ${viewModel.unspentSkillPoints <= 0 ? "disabled" : ""}
          >
            +1 ${escapeHtml(statMeta.label)}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderCharacterResourceCard(config) {
  return `
    <article class="journey-resource-card character-resource-card">
      <div class="character-resource-header">
        <div class="journey-title-row">
          <h4>${escapeHtml(config.title)}</h4>
          ${renderJourneyInlineHelp(config.infoLabel, config.infoLines)}
        </div>
        <span class="journey-chip">${escapeHtml(config.statLabel)} ${config.statValue}</span>
      </div>
      <div class="resource-track">
        <div class="resource-fill ${config.fillClass}" style="width: ${config.percent}%"></div>
      </div>
      <div class="resource-meta">
        <span>${config.current} / ${config.max}</span>
        <span>${Math.round(config.percent)}%</span>
      </div>
      <div class="journey-resource-actions">
        <button
          type="button"
          class="secondary-button"
          data-journey-action="${config.action}"
          ${config.disabled ? "disabled" : ""}
        >
          ${escapeHtml(config.actionText)}
        </button>
      </div>
    </article>
  `;
}

function renderCharacterVitalChip(config) {
  return `
    <div class="character-vital-chip">
      <span class="character-vital-icon" aria-hidden="true">${escapeHtml(config.icon)}</span>
      <div class="character-vital-copy">
        <span>${escapeHtml(config.label)}</span>
        <strong>${escapeHtml(config.value)}</strong>
      </div>
    </div>
  `;
}

function renderJourneyInlineHelp(label, lines) {
  return `
    <details class="journey-inline-help">
      <summary class="journey-info-button" aria-label="${escapeAttribute(label)}">i</summary>
      <div class="journey-inline-help-popover">
        ${lines
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}
      </div>
    </details>
  `;
}

function renderJourneySpriteBanner(spriteConfig, options = {}) {
  const wrapperClass = options.wrapperClass ? ` ${options.wrapperClass}` : "";

  return `
    <div class="journey-sprite-banner${wrapperClass}">
      ${
        options.label
          ? `<span class="journey-sprite-banner-label">${escapeHtml(options.label)}</span>`
          : ""
      }
      ${renderJourneySpriteImage(spriteConfig, {
        stageClass: options.stageClass || "",
        maxDisplayWidth: options.maxDisplayWidth,
        maxDisplayHeight: options.maxDisplayHeight,
      })}
    </div>
  `;
}

function renderJourneySpriteImage(spriteConfig, options = {}) {
  const stageClass = options.stageClass ? ` ${options.stageClass}` : "";

  return `
    <div class="journey-sprite-stage${stageClass}" aria-hidden="true">
      <img
        class="journey-sprite-sheet"
        src="${spriteConfig.src}"
        data-journey-sprite-sheet
        data-frame-count="${spriteConfig.frameCount}"
        data-frame-duration="${spriteConfig.frameDurationMs}"
        data-max-width="${options.maxDisplayWidth || spriteConfig.maxDisplayWidth}"
        data-max-height="${options.maxDisplayHeight || spriteConfig.maxDisplayHeight}"
        alt=""
      />
    </div>
  `;
}

function renderJourneyRadarChart(stats) {
  const entries = JOURNEY_STAT_KEYS.map((statKey) => ({
    key: statKey,
    label: JOURNEY_STAT_META[statKey].label,
    value: Number(stats[statKey] || 0),
  }));
  const maxValue = Math.max(10, ...entries.map((entry) => entry.value), 1);
  const center = 110;
  const radius = 72;
  const ringFractions = [0.25, 0.5, 0.75, 1];
  const dataPolygon = buildRadarPolygon(entries, center, radius, maxValue);

  return `
    <div class="character-radar-shell">
      <svg
        class="character-radar-chart"
        viewBox="0 0 220 220"
        role="img"
        aria-label="Radar chart showing your Might, Finesse, Arcana, Vitality, and Resolve"
      >
        <g class="character-radar-rings">
          ${ringFractions
            .map((fraction) => {
              const ring = buildRadarRing(entries.length, center, radius * fraction);
              return `<polygon points="${ring}" />`;
            })
            .join("")}
        </g>
        <g class="character-radar-axes">
          ${entries
            .map((entry, index) => {
              const axisPoint = getRadarPoint(index, entries.length, center, radius + 10);
              return `<line x1="${center}" y1="${center}" x2="${axisPoint.x}" y2="${axisPoint.y}" />`;
            })
            .join("")}
        </g>
        <polygon class="character-radar-area" points="${dataPolygon}" />
        <polyline class="character-radar-outline" points="${dataPolygon}" />
        <g class="character-radar-points">
          ${entries
            .map((entry, index) => {
              const point = getRadarPoint(
                index,
                entries.length,
                center,
                radius * (entry.value / maxValue)
              );
              return `<circle cx="${point.x}" cy="${point.y}" r="4" />`;
            })
            .join("")}
        </g>
        <g class="character-radar-labels">
          ${entries
            .map((entry, index) => {
              const point = getRadarPoint(index, entries.length, center, radius + 28);
              return `<text x="${point.x}" y="${point.y}">${escapeHtml(entry.label)}</text>`;
            })
            .join("")}
        </g>
      </svg>

      <div class="character-radar-legend">
        ${entries
          .map(
            (entry) => `
              <div class="character-radar-legend-item">
                <span>${escapeHtml(entry.label)}</span>
                <strong>${entry.value}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildRadarPolygon(entries, center, radius, maxValue) {
  return entries
    .map((entry, index) => {
      const point = getRadarPoint(
        index,
        entries.length,
        center,
        radius * (entry.value / maxValue)
      );
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function buildRadarRing(pointCount, center, radius) {
  return Array.from({ length: pointCount }, (_, index) => {
    const point = getRadarPoint(index, pointCount, center, radius);
    return `${point.x},${point.y}`;
  }).join(" ");
}

function getRadarPoint(index, count, center, distance) {
  const angle = (-Math.PI / 2) + (index / count) * Math.PI * 2;

  return {
    x: Number((center + Math.cos(angle) * distance).toFixed(2)),
    y: Number((center + Math.sin(angle) * distance).toFixed(2)),
  };
}

function configureJourneySpriteSheet(spriteSheet) {
  if (!(spriteSheet instanceof HTMLImageElement)) return;

  const frameCount = Number.parseInt(spriteSheet.dataset.frameCount || "", 10);
  const frameDurationMs = Number.parseInt(
    spriteSheet.dataset.frameDuration || "",
    10
  );
  const maxDisplayWidth = Number.parseInt(spriteSheet.dataset.maxWidth || "", 10);
  const maxDisplayHeight = Number.parseInt(spriteSheet.dataset.maxHeight || "", 10);
  if (!Number.isFinite(frameCount) || frameCount <= 0) return;

  const applyMetrics = () => {
    if (!spriteSheet.naturalWidth || !spriteSheet.naturalHeight) return;

    const cacheKey = [
      spriteSheet.currentSrc || spriteSheet.src,
      frameCount,
      maxDisplayWidth,
      maxDisplayHeight,
    ].join("::");
    const cachedMetrics = journeySpriteMetricsCache.get(cacheKey);
    const metrics =
      cachedMetrics ||
      buildJourneySpriteMetrics(
        spriteSheet,
        frameCount,
        Number.isFinite(maxDisplayWidth) ? maxDisplayWidth : JOURNEY_WALK_SPRITE.maxDisplayWidth,
        Number.isFinite(maxDisplayHeight)
          ? maxDisplayHeight
          : JOURNEY_WALK_SPRITE.maxDisplayHeight
      );

    if (!cachedMetrics) {
      journeySpriteMetricsCache.set(cacheKey, metrics);
    }

    const stage = spriteSheet.closest(".journey-sprite-stage");
    if (stage) {
      stage.style.setProperty("--journey-sprite-display-width", `${metrics.displayWidth}px`);
      stage.style.setProperty("--journey-sprite-display-height", `${metrics.displayHeight}px`);
    }

    spriteSheet.style.setProperty("--journey-sprite-sheet-width", `${metrics.sheetWidth}px`);
    spriteSheet.style.setProperty("--journey-sprite-sheet-height", `${metrics.sheetHeight}px`);
    spriteSheet.style.setProperty("--journey-sprite-offset-x", `${metrics.offsetX}px`);
    spriteSheet.style.setProperty("--journey-sprite-offset-y", `${metrics.offsetY}px`);
    spriteSheet.style.setProperty("--journey-sprite-shift", `${metrics.shift}px`);
    spriteSheet.style.animationTimingFunction = `steps(${frameCount})`;
    spriteSheet.style.animationDuration = `${
      (Number.isFinite(frameDurationMs) && frameDurationMs > 0
        ? frameDurationMs
        : JOURNEY_WALK_SPRITE.frameDurationMs) * frameCount
    }ms`;
  };

  if (spriteSheet.complete && spriteSheet.naturalWidth) {
    applyMetrics();
    return;
  }

  spriteSheet.addEventListener("load", applyMetrics, { once: true });
}

function buildJourneySpriteMetrics(
  spriteSheet,
  frameCount,
  maxDisplayWidth,
  maxDisplayHeight
) {
  const frameWidth = Math.floor(spriteSheet.naturalWidth / frameCount);
  const frameHeight = spriteSheet.naturalHeight;
  const cropBounds = detectJourneySpriteBounds(
    spriteSheet,
    frameWidth,
    frameHeight,
    frameCount
  );
  const displayScale = Math.min(
    1,
    maxDisplayWidth / cropBounds.width,
    maxDisplayHeight / cropBounds.height
  );
  const roundedScale = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;
  const displayWidth = Math.max(1, Math.round(cropBounds.width * roundedScale));
  const displayHeight = Math.max(1, Math.round(cropBounds.height * roundedScale));
  const renderedFrameWidth = Math.max(1, Math.round(frameWidth * roundedScale));

  return {
    displayWidth,
    displayHeight,
    sheetWidth: Math.max(1, Math.round(spriteSheet.naturalWidth * roundedScale)),
    sheetHeight: Math.max(1, Math.round(frameHeight * roundedScale)),
    offsetX: Math.round(cropBounds.x * roundedScale) * -1,
    offsetY: Math.round(cropBounds.y * roundedScale) * -1,
    shift: renderedFrameWidth * frameCount,
  };
}

function detectJourneySpriteBounds(spriteSheet, frameWidth, frameHeight, frameCount) {
  const canvas = document.createElement("canvas");
  canvas.width = spriteSheet.naturalWidth;
  canvas.height = frameHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }

  context.drawImage(spriteSheet, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const backgroundPalette = collectJourneySpriteBackgroundPalette(
    data,
    canvas.width,
    canvas.height
  );

  let minX = frameWidth;
  let minY = frameHeight;
  let maxX = -1;
  let maxY = -1;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameOffsetX = frameIndex * frameWidth;

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const pixelIndex = ((y * canvas.width) + frameOffsetX + x) * 4;
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        const alpha = data[pixelIndex + 3];

        if (alpha <= JOURNEY_SPRITE_ALPHA_THRESHOLD) {
          continue;
        }

        if (matchesJourneySpriteBackground(red, green, blue, backgroundPalette)) {
          continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }

  const paddedMinX = Math.max(0, minX - JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMinY = Math.max(0, minY - JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMaxX = Math.min(frameWidth - 1, maxX + JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMaxY = Math.min(frameHeight - 1, maxY + JOURNEY_SPRITE_BOUNDING_PADDING);

  return {
    x: paddedMinX,
    y: paddedMinY,
    width: paddedMaxX - paddedMinX + 1,
    height: paddedMaxY - paddedMinY + 1,
  };
}

function collectJourneySpriteBackgroundPalette(imageData, width, height) {
  const colorCounts = new Map();
  const borderDepth = Math.min(18, Math.max(4, Math.floor(Math.min(width, height) / 20)));

  const countColor = (x, y) => {
    const pixelIndex = ((y * width) + x) * 4;
    const alpha = imageData[pixelIndex + 3];

    if (alpha <= JOURNEY_SPRITE_ALPHA_THRESHOLD) {
      return;
    }

    const key = `${imageData[pixelIndex]},${imageData[pixelIndex + 1]},${imageData[pixelIndex + 2]}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  };

  for (let y = 0; y < borderDepth; y += 1) {
    for (let x = 0; x < width; x += 1) {
      countColor(x, y);
      countColor(x, height - 1 - y);
    }
  }

  for (let x = 0; x < borderDepth; x += 1) {
    for (let y = borderDepth; y < height - borderDepth; y += 1) {
      countColor(x, y);
      countColor(width - 1 - x, y);
    }
  }

  return Array.from(colorCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([key]) => {
      const [red, green, blue] = key.split(",").map(Number);
      return { red, green, blue };
    });
}

function matchesJourneySpriteBackground(red, green, blue, backgroundPalette) {
  if (!backgroundPalette.length) return false;

  return backgroundPalette.some((color) => {
    const channelDistance =
      Math.abs(red - color.red) +
      Math.abs(green - color.green) +
      Math.abs(blue - color.blue);

    return channelDistance <= JOURNEY_SPRITE_BACKGROUND_TOLERANCE;
  });
}

export function getJourneyInventoryItems(state, supplies) {
  const items = [`Starter keepsake: ${state.starterItem}`];

  if (state.weaponName) {
    items.push(`Weapon: ${state.weaponName}`);
  }

  if (state.storyFlags.boarDefeated) {
    items.push("Boar trophy");
  }

  if (supplies.availableRations > 0) {
    items.push(
      `${supplies.availableRations} ration${supplies.availableRations === 1 ? "" : "s"}`
    );
  }

  if (supplies.availableTonics > 0) {
    items.push(
      `${supplies.availableTonics} tonic${supplies.availableTonics === 1 ? "" : "s"}`
    );
  }

  return items;
}

export function getJourneyKnownNotes(state) {
  const notes = [];

  if (state.storyFlags.foundWeapon) {
    notes.push("You are no longer completely unarmed.");
  }

  if (state.storyFlags.boarDefeated) {
    notes.push("You survived your first brutal hunt in the woods.");
  }

  if (state.storyFlags.slimeSapped) {
    notes.push("A bad slime meal left your body permanently worse for wear.");
  }

  if (state.unlockedClasses.length > 1) {
    notes.push(
      `A discipline awakened: ${JOURNEY_CLASS_META[state.classType].label}.`
    );
  }

  return notes;
}
