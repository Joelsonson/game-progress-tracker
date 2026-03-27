import { DEFAULT_GAME_STATUS, GAME_STATUSES } from "../data/db.js";

export { DEFAULT_GAME_STATUS, GAME_STATUSES };

export const SESSION_ALLOWED_STATUSES = new Set([
  GAME_STATUSES.IN_PROGRESS,
  GAME_STATUSES.COMPLETED,
]);

export const XP_RULES = {
  baseSessionXp: 10,
  minutesPerChunk: 15,
  xpPerChunk: 5,
  maxChunkXp: 20,
  meaningfulBonus: 15,
  completionBonus: 100,
  xpPerLevel: 100,
};

export const IMAGE_PRESET = {
  cover: {
    width: 480,
    height: 640,
    quality: 0.88,
    label: "cover art",
    ratioLabel: "3:4 portrait",
    recommendedSize: "900×1200 or larger",
  },
  banner: {
    width: 1280,
    height: 720,
    quality: 0.86,
    label: "banner art",
    ratioLabel: "16:9 widescreen",
    recommendedSize: "1600×900 or larger",
  },
};

export const CARD_TIER_META = {
  bronze: {
    label: "Bronze Finish",
    className: "tier-bronze",
    accentA: "#c19162",
    accentB: "#8b5e34",
    accentText: "#f5d0b5",
    subtitle: "A clean clear. Momentum matters.",
  },
  silver: {
    label: "Silver Finish",
    className: "tier-silver",
    accentA: "#e2e8f0",
    accentB: "#64748b",
    accentText: "#f8fafc",
    subtitle: "Strong consistency. A proper run.",
  },
  gold: {
    label: "Gold Finish",
    className: "tier-gold",
    accentA: "#facc15",
    accentB: "#ca8a04",
    accentText: "#fef3c7",
    subtitle: "High-value clear with serious effort.",
  },
  prismatic: {
    label: "Prismatic Finish",
    className: "tier-prismatic",
    accentA: "#c084fc",
    accentB: "#7c3aed",
    accentText: "#f3e8ff",
    subtitle: "Standout finish. This one shines.",
  },
  legendary: {
    label: "Legendary Finish",
    className: "tier-legendary",
    accentA: "#34d399",
    accentB: "#059669",
    accentText: "#d1fae5",
    subtitle: "Elite finish. Card-worthy with no notes.",
  },
};

export const STATUS_META = {
  [GAME_STATUSES.BACKLOG]: {
    label: "Backlog",
    description:
      "Ideas you want to keep around without pretending you are actively playing them.",
    empty: "Nothing in backlog right now.",
    badgeClass: "status-backlog",
  },
  [GAME_STATUSES.IN_PROGRESS]: {
    label: "In Progress",
    description: "Your active rotation. Keep this list small to protect focus.",
    empty: "Nothing active yet. Move one game out of backlog when you are ready.",
    badgeClass: "status-in-progress",
  },
  [GAME_STATUSES.PAUSED]: {
    label: "Paused",
    description: "Games you have intentionally set aside for now.",
    empty: "Nothing is paused right now.",
    badgeClass: "status-paused",
  },
  [GAME_STATUSES.COMPLETED]: {
    label: "Completed",
    description:
      "Finished games live here. This is the section you are trying to grow.",
    empty: "No finished games yet. Your next one will look great here.",
    badgeClass: "status-completed",
  },
  [GAME_STATUSES.DROPPED]: {
    label: "Dropped",
    description:
      "Games you are done forcing. You can always rescue them later.",
    empty: "No dropped games right now.",
    badgeClass: "status-dropped",
  },
};

export const IMPORT_FILE_ACCEPT = ["application/json", "text/json", ""];
export const IMPORT_SCHEMA_VERSION = 2;

export const IDLE_JOURNEY_META_KEY = "idleJourney";
export const JOURNEY_BOSS_DISTANCE = 100;
export const JOURNEY_TICK_MS = 1000 * 60 * 30;
export const JOURNEY_LOG_LIMIT = 7;
export const JOURNEY_PENDING_EVENT_LIMIT = 2;
export const JOURNEY_DEBUG_HISTORY_LIMIT = 6;
export const JOURNEY_RECENT_EVENT_LIMIT = 4;
export const JOURNEY_STORY_XP_PER_LEVEL = 100;
export const JOURNEY_BASE_CLASS = "stranded";
export const JOURNEY_STAT_KEYS = ["might", "finesse", "arcana", "vitality", "resolve"];
export const JOURNEY_FLAG_KEYS = ["foundWeapon", "boarDefeated", "slimeSapped"];

