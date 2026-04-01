import {
  onboardingBackdrop,
  onboardingCardRoot,
  onboardingOverlay,
  onboardingScrimBottom,
  onboardingScrimLeft,
  onboardingScrimRight,
  onboardingScrimTop,
  onboardingSpotlightFrame,
} from "../../core/dom.js";
import { escapeAttribute, escapeHtml } from "../../core/formatters.js";
import { initializeJourneySpritePreviews } from "../journey/journeyView.js";

const SPOTLIGHT_PADDING_PX = 14;
const SPOTLIGHT_MARGIN_PX = 8;

export function renderOnboardingStep(viewModel) {
  if (!onboardingOverlay || !onboardingCardRoot) {
    return;
  }

  onboardingOverlay.hidden = false;
  onboardingOverlay.dataset.stepKind = viewModel.kind;
  onboardingOverlay.dataset.stepId = viewModel.stepId;
  onboardingCardRoot.innerHTML = buildOnboardingCardMarkup(viewModel);
  initializeJourneySpritePreviews(onboardingCardRoot);

  if (viewModel.kind === "spotlight" && viewModel.targetRect) {
    renderSpotlight(viewModel.targetRect);
  } else {
    hideSpotlight();
  }

  if (onboardingBackdrop) {
    onboardingBackdrop.hidden = viewModel.kind === "spotlight" && Boolean(viewModel.targetRect);
  }
}

export function clearOnboardingStep() {
  if (onboardingOverlay) {
    onboardingOverlay.hidden = true;
    onboardingOverlay.removeAttribute("data-step-kind");
    onboardingOverlay.removeAttribute("data-step-id");
  }

  if (onboardingCardRoot) {
    onboardingCardRoot.innerHTML = "";
  }

  if (onboardingBackdrop) {
    onboardingBackdrop.hidden = true;
  }

  hideSpotlight();
}

export function focusOnboardingPrimaryAction() {
  if (!onboardingCardRoot) return;

  onboardingCardRoot
    .querySelector('[data-onboarding-action="primary"]')
    ?.focus();
}

