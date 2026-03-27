import {
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
import { JOURNEY_BASE_CLASS, JOURNEY_CLASS_META, JOURNEY_STAT_KEYS, JOURNEY_STAT_META } from "../../core/constants.js";
import { clamp, escapeAttribute, escapeHtml, formatDateTime } from "../../core/formatters.js";
import { syncBodyScrollLock } from "../../core/ui.js";
import {
  buildJourneyDerived,
  buildJourneyStretchPresentation,
  buildJourneySupplies,
  getJourneyActivityText,
  getJourneyBoss,
  getJourneyLevel,
  getJourneySegmentProgress,
  getJourneyStatusLabel,
  getJourneyStoryLevelBonus,
  getJourneyZoneName,
  formatDurationRangeHours,
  getRecoveryText,
  getUnspentSkillPoints,
} from "./journeyEngine.js";

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
          Open full journey
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
  const pendingEventsMarkup = state.pendingEvents.length
    ? `
        <article class="journey-side-card journey-alert-card">
          <p class="journey-overline">Event queue</p>
          <h4>Something happened</h4>
          <p class="muted-text">
            The road has a way of forcing decisions on you.
          </p>
          <div class="journey-event-list">
            ${state.pendingEvents
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
    <section class="journey-hero">
      <div class="journey-hero-top">
        <div class="journey-side-card">
          <p class="journey-overline">Current stretch</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(displayName)} • Lv. ${journeyLevel}</h3>
            <span class="journey-chip is-active">${escapeHtml(getJourneyZoneName(state.bossIndex))}</span>
            <span class="journey-chip">${escapeHtml(getJourneyStatusLabel(state.status))}</span>
            ${
              state.pendingEvents.length
                ? `<span class="journey-chip is-warning">${state.pendingEvents.length} event waiting</span>`
                : ""
            }
          </div>
          <p class="journey-zone">${escapeHtml(activityText)}</p>
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
            <span class="summary-pill">Retreats: ${state.townVisits}</span>
            <span class="summary-pill">Pace: ${journeyStats.speedPerHour.toFixed(1)}/hr</span>
          </div>
          <p class="muted-text">
            ${escapeHtml(stretchPresentation.innerThoughts)}
          </p>
        </div>

        <article class="journey-side-card journey-character-card">
          <p class="journey-overline">Character</p>
          <div class="journey-title-row">
            <h4>${escapeHtml(displayName)}</h4>
            <span class="journey-chip">${escapeHtml(JOURNEY_CLASS_META[state.classType].label)}</span>
          </div>
          <div class="journey-character-name-row">
            <input
              id="journeyCharacterNameInput"
              type="text"
              maxlength="30"
              placeholder="Name your character"
              value="${escapeAttribute(state.characterName)}"
            />
            <button
              type="button"
              class="secondary-button"
              data-journey-action="save-name"
            >
              Save name
            </button>
          </div>
          <div class="journey-story-stats">
            <div class="journey-story-stat">
              <span>Journey level</span>
              <strong>${journeyLevel}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Tracker level</span>
              <strong>${xpSummary.level}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Story XP</span>
              <strong>${state.storyXp}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Extra levels</span>
              <strong>+${storyLevelBonus}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Skill points left</span>
              <strong>${unspentSkillPoints}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Power</span>
              <strong>${journeyStats.power.toFixed(0)}</strong>
            </div>
            <div class="journey-story-stat">
              <span>Regen</span>
              <strong>${journeyStats.regenPerHour.toFixed(1)}/hr</strong>
            </div>
            <div class="journey-story-stat">
              <span>Hunger drain</span>
              <strong>${journeyStats.hungerDrainPerHour.toFixed(1)}/hr</strong>
            </div>
          </div>
          <p class="muted-text">
            Extra levels come from story XP earned by events, hardship, and major moments on the road.
          </p>
          <p class="muted-text">
            ${
              state.status === "recovering"
                ? escapeHtml(getRecoveryText(state))
                : `Rough ETA to next threat: ${formatDurationRangeHours(nextBossEtaHours)}`
            }
          </p>
        </article>
      </div>
    </section>

    <section class="journey-resource-grid">
      <article class="journey-resource-card">
        <h4>Health</h4>
        <div class="resource-track">
          <div class="resource-fill resource-fill-health" style="width: ${hpPercent}%"></div>
        </div>
        <div class="resource-meta">
          <span>${Math.round(state.currentHp)} / ${journeyStats.maxHp}</span>
          <span>Vitality ${journeyStats.stats.vitality}</span>
        </div>
        <div class="journey-resource-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-tonic"
            ${supplies.availableTonics <= 0 ? "disabled" : ""}
          >
            Use tonic (${supplies.availableTonics})
          </button>
        </div>
      </article>

      <article class="journey-resource-card">
        <h4>Hunger</h4>
        <div class="resource-track">
          <div class="resource-fill resource-fill-hunger" style="width: ${hungerPercent}%"></div>
        </div>
        <div class="resource-meta">
          <span>${Math.round(state.currentHunger)} / ${journeyStats.maxHunger}</span>
          <span>Resolve ${journeyStats.stats.resolve}</span>
        </div>
        <div class="journey-resource-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-ration"
            ${supplies.availableRations <= 0 ? "disabled" : ""}
          >
            Eat ration (${supplies.availableRations})
          </button>
        </div>
      </article>
    </section>

    <section class="journey-utility-row">
      ${pendingEventsMarkup}

      <article class="journey-side-card">
        <p class="journey-overline">Class discipline</p>
        <h4>${escapeHtml(JOURNEY_CLASS_META[state.classType].label)}</h4>
        <p class="muted-text">${escapeHtml(JOURNEY_CLASS_META[state.classType].description)}</p>
        ${buildJourneyClassSelectionUi(state)}
      </article>
    </section>

    <section class="journey-utility-row">
      <article class="journey-side-card">
        <p class="journey-overline">Inventory</p>
        <h4>What you are carrying</h4>
        <div class="summary-row">
          <span class="summary-pill">Rations: ${supplies.availableRations} / ${supplies.earnedRations}</span>
          <span class="summary-pill">Tonics: ${supplies.availableTonics} / ${supplies.earnedTonics}</span>
        </div>
        <div class="journey-character-list">
          ${inventoryItems
            .map((item) => `<div class="journey-log-entry"><p>${escapeHtml(item)}</p></div>`)
            .join("")}
        </div>
      </article>

      <article class="journey-side-card">
        <p class="journey-overline">Field notes</p>
        <h4>What is known so far</h4>
        ${
          knownNotes.length
            ? `
              <div class="journey-character-list">
                ${knownNotes
                  .map((note) => `<div class="journey-log-entry"><p>${escapeHtml(note)}</p></div>`)
                  .join("")}
              </div>
            `
            : `<p class="muted-text">Very little makes sense yet. Most of what you know has been learned the hard way.</p>`
        }
      </article>
    </section>

    <section class="journey-side-card journey-debug-card">
      <p class="journey-overline">Debug tools</p>
      <h4>Force the clock</h4>
      <p class="muted-text">Use these to test passive incidents, travel updates, and queued events.</p>
      <div class="journey-class-list">
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="6">Advance 6h</button>
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="24">Advance 24h</button>
        <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="72">Advance 3d</button>
        <button type="button" class="secondary-button" data-journey-action="debug-event">Force event</button>
        <button type="button" class="secondary-button" data-journey-action="debug-undo">Undo debug step</button>
        <button type="button" class="secondary-button action-warning" data-journey-action="reset-journey">Reset journey only</button>
      </div>
    </section>

    <section class="journey-stat-grid">
      ${JOURNEY_STAT_KEYS.map((statKey) => {
        const statMeta = JOURNEY_STAT_META[statKey];
        const spent = state.allocatedStats[statKey] || 0;
        return `
          <article class="journey-stat-card">
            <div class="stat-row">
              <h4>${escapeHtml(statMeta.label)}</h4>
              <strong>${journeyStats.stats[statKey]}</strong>
              <span class="journey-chip">Spent ${spent}</span>
            </div>
            <p class="stat-help">${escapeHtml(statMeta.help)}</p>
            <div class="journey-skill-actions">
              <button
                type="button"
                class="secondary-button"
                data-journey-action="spend-stat"
                data-stat="${statKey}"
                ${unspentSkillPoints <= 0 ? "disabled" : ""}
              >
                +1 ${escapeHtml(statMeta.label)}
              </button>
            </div>
          </article>
        `;
      }).join("")}
    </section>

    <section class="journey-log-grid">
      <article class="journey-log-card">
        <p class="journey-overline">Travel log</p>
        <h4>Latest hardships</h4>
        <div class="journey-log-list">
          ${state.log.length
            ? state.log
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
        <p class="journey-overline">Character sheet</p>
        <h4>Current build</h4>
        <div class="summary-row">
          <span class="summary-pill">Power ${journeyStats.power.toFixed(0)}</span>
          <span class="summary-pill">Regen ${journeyStats.regenPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Hunger drain ${journeyStats.hungerDrainPerHour.toFixed(1)}/hr</span>
          <span class="summary-pill">Extra levels +${storyLevelBonus}</span>
        </div>
        <div class="journey-character-list">
          ${JOURNEY_STAT_KEYS.map((statKey) => {
            const modifier = state.statModifiers[statKey] || 0;
            const modifierText = modifier
              ? ` (${modifier > 0 ? "+" : ""}${modifier} modifier)`
              : "";
            return `<div class="journey-log-entry"><p>${escapeHtml(
              JOURNEY_STAT_META[statKey].label
            )}: ${journeyStats.stats[statKey]}${escapeHtml(modifierText)}</p></div>`;
          }).join("")}
        </div>
      </article>
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

export function getJourneyInventoryItems(state, supplies) {
  const items = [`Starter keepsake: ${state.starterItem}`];

  if (state.weaponName) {
    items.push(`Weapon: ${state.weaponName}`);
  }

  if (state.storyFlags.boarDefeated) {
    items.push("Boar trophy");
  }

  if (supplies.availableRations > 0) {
    items.push(`${supplies.availableRations} ration${supplies.availableRations === 1 ? "" : "s"}`);
  }

  if (supplies.availableTonics > 0) {
    items.push(`${supplies.availableTonics} tonic${supplies.availableTonics === 1 ? "" : "s"}`);
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
