import { ONBOARDING_VERSION, SESSIONS_TABS } from "../../core/constants.js";

const ONBOARDING_SPRITE = {
  src: "./assets/journey/sprites/Walking.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 84,
  maxDisplayHeight: 84,
};

export const ONBOARDING_STATUS = {
  IN_PROGRESS: "in_progress",
  DISMISSED: "dismissed",
  COMPLETED: "completed",
};

export const ONBOARDING_STEP_IDS = {
  WELCOME: "welcome",
  NEW_GOAL: "new-goal",
  LOG_SESSION: "log-session",
  HOME_JOURNEY: "home-journey",
  TRACKER: "tracker",
};

const VALID_STATUSES = new Set(Object.values(ONBOARDING_STATUS));

export const ONBOARDING_STEPS = [
  {
    id: ONBOARDING_STEP_IDS.WELCOME,
    kind: "welcome",
    locksBodyScroll: true,
    sprite: ONBOARDING_SPRITE,
    eyebrowKey: "onboarding.steps.welcome.eyebrow",
    titleKey: "onboarding.steps.welcome.title",
    bodyKey: "onboarding.steps.welcome.body",
    detailKey: "onboarding.steps.welcome.detail",
  },
  {
    id: ONBOARDING_STEP_IDS.NEW_GOAL,
    kind: "spotlight",
    screenId: "sessions",
    sessionsTab: SESSIONS_TABS.NEW_GAME,
    target: "new-goal-title-input",
    requirement: "goal",
    locksBodyScroll: false,
    sprite: ONBOARDING_SPRITE,
    eyebrowKey: "onboarding.steps.newGoal.eyebrow",
    titleKey: "onboarding.steps.newGoal.title",
    bodyKey: "onboarding.steps.newGoal.body",
    detailKey: "onboarding.steps.newGoal.detail",
  },
  {
    id: ONBOARDING_STEP_IDS.LOG_SESSION,
    kind: "spotlight",
    screenId: "sessions",
    sessionsTab: SESSIONS_TABS.LOG,
    target: "session-form",
    requirement: "session",
    locksBodyScroll: false,
    sprite: ONBOARDING_SPRITE,
    eyebrowKey: "onboarding.steps.logSession.eyebrow",
    titleKey: "onboarding.steps.logSession.title",
    bodyKey: "onboarding.steps.logSession.body",
    detailKey: "onboarding.steps.logSession.detail",
  },
  {
    id: ONBOARDING_STEP_IDS.HOME_JOURNEY,
    kind: "spotlight",
    screenId: "journey",
    target: "journeyPanel",
    locksBodyScroll: true,
    sprite: ONBOARDING_SPRITE,
    eyebrowKey: "onboarding.steps.homeJourney.eyebrow",
    titleKey: "onboarding.steps.homeJourney.title",
    bodyKey: "onboarding.steps.homeJourney.body",
    detailKey: "onboarding.steps.homeJourney.detail",
  },
  {
    id: ONBOARDING_STEP_IDS.TRACKER,
    kind: "spotlight",
    screenId: "tracker",
    target: "tracker-panel",
    locksBodyScroll: true,
    sprite: ONBOARDING_SPRITE,
    eyebrowKey: "onboarding.steps.tracker.eyebrow",
    titleKey: "onboarding.steps.tracker.title",
    bodyKey: "onboarding.steps.tracker.body",
    detailKey: "onboarding.steps.tracker.detail",
  },
];

export function getOnboardingStepIndex(stepId) {
  return ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
}

export function getOnboardingStep(stepIdOrIndex) {
  if (typeof stepIdOrIndex === "number") {
    return ONBOARDING_STEPS[stepIdOrIndex] || null;
  }

  const stepIndex = getOnboardingStepIndex(stepIdOrIndex);
  return stepIndex >= 0 ? ONBOARDING_STEPS[stepIndex] : null;
}

export function isCurrentOnboardingMeta(meta) {
  return meta?.version === ONBOARDING_VERSION;
}

export function normalizeOnboardingMeta(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const status = VALID_STATUSES.has(value.status)
    ? value.status
    : null;
  const lastStepId = getOnboardingStep(value.lastStepId)?.id || ONBOARDING_STEPS[0].id;

  if (!status) {
    return null;
  }

  return {
    version:
      typeof value.version === "string" && value.version
        ? value.version
        : ONBOARDING_VERSION,
    status,
    lastStepId,
    startedAt:
      typeof value.startedAt === "string" && value.startedAt
        ? value.startedAt
        : null,
    finishedAt:
      typeof value.finishedAt === "string" && value.finishedAt
        ? value.finishedAt
        : null,
  };
}

export function shouldAutoStartOnboarding(meta) {
  const normalized = normalizeOnboardingMeta(meta);

  return (
    !normalized ||
    normalized.version !== ONBOARDING_VERSION ||
    normalized.status === ONBOARDING_STATUS.IN_PROGRESS
  );
}

export function buildOnboardingMeta({
  status,
  stepId,
  previousMeta = null,
  startedAt = null,
  finishedAt = null,
}) {
  const now = new Date().toISOString();
  const normalizedPreviousMeta = normalizeOnboardingMeta(previousMeta);
  const carryPreviousTimestamps = isCurrentOnboardingMeta(normalizedPreviousMeta);
  const nextStartedAt =
    startedAt ||
    (carryPreviousTimestamps ? normalizedPreviousMeta?.startedAt : null) ||
    now;

  return {
    version: ONBOARDING_VERSION,
    status: VALID_STATUSES.has(status) ? status : ONBOARDING_STATUS.IN_PROGRESS,
    lastStepId: getOnboardingStep(stepId)?.id || ONBOARDING_STEPS[0].id,
    startedAt: nextStartedAt,
    finishedAt:
      status === ONBOARDING_STATUS.IN_PROGRESS ? null : finishedAt || now,
  };
}