export function measureOnboardingTarget(targetName) {
  if (!targetName) {
    return null;
  }

  const safeTargetName =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(targetName)
      : String(targetName).replaceAll('"', '\\"');
  const target = document.querySelector(
    `[data-onboarding-target="${safeTargetName}"]`
  );

  if (!(target instanceof HTMLElement) || target.hidden) {
    return null;
  }

  const rect = target.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function buildOnboardingCardMarkup(viewModel) {
  if (viewModel.kind === "welcome") {
    return buildWelcomeMarkup(viewModel);
  }

  return buildSpotlightMarkup(viewModel);
}

function buildWelcomeMarkup(viewModel) {
  const dotsMarkup = Array.from({ length: viewModel.totalSteps }, (_, index) => {
    const dotClass =
      index === viewModel.stepIndex
        ? "onboarding-progress-dot is-active"
        : "onboarding-progress-dot";

    return `<span class="${dotClass}" aria-hidden="true"></span>`;
  }).join("");

  const statusMarkup = viewModel.statusText
    ? `<p class="onboarding-status-note">${escapeHtml(viewModel.statusText)}</p>`
    : "";

  const detailMarkup = viewModel.detail
    ? `<p class="onboarding-detail">${escapeHtml(viewModel.detail)}</p>`
    : "";

  const backButtonMarkup = viewModel.showBack
    ? `
        <button
          type="button"
          class="secondary-button"
          data-onboarding-action="back"
        >
          ${escapeHtml(viewModel.backLabel)}
        </button>
      `
    : "";
  const spriteMarkup = buildGuideSpriteMarkup(viewModel);

  return `
    <article
      class="onboarding-card onboarding-welcome-card"
      role="dialog"
      aria-labelledby="onboardingCardTitle"
      aria-describedby="onboardingCardBody"
      tabindex="-1"
    >
      <div class="onboarding-card-media">${spriteMarkup}</div>

      <div class="onboarding-card-copy">
        <div class="onboarding-progress-row">
          <p class="eyebrow">${escapeHtml(viewModel.eyebrow)}</p>
          <p class="onboarding-progress-label">${escapeHtml(viewModel.progressLabel)}</p>
        </div>

        <h2 id="onboardingCardTitle">${escapeHtml(viewModel.title)}</h2>
        <p id="onboardingCardBody" class="onboarding-card-body">${escapeHtml(viewModel.body)}</p>
        ${detailMarkup}
        ${statusMarkup}

        <div class="onboarding-progress-dots" aria-hidden="true">
          ${dotsMarkup}
        </div>
      </div>

      <div class="onboarding-card-actions">
        <div class="onboarding-card-actions-secondary">
          ${backButtonMarkup}
          <button
            type="button"
            class="secondary-button"
            data-onboarding-action="skip"
          >
            ${escapeHtml(viewModel.skipLabel)}
          </button>
        </div>

        <button
          type="button"
          class="primary-button onboarding-primary-button"
          data-onboarding-action="primary"
          ${viewModel.primaryDisabled ? "disabled" : ""}
        >
          ${escapeHtml(viewModel.primaryLabel)}
        </button>
      </div>
    </article>
  `;
}

function buildSpotlightMarkup(viewModel) {
  const statusMarkup = viewModel.statusText
    ? `<p class="onboarding-status-note">${escapeHtml(viewModel.statusText)}</p>`
    : "";
  const backButtonMarkup = viewModel.showBack
    ? `
        <button
          type="button"
          class="secondary-button"
          data-onboarding-action="back"
        >
          ${escapeHtml(viewModel.backLabel)}
        </button>
      `
    : "";
  const bubbleHiddenAttr = viewModel.bubbleCollapsed ? "hidden" : "";

  return `
    <div class="onboarding-guide-cluster${viewModel.bubbleCollapsed ? " is-collapsed" : ""}">
      <button
        type="button"
        class="onboarding-guide-toggle"
        data-onboarding-action="toggle-bubble"
        aria-expanded="${viewModel.bubbleCollapsed ? "false" : "true"}"
        aria-controls="onboardingGuideBubble"
        aria-label="${escapeAttribute(viewModel.toggleGuideLabel)}"
      >
        ${buildGuideSpriteMarkup(viewModel)}
        <span class="onboarding-guide-toggle-progress">${escapeHtml(viewModel.progressCompactLabel)}</span>
      </button>

      <section
        id="onboardingGuideBubble"
        class="onboarding-speech-bubble"
        role="dialog"
        aria-labelledby="onboardingCardTitle"
        aria-describedby="onboardingCardBody"
        data-onboarding-action="toggle-bubble"
        ${bubbleHiddenAttr}
      >
        <div class="onboarding-speech-header">
          <button
            type="button"
            class="onboarding-speech-header-toggle"
            data-onboarding-action="toggle-bubble"
          >
            <span class="eyebrow">${escapeHtml(viewModel.eyebrow)}</span>
            <span class="onboarding-progress-label">${escapeHtml(viewModel.progressLabel)}</span>
          </button>
          <button
            type="button"
            class="secondary-button onboarding-speech-minimize"
            data-onboarding-action="toggle-bubble"
          >
            ${escapeHtml(viewModel.hideGuideLabel)}
          </button>
        </div>

        <div class="onboarding-speech-copy">
          <h2 id="onboardingCardTitle">${escapeHtml(viewModel.title)}</h2>
          <p id="onboardingCardBody" class="onboarding-card-body">${escapeHtml(viewModel.body)}</p>
          ${statusMarkup}
        </div>

        <div class="onboarding-card-actions onboarding-speech-actions">
          <div class="onboarding-card-actions-secondary">
            ${backButtonMarkup}
            <button
              type="button"
              class="secondary-button"
              data-onboarding-action="skip"
            >
              ${escapeHtml(viewModel.skipLabel)}
            </button>
          </div>

          <button
            type="button"
            class="primary-button onboarding-primary-button"
            data-onboarding-action="primary"
            ${viewModel.primaryDisabled ? "disabled" : ""}
          >
            ${escapeHtml(viewModel.primaryLabel)}
          </button>
        </div>
      </section>
    </div>
  `;
}

function buildGuideSpriteMarkup(viewModel) {
  return `
    <div class="onboarding-guide-shell">
      <div class="journey-sprite-stage onboarding-guide-stage" aria-hidden="true">
        <img
          class="journey-sprite-sheet onboarding-guide-sprite-sheet"
          src="${escapeAttribute(viewModel.spriteSrc)}"
          data-journey-sprite-sheet
          data-frame-count="${viewModel.spriteFrameCount}"
          data-frame-duration="${viewModel.spriteFrameDurationMs}"
          data-max-width="${viewModel.spriteMaxWidth}"
          data-max-height="${viewModel.spriteMaxHeight}"
          alt=""
        />
      </div>
    </div>
  `;
}

function renderSpotlight(targetRect) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const top = clampNumber(targetRect.top - SPOTLIGHT_PADDING_PX, SPOTLIGHT_MARGIN_PX);
  const left = clampNumber(targetRect.left - SPOTLIGHT_PADDING_PX, SPOTLIGHT_MARGIN_PX);
  const right = clampNumber(
    targetRect.right + SPOTLIGHT_PADDING_PX,
    SPOTLIGHT_MARGIN_PX,
    viewportWidth - SPOTLIGHT_MARGIN_PX
  );
  const bottom = clampNumber(
    targetRect.bottom + SPOTLIGHT_PADDING_PX,
    SPOTLIGHT_MARGIN_PX,
    viewportHeight - SPOTLIGHT_MARGIN_PX
  );
  const spotlightWidth = Math.max(0, right - left);
  const spotlightHeight = Math.max(0, bottom - top);

  if (spotlightWidth <= 0 || spotlightHeight <= 0) {
    hideSpotlight();
    if (onboardingBackdrop) {
      onboardingBackdrop.hidden = false;
    }
    return;
  }

  setScrimStyles(onboardingScrimTop, {
    top: "0px",
    left: "0px",
    width: `${viewportWidth}px`,
    height: `${top}px`,
  });
  setScrimStyles(onboardingScrimLeft, {
    top: `${top}px`,
    left: "0px",
    width: `${left}px`,
    height: `${spotlightHeight}px`,
  });
  setScrimStyles(onboardingScrimRight, {
    top: `${top}px`,
    left: `${right}px`,
    width: `${Math.max(0, viewportWidth - right)}px`,
    height: `${spotlightHeight}px`,
  });
  setScrimStyles(onboardingScrimBottom, {
    top: `${bottom}px`,
    left: "0px",
    width: `${viewportWidth}px`,
    height: `${Math.max(0, viewportHeight - bottom)}px`,
  });

  if (onboardingSpotlightFrame) {
    onboardingSpotlightFrame.hidden = false;
    onboardingSpotlightFrame.style.top = `${top}px`;
    onboardingSpotlightFrame.style.left = `${left}px`;
    onboardingSpotlightFrame.style.width = `${spotlightWidth}px`;
    onboardingSpotlightFrame.style.height = `${spotlightHeight}px`;
  }
}

function hideSpotlight() {
  hideScrim(onboardingScrimTop);
  hideScrim(onboardingScrimLeft);
  hideScrim(onboardingScrimRight);
  hideScrim(onboardingScrimBottom);

  if (onboardingSpotlightFrame) {
    onboardingSpotlightFrame.hidden = true;
  }
}

function hideScrim(element) {
  if (!element) return;
  element.hidden = true;
}

function setScrimStyles(element, styles) {
  if (!element) return;

  element.hidden = false;
  element.style.top = styles.top;
  element.style.left = styles.left;
  element.style.width = styles.width;
  element.style.height = styles.height;
}

function clampNumber(value, min, max = Number.POSITIVE_INFINITY) {
  return Math.min(Math.max(value, min), max);
}