export const FOCUS_TAX_META = {
  sideQuest: {
    label: "Side-quest drift",
    min: 6,
    max: 18,
  },
  replay: {
    label: "Replay distraction",
    min: 10,
    max: 24,
  },
};

export const JOURNEY_CLASS_META = {
  [JOURNEY_BASE_CLASS]: {
    label: "Weak and Newly Isekai'd",
    description:
      "You woke up in another world with no training, no map, and barely anything that counts as gear.",
    bonuses: { might: 0, finesse: 0, arcana: 0, vitality: 0, resolve: 0 },
    unlockHint: "This is where everybody starts: weak, confused, and trying not to die.",
  },
  warrior: {
    label: "Scrapper",
    description:
      "You learned to fight ugly, brace for impact, and survive close-range scraps.",
    bonuses: { might: 2, finesse: 0, arcana: 0, vitality: 1, resolve: 0 },
    unlockHint: "Usually unlocked by learning from guards, hunters, or desperate fights.",
  },
  mage: {
    label: "Hedge Mage",
    description:
      "The world starts feeling less silent. You sense strange currents and learn to work with them.",
    bonuses: { might: 0, finesse: 0, arcana: 3, vitality: 0, resolve: 1 },
    unlockHint: "Usually unlocked through strange shrines, mana-sensitive people, or careful choices.",
  },
  thief: {
    label: "Scout",
    description:
      "You survive by moving lightly, spotting trouble early, and wasting nothing.",
    bonuses: { might: 0, finesse: 3, arcana: 0, vitality: 0, resolve: 1 },
    unlockHint: "Usually unlocked by foraging, sneaking, and learning from people who live off the land.",
  },
};

export const JOURNEY_STAT_META = {
  might: {
    label: "Might",
    help: "Helps with rough fights, carrying weight, and making weak weapons count.",
  },
  finesse: {
    label: "Finesse",
    help: "Makes you quicker, quieter, and harder to catch in bad situations.",
  },
  arcana: {
    label: "Arcana",
    help: "Lets you notice and eventually use the strange rules of this world.",
  },
  vitality: {
    label: "Vitality",
    help: "Keeps you standing longer and helps you recover after ugly mistakes.",
  },
  resolve: {
    label: "Resolve",
    help: "Helps you stay calm, stretch poor meals, and keep moving while exhausted.",
  },
};

export const JOURNEY_ZONE_NAMES = [
  "Unknown Forest",
  "Creekside Thicket",
  "Abandoned Footpath",
  "Fallow Hamlet Outskirts",
  "Broken Watchroad",
  "Fog Marsh Crossing",
  "Stonepass Trail",
  "Old Frontier Road",
];

export const JOURNEY_BOSS_NAMES = [
  "Cornered Forest Boar",
  "Hungry Wolf Pack",
  "Bridge Ambusher",
  "Marshfang Lurker",
  "Hill Band Captain",
  "Ruin-Stalker",
  "Gravepath Ogre",
  "Storm Ridge Wyrm",
  "The Border Tyrant",
];

export const JOURNEY_AMBIENT_INTERACTIONS = {
  arrival: [
    "You spent half an hour convincing yourself the strange sky was real.",
    "You followed a game trail, lost it, and had to start over from scratch.",
    "Every snapping twig sounded like a monster until you realized some were only rabbits.",
    "You tested bark, roots, and berries with the caution of someone who badly wants to stay alive.",
  ],
  survival: [
    "You found a flatter patch of ground and counted that as shelter.",
    "A stream saved the day, even if the water tasted like leaves and mud.",
    "You practised gripping your makeshift weapon until your hands stopped shaking.",
    "You learned the hard way that panic wastes more energy than walking does.",
  ],
  frontier: [
    "A distant chimney reminded you civilization exists somewhere beyond the trees.",
    "You moved slower today, but you chose the safer trail and kept your footing.",
    "You caught yourself scanning every hedgerow before committing to the road.",
    "You are not comfortable out here yet, but you are no longer completely helpless.",
  ],
};

export const JOURNEY_STARTER_ITEMS = [
  "dead phone",
  "cheap wristwatch",
  "school backpack",
  "blunt pocket knife",
  "lucky coin",
  "cracked lighter",
  "old notebook",
];

export const MOBILE_BREAKPOINT_PX = 900;
export const SCREEN_STORAGE_KEY = "gameTracker.activeScreen";
export const DEFAULT_SCREEN_ID = "home";
