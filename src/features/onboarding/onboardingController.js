import { getMeta, setMeta } from "../../data/metaRepo.js";
import {
  gameStatusInput,
  titleInput,
} from "../../core/dom.js";
import {
  GAME_STATUSES,
  ONBOARDING_META_KEY,
} from "../../core/constants.js";
import { canLogSessionForGame } from "../../core/formatters.js";
import { t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { closeSettingsModal, syncBodyScrollLock } from "../../core/ui.js";
import { setActiveScreen } from "../navigation/navigation.js";
import { setActiveSessionsTab } from "../sessions/sessionsView.js";
import {
  buildOnboardingMeta,
  getOnboardingStep,
  getOnboardingStepIndex,
  isCurrentOnboardingMeta,
  normalizeOnboardingMeta,
  ONBOARDING_STATUS,
  ONBOARDING_STEPS,
  shouldAutoStartOnboarding,
} from "./onboardingService.js";
import {
  clearOnboardingStep,
  focusOnboardingPrimaryAction,
  measureOnboardingTarget,
  renderOnboardingStep,
} from "./onboardingView.js";

const onboardingRuntime = {
  active: false,
  mode: "idle",
  stepIndex: -1,
  previousMeta: null,
  startedAt: null,
  snapshot: {
    games: [],
    sessions: [],
  },
  syncFrameId: 0,
  pendingFocus: false,
};

export async function maybeAutoStartOnboarding() {
  if (onboardingRuntime.active || !appState.db) {
    return;
  }

  const storedMeta = await readOnboardingMeta();

  if (!shouldAutoStartOnboarding(storedMeta)) {
    onboardingRuntime.previousMeta = storedMeta;
    return;
  }

  await startOnboarding({ mode: "auto", previousMeta: storedMeta });
}

export async function startOnboardingReplay() {
  if (!appState.db) {
    return;
  }

  closeSettingsModal();
  const storedMeta = await readOnboardingMeta();
  await startOnboarding({ mode: "replay", previousMeta: storedMeta });
}

export async function handleOnboardingOverlayClick(event) {
  if (!onboardingRuntime.active || !(event.target instanceof HTMLElement)) {
    return;
  }

  const actionButton = event.target.closest("[data-onboarding-action]");
  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = actionButton.dataset.onboardingAction;

  if (action === "skip") {
    await dismissOnboarding();
    return;
  }

  if (action === "back") {
    await goToStep(onboardingRuntime.stepIndex - 1, { focus: true });
    return;
  }

  if (action === "primary") {
    await handlePrimaryAction();
  }
}

export function handleOnboardingKeydown(event) {
  if (!onboardingRuntime.active || event.key !== "Escape") {
    return false;
  }

  event.preventDefault();
  void dismissOnboarding();
  return true;
}

export function handleOnboardingAppRendered({ games, sessions }) {
  onboardingRuntime.snapshot = {
    games: Array.isArray(games) ? games : [],
    sessions: Array.isArray(sessions) ? sessions : [],
  };

  if (onboardingRuntime.active) {
    scheduleOnboardingSync();
  }
}

export function syncOnboardingLayout() {
  if (!onboardingRuntime.active) {
    return;
  }

  scheduleOnboardingSync();
}

export async function notifyOnboardingGoalSaved() {
  if (
    !onboardingRuntime.active ||
    getCurrentStep()?.requirement !== "goal"
  ) {
    return;
  }

  await goToStep(onboardingRuntime.stepIndex + 1, { focus: true });
}

export async function notifyOnboardingSessionSaved() {
  if (
    !onboardingRuntime.active ||
    getCurrentStep()?.requirement !== "session"
  ) {
    return;
  }

  await goToStep(onboardingRuntime.stepIndex + 1, { focus: true });
}

async function startOnboarding({ mode, previousMeta }) {
  const startingStepIndex = getStartingStepIndex(mode, previousMeta);
  const currentStep = ONBOARDING_STEPS[startingStepIndex];

  onboardingRuntime.active = true;
  onboardingRuntime.mode = mode;
  onboardingRuntime.stepIndex = startingStepIndex;
  onboardingRuntime.previousMeta = previousMeta;
  onboardingRuntime.startedAt = buildStartedAt(previousMeta, mode);

  appState.onboarding.active = true;
  appState.onboarding.mode = mode;
  appState.onboarding.stepId = currentStep.id;
  appState.onboarding.lockBodyScroll = Boolean(currentStep.locksBodyScroll);

  syncBodyScrollLock();

  if (mode !== "replay") {
    await persistOnboardingProgress(currentStep.id);
  }

  await goToStep(startingStepIndex, {
    focus: true,
    persist: false,
  });
}

async function handlePrimaryAction() {
  const currentStep = getCurrentStep();
  if (!currentStep) return;

  if (currentStep.requirement && !getRequirementState(currentStep).satisfied) {
    return;
  }

  if (onboardingRuntime.stepIndex >= ONBOARDING_STEPS.length - 1) {
    await completeOnboarding();
    return;
  }

  await goToStep(onboardingRuntime.stepIndex + 1, { focus: true });
}

async function goToStep(nextStepIndex, options = {}) {
  const step = getOnboardingStep(nextStepIndex);
  if (!step) {
    return;
  }

  onboardingRuntime.stepIndex = nextStepIndex;
  appState.onboarding.stepId = step.id;
  appState.onboarding.lockBodyScroll = Boolean(step.locksBodyScroll);

  prepareStepNavigation(step);
  prepareStepDefaults(step);
  syncBodyScrollLock();

  if (options.persist !== false && onboardingRuntime.mode !== "replay") {
    await persistOnboardingProgress(step.id);
  }

  scheduleOnboardingSync({ focus: options.focus !== false });
}

async function dismissOnboarding() {
  const previousMeta = onboardingRuntime.previousMeta;
  const fallbackStatus =
    onboardingRuntime.mode === "replay" &&
    isCurrentOnboardingMeta(previousMeta) &&
    previousMeta.status !== ONBOARDING_STATUS.IN_PROGRESS
      ? previousMeta.status
      : ONBOARDING_STATUS.DISMISSED;

  await finishOnboarding(fallbackStatus);
}

async function completeOnboarding() {
  await finishOnboarding(ONBOARDING_STATUS.COMPLETED);
}

async function finishOnboarding(status) {
  if (!appState.db) {
    resetOnboardingRuntime();
    return;
  }

  const currentStep = getCurrentStep();
  const nextMeta = buildOnboardingMeta({
    status,
    stepId: currentStep?.id,
    previousMeta: onboardingRuntime.previousMeta,
    startedAt: onboardingRuntime.startedAt,
  });

  await setMeta(appState.db, ONBOARDING_META_KEY, nextMeta);
  onboardingRuntime.previousMeta = nextMeta;
  resetOnboardingRuntime();
}

async function persistOnboardingProgress(stepId) {
  if (!appState.db) {
    return;
  }

  const nextMeta = buildOnboardingMeta({
    status: ONBOARDING_STATUS.IN_PROGRESS,
    stepId,
    previousMeta: onboardingRuntime.previousMeta,
    startedAt: onboardingRuntime.startedAt,
  });

  await setMeta(appState.db, ONBOARDING_META_KEY, nextMeta);
  onboardingRuntime.previousMeta = nextMeta;
}

function resetOnboardingRuntime() {
  if (onboardingRuntime.syncFrameId) {
    window.cancelAnimationFrame(onboardingRuntime.syncFrameId);
  }

  onboardingRuntime.active = false;
  onboardingRuntime.mode = "idle";
  onboardingRuntime.stepIndex = -1;
  onboardingRuntime.startedAt = null;
  onboardingRuntime.syncFrameId = 0;
  onboardingRuntime.pendingFocus = false;

  appState.onboarding.active = false;
  appState.onboarding.mode = "idle";
  appState.onboarding.stepId = "";
  appState.onboarding.lockBodyScroll = false;

  clearOnboardingStep();
  syncBodyScrollLock();
}

function prepareStepNavigation(step) {
  if (step.sessionsTab) {
    setActiveSessionsTab(step.sessionsTab);
  }

  if (step.screenId) {
    setActiveScreen(step.screenId, {
      store: false,
      scrollToTop: false,
    });
  }

  window.scrollTo({
    top: 0,
    behavior: "auto",
  });
}

function prepareStepDefaults(step) {
  if (
    step.id === "new-goal" &&
    titleInput instanceof HTMLInputElement &&
    !titleInput.value.trim() &&
    gameStatusInput instanceof HTMLSelectElement &&
    gameStatusInput.value === GAME_STATUSES.BACKLOG
  ) {
    gameStatusInput.value = GAME_STATUSES.IN_PROGRESS;
  }
}

function scheduleOnboardingSync(options = {}) {
  onboardingRuntime.pendingFocus =
    onboardingRuntime.pendingFocus || Boolean(options.focus);

  if (onboardingRuntime.syncFrameId) {
    return;
  }

  onboardingRuntime.syncFrameId = window.requestAnimationFrame(() => {
    onboardingRuntime.syncFrameId = 0;
    const shouldFocus = onboardingRuntime.pendingFocus;
    onboardingRuntime.pendingFocus = false;
    syncOnboardingStep(shouldFocus);
  });
}

function syncOnboardingStep(shouldFocus = false) {
  if (!onboardingRuntime.active) {
    return;
  }

  const currentStep = getCurrentStep();
  if (!currentStep) {
    return;
  }

  const requirementState = getRequirementState(currentStep);
  const targetRect = currentStep.target
    ? measureOnboardingTarget(currentStep.target)
    : null;
  const viewModel = {
    stepId: currentStep.id,
    kind: currentStep.kind,
    stepIndex: onboardingRuntime.stepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    eyebrow: t(currentStep.eyebrowKey),
    title: t(currentStep.titleKey),
    body: t(currentStep.bodyKey),
    detail: t(currentStep.detailKey),
    statusText: requirementState.statusText,
    progressLabel: t("onboarding.progress", {
      current: onboardingRuntime.stepIndex + 1,
      total: ONBOARDING_STEPS.length,
    }),
    spriteSrc: currentStep.sprite?.src,
    spriteFrameCount: currentStep.sprite?.frameCount || 1,
    spriteFrameDurationMs: currentStep.sprite?.frameDurationMs || 1000,
    spriteMaxWidth: currentStep.sprite?.maxDisplayWidth || 84,
    spriteMaxHeight: currentStep.sprite?.maxDisplayHeight || 84,
    showBack: onboardingRuntime.stepIndex > 0,
    backLabel: t("onboarding.actions.back"),
    skipLabel: t("onboarding.actions.skip"),
    primaryLabel: getPrimaryLabel(currentStep, requirementState.satisfied),
    primaryDisabled: Boolean(currentStep.requirement && !requirementState.satisfied),
    targetRect,
    requirementSatisfied: requirementState.satisfied,
    cardPlacement: currentStep.cardPlacement || "bottom",
  };

  renderOnboardingStep(viewModel);

  if (shouldFocus) {
    focusOnboardingEntry(currentStep, viewModel);
  }
}

function focusOnboardingEntry(step, viewModel) {
  focusOnboardingPrimaryAction();
}

function getRequirementState(step) {
  if (step.requirement === "goal") {
    const satisfied = onboardingRuntime.snapshot.games.length > 0;

    return {
      satisfied,
      statusText: satisfied
        ? t("onboarding.status.goalReady")
        : t("onboarding.status.goalWaiting"),
    };
  }

  if (step.requirement === "session") {
    const hasSession = onboardingRuntime.snapshot.sessions.length > 0;
    const hasEligibleGoal = onboardingRuntime.snapshot.games.some(canLogSessionForGame);

    return {
      satisfied: hasSession,
      statusText: hasSession
        ? t("onboarding.status.sessionReady")
        : hasEligibleGoal
          ? t("onboarding.status.sessionWaiting")
          : t("onboarding.status.sessionNeedsActiveGoal"),
    };
  }

  return {
    satisfied: true,
    statusText: "",
  };
}

function getPrimaryLabel(step, requirementSatisfied) {
  if (step.id === "welcome") {
    return t("onboarding.actions.startSetup");
  }

  if (step.requirement) {
    return requirementSatisfied
      ? t("onboarding.actions.continue")
      : step.requirement === "goal"
        ? t("onboarding.actions.waitingGoal")
        : t("onboarding.actions.waitingSession");
  }

  return onboardingRuntime.stepIndex >= ONBOARDING_STEPS.length - 1
    ? t("onboarding.actions.finish")
    : t("onboarding.actions.next");
}

function getCurrentStep() {
  return getOnboardingStep(onboardingRuntime.stepIndex);
}

function getStartingStepIndex(mode, previousMeta) {
  if (
    mode === "auto" &&
    isCurrentOnboardingMeta(previousMeta) &&
    previousMeta.status === ONBOARDING_STATUS.IN_PROGRESS
  ) {
    const resumedStepIndex = getOnboardingStepIndex(previousMeta.lastStepId);
    return resumedStepIndex >= 0 ? resumedStepIndex : 0;
  }

  return 0;
}

function buildStartedAt(previousMeta, mode) {
  if (
    mode === "auto" &&
    isCurrentOnboardingMeta(previousMeta) &&
    previousMeta.status === ONBOARDING_STATUS.IN_PROGRESS &&
    previousMeta.startedAt
  ) {
    return previousMeta.startedAt;
  }

  return new Date().toISOString();
}

async function readOnboardingMeta() {
  const storedMeta = await getMeta(appState.db, ONBOARDING_META_KEY);
  return normalizeOnboardingMeta(storedMeta);
}
