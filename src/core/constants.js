import {
  DEFAULT_GAME_DIFFICULTY,
  DEFAULT_GAME_STATUS,
  GAME_DIFFICULTIES,
  GAME_STATUSES,
} from "../data/db.js";

export {
  DEFAULT_GAME_DIFFICULTY,
  DEFAULT_GAME_STATUS,
  GAME_DIFFICULTIES,
  GAME_STATUSES,
};

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
  baseLevelXp: 100,
  levelXpGrowth: 20,
  levelXpCurveStep: 5,
};

export const GAME_DIFFICULTY_META = {
  [GAME_DIFFICULTIES.NOT_APPLICABLE]: {
    rewardXp: 0,
    badgeClass: "difficulty-not-applicable",
    labelKey: "difficulty.notApplicable",
  },
  [GAME_DIFFICULTIES.VERY_EASY]: {
    rewardXp: 60,
    badgeClass: "difficulty-very-easy",
    labelKey: "difficulty.veryEasy",
  },
  [GAME_DIFFICULTIES.EASY]: {
    rewardXp: 80,
    badgeClass: "difficulty-easy",
    labelKey: "difficulty.easy",
  },
  [GAME_DIFFICULTIES.STANDARD]: {
    rewardXp: XP_RULES.completionBonus,
    badgeClass: "difficulty-standard",
    labelKey: "difficulty.standard",
  },
  [GAME_DIFFICULTIES.HARD]: {
    rewardXp: 125,
    badgeClass: "difficulty-hard",
    labelKey: "difficulty.hard",
  },
  [GAME_DIFFICULTIES.VERY_HARD]: {
    rewardXp: 150,
    badgeClass: "difficulty-very-hard",
    labelKey: "difficulty.veryHard",
  },
};

export const SESSIONS_TABS = {
  LOG: "log-session",
  NEW_GAME: "new-game",
  HISTORY: "session-history",
};

export const DEFAULT_SESSIONS_TAB = SESSIONS_TABS.LOG;

export const CHARACTER_TABS = {
  STATS: "stats",
  INVENTORY: "inventory",
  EQUIPMENT: "equipment",
};

export const DEFAULT_CHARACTER_TAB = CHARACTER_TABS.STATS;

export const IMAGE_PRESET = {
  cover: {
    width: 480,
    height: 640,
    quality: 0.88,
    label: "card image",
    ratioLabel: "3:4 portrait",
    recommendedSize: "900×1200 or larger",
  },
  banner: {
    width: 1280,
    height: 720,
    quality: 0.86,
    label: "banner image",
    ratioLabel: "16:9 widescreen",
    recommendedSize: "1600×900 or larger",
  },
};

export const BUILT_IN_COVER_IMAGE_DIRECTORY =
  "./assets/journey/defaultcoverimages";
export const BUILT_IN_COVER_IMAGE_EXTENSION = "png";
export const BUILT_IN_COVER_IMAGE_DISCOVERY_MAX = 24;

export const CARD_TIER_META = {
  bronze: {
    label: "Bronze Finish",
    className: "tier-bronze",
    accentA: "#c19162",
    accentB: "#8b5e34",
    accentText: "#f5d0b5",
    subtitle: "A solid completion. Momentum matters.",
  },
  silver: {
    label: "Silver Finish",
    className: "tier-silver",
    accentA: "#e2e8f0",
    accentB: "#64748b",
    accentText: "#f8fafc",
    subtitle: "Strong consistency. A proper push.",
  },
  gold: {
    label: "Gold Finish",
    className: "tier-gold",
    accentA: "#facc15",
    accentB: "#ca8a04",
    accentText: "#fef3c7",
    subtitle: "High-value completion with serious effort.",
  },
  prismatic: {
    label: "Prismatic Finish",
    className: "tier-prismatic",
    accentA: "#c084fc",
    accentB: "#7c3aed",
    accentText: "#f3e8ff",
    subtitle: "Standout completion. This one shines.",
  },
  legendary: {
    label: "Legendary Finish",
    className: "tier-legendary",
    accentA: "#34d399",
    accentB: "#059669",
    accentText: "#d1fae5",
    subtitle: "Elite completion. Card-worthy with no notes.",
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
export const IMPORT_SCHEMA_VERSION = 3;

export const IDLE_JOURNEY_META_KEY = "idleJourney";
export const FOCUSED_GOALS_META_KEY = "focusedGoalsEnabled";
export const ONBOARDING_META_KEY = "onboarding";
export const ONBOARDING_VERSION = "hybrid-first-run-v1";
export const DEFAULT_FOCUSED_GOALS_ENABLED = true;
export const JOURNEY_BOSS_DISTANCE = 100;
export const JOURNEY_TICK_MS = 1000 * 60 * 30;
export const JOURNEY_LOG_LIMIT = 7;
export const JOURNEY_PENDING_EVENT_LIMIT = 2;
export const JOURNEY_DEBUG_HISTORY_LIMIT = 6;
export const JOURNEY_RECENT_EVENT_LIMIT = 4;
export const JOURNEY_COMPLETED_EVENT_LIMIT = 40;
export const JOURNEY_STORY_XP_PER_LEVEL = 100;
export const JOURNEY_STORY_XP_GROWTH = 16;
export const JOURNEY_STORY_XP_CURVE_STEP = 4;
export const JOURNEY_BASE_CLASS = "stranded";
export const JOURNEY_BASE_STAT_SCORE = 8;
export const JOURNEY_STARTING_SKILL_POINTS = 4;
export const JOURNEY_STAT_KEYS = ["might", "finesse", "arcana", "vitality", "resolve"];
export const JOURNEY_FLAG_KEYS = ["foundWeapon", "boarDefeated", "slimeSapped"];

export const FOCUS_TAX_META = {
  sideQuest: {
    label: "Focus drift",
    min: 6,
    max: 18,
  },
  replay: {
    label: "Revisit drift",
    min: 10,
    max: 24,
  },
};

export const JOURNEY_CLASS_META = {
  [JOURNEY_BASE_CLASS]: {
    label: "Unattuned Wanderer",
    description:
      "You have not channelled a manastone yet. Whatever this land is willing to bestow on you remains sleeping in the dark.",
    bonuses: { might: 0, finesse: 0, arcana: 0, vitality: 0, resolve: 0 },
    unlockHint:
      "This is where everybody starts: unblessed, uncertain, and trying not to die before the road notices them.",
  },
  soldier: {
    label: "Soldier",
    description:
      "A drilled martial blessing that hardens your stance, steadies your nerves, and teaches you to meet violence head-on.",
    bonuses: { might: 2, finesse: 0, arcana: 0, vitality: 1, resolve: 1 },
    unlockHint:
      "Usually found in stones kept by sentries, mercenaries, and those who swear themselves to the road.",
  },
  rogue: {
    label: "Rogue",
    description:
      "A sly blessing of silence, quick hands, and sharp instincts. It teaches you to move before trouble notices you.",
    bonuses: { might: 0, finesse: 3, arcana: 0, vitality: 0, resolve: 1 },
    unlockHint:
      "Usually found in stones hidden by scouts, poachers, smugglers, and patient thieves.",
  },
  duelist: {
    label: "Duelist",
    description:
      "A refined martial blessing built around timing, pressure, and one decisive exchange after another.",
    bonuses: { might: 1, finesse: 2, arcana: 0, vitality: 0, resolve: 1 },
    unlockHint:
      "Usually found in stones left by champions, challengers, and proud blades who wanted to be remembered.",
  },
  arcanist: {
    label: "Arcanist",
    description:
      "A blessing that teaches the hidden grammar of the land and lets raw wonder become something you can actually wield.",
    bonuses: { might: 0, finesse: 0, arcana: 3, vitality: 0, resolve: 1 },
    unlockHint:
      "Usually found in stones steeped in shrines, boundary magic, and old vows made to the unseen.",
  },
  healer: {
    label: "Healer",
    description:
      "A gentle but demanding blessing that turns calm, care, and endurance into real restorative power.",
    bonuses: { might: 0, finesse: 0, arcana: 2, vitality: 1, resolve: 1 },
    unlockHint:
      "Usually found in stones carried by road-saints, surgeons, and those who chose mercy without choosing weakness.",
  },
  apothecary: {
    label: "Apothecary",
    description:
      "A practical blessing of tinctures, roots, fumes, and remedies that rewards precise hands and patient study.",
    bonuses: { might: 0, finesse: 1, arcana: 1, vitality: 1, resolve: 1 },
    unlockHint:
      "Usually found in stones passed between herbalists, field medics, and careful collectors of strange cures.",
  },
  knight: {
    label: "Knight",
    description:
      "A high oath blessing of guardianship, composure, and unyielding presence in the face of ruin.",
    bonuses: { might: 1, finesse: 0, arcana: 0, vitality: 2, resolve: 1 },
    unlockHint:
      "Usually found in stones sworn over old keeps, frontier cairns, and solemn duties meant to outlive their bearers.",
  },
};

export const JOURNEY_MANASTONE_META = {
  ruby_manastone: {
    label: "Ruby Manastone",
    description:
      "A warm red gem with a pulse like banked iron. Something martial sleeps inside it.",
    classKey: "soldier",
  },
  onyx_manastone: {
    label: "Onyx Manastone",
    description:
      "A black gem that seems to drink the light around its edges. Its blessing hides behind stillness.",
    classKey: "rogue",
  },
  garnet_manastone: {
    label: "Garnet Manastone",
    description:
      "A deep crimson gem that catches light like a drawn blade. Its blessing feels precise and proud.",
    classKey: "duelist",
  },
  sapphire_manastone: {
    label: "Sapphire Manastone",
    description:
      "A blue gem with cold depth and a faint inner shimmer. Its blessing waits behind patterns you almost recognize.",
    classKey: "arcanist",
  },
  emerald_manastone: {
    label: "Emerald Manastone",
    description:
      "A green gem shot through with calm light. Its blessing feels like steady hands and living breath.",
    classKey: "healer",
  },
  amber_manastone: {
    label: "Amber Manastone",
    description:
      "Honey-gold resin hardened around drifting sparks. Its blessing smells faintly of herbs, smoke, and bitter medicine.",
    classKey: "apothecary",
  },
  diamond_manastone: {
    label: "Diamond Manastone",
    description:
      "A pale clear gem that throws back hard white light. Its blessing feels ceremonial, patient, and difficult to shake.",
    classKey: "knight",
  },
};

export const JOURNEY_LEGACY_CLASS_TO_MANASTONE = {
  warrior: "ruby_manastone",
  thief: "onyx_manastone",
  mage: "sapphire_manastone",
  soldier: "ruby_manastone",
  rogue: "onyx_manastone",
  duelist: "garnet_manastone",
  arcanist: "sapphire_manastone",
  healer: "emerald_manastone",
  apothecary: "amber_manastone",
  knight: "diamond_manastone",
};

export const JOURNEY_BAG_META = {
  none: {
    label: "No bag",
    description: "You can only keep what fits on your belt and in your hands.",
    rank: 0,
    weaponSlots: 1,
    rationCapacity: 2,
    tonicCapacity: 1,
  },
  satchel: {
    label: "Forager satchel",
    description: "A small shoulder satchel with just enough room to stop living hand-to-mouth.",
    rank: 1,
    weaponSlots: 2,
    rationCapacity: 4,
    tonicCapacity: 2,
  },
  backpack: {
    label: "Traveller's backpack",
    description: "A proper pack that lets you carry spare gear without fumbling every step.",
    rank: 2,
    weaponSlots: 3,
    rationCapacity: 6,
    tonicCapacity: 3,
  },
  field_kit: {
    label: "Expedition field kit",
    description: "A reinforced pack with careful compartments for the longer and uglier roads ahead.",
    rank: 3,
    weaponSlots: 3,
    rationCapacity: 8,
    tonicCapacity: 4,
  },
};

export const JOURNEY_WEAPON_META = {
  scavenged_weapon: {
    label: "Scavenged weapon",
    tier: "Improvised",
    description: "Better than being unarmed, but only barely.",
    bonuses: { might: 1, finesse: 0, arcana: 0, vitality: 0, resolve: 0 },
  },
  rust_worn_belt_knife: {
    label: "Rust-worn belt knife",
    tier: "Common",
    description: "Short reach, fast hand, and better than empty pockets.",
    bonuses: { might: 0, finesse: 2, arcana: 0, vitality: 0, resolve: 0 },
  },
  crude_spear_club: {
    label: "Crude spear-club",
    tier: "Common",
    description: "Awkward, heavy, and surprisingly dependable in a panic.",
    bonuses: { might: 1, finesse: 0, arcana: 0, vitality: 1, resolve: 0 },
  },
  weathered_short_sword: {
    label: "Weathered short sword",
    tier: "Uncommon",
    description: "Balanced enough to make clean work feel possible.",
    bonuses: { might: 2, finesse: 1, arcana: 0, vitality: 0, resolve: 0 },
  },
  hardened_boar_spear: {
    label: "Hardened boar spear",
    tier: "Uncommon",
    description: "Made for hunting things that do not stop when they should.",
    bonuses: { might: 2, finesse: 0, arcana: 0, vitality: 1, resolve: 0 },
  },
  travelers_hatchet: {
    label: "Traveler's hatchet",
    tier: "Uncommon",
    description: "Useful in camp, better in a fight than it has any right to be.",
    bonuses: { might: 1, finesse: 1, arcana: 0, vitality: 0, resolve: 1 },
  },
  bandit_cut_machete: {
    label: "Bandit-cut machete",
    tier: "Uncommon",
    description: "Rough steel that rewards aggression and quick hands.",
    bonuses: { might: 1, finesse: 2, arcana: 0, vitality: 0, resolve: 0 },
  },
  ashwood_bow: {
    label: "Ashwood bow",
    tier: "Rare",
    description: "Light, reliable, and far deadlier in patient hands.",
    bonuses: { might: 0, finesse: 3, arcana: 0, vitality: 0, resolve: 1 },
  },
  ember_rod: {
    label: "Ember rod",
    tier: "Rare",
    description: "A charred focus humming with the memory of heat.",
    bonuses: { might: 0, finesse: 0, arcana: 3, vitality: 0, resolve: 1 },
  },
  warded_stave: {
    label: "Warded stave",
    tier: "Rare",
    description: "Steadier than it looks, and carved to hold protective sigils.",
    bonuses: { might: 0, finesse: 0, arcana: 2, vitality: 1, resolve: 1 },
  },
  ruin_greatblade: {
    label: "Ruin greatblade",
    tier: "Epic",
    description: "Heavy steel from a harsher stretch of the road.",
    bonuses: { might: 3, finesse: 0, arcana: 0, vitality: 1, resolve: 0 },
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
  "Split Pine Ravine",
  "Sunken Causeway",
  "Briar Tollway",
  "Lantern Mile",
  "Ashen Switchback",
  "Ruined Gate Approach",
];

export const JOURNEY_BOSS_NAMES = [
  "Cornered Forest Boar",
  "Mossback Snapjaw",
  "Bridge Ambusher",
  "Marshfang Lurker",
  "Hill Band Captain",
  "Ruin-Stalker",
  "Gravepath Ogre",
  "Storm Ridge Wyrm",
  "The Border Tyrant",
  "Tollroad Reaver",
  "Mireglass Serpent",
  "Blackbriar Stag",
  "Gatehouse Revenant",
  "Ashfall Chimera",
];

export const JOURNEY_AMBIENT_INTERACTIONS = {
  arrival: [
    "You spent half an hour convincing yourself the strange sky was real.",
    "You followed a game trail, lost it, and had to start over from scratch.",
    "Every snapping twig sounded like a monster until you realized some were only rabbits.",
    "You tested bark, roots, and berries with the caution of someone who badly wants to stay alive.",
    "You stopped twice just to make sure the distant bells were real and not your imagination.",
    "A patch of flattened grass became a landmark simply because you were desperate for anything familiar.",
  ],
  survival: [
    "You found a flatter patch of ground and counted that as shelter.",
    "A stream saved the day, even if the water tasted like leaves and mud.",
    "You practised gripping your makeshift weapon until your hands stopped shaking.",
    "You learned the hard way that panic wastes more energy than walking does.",
    "You spotted old cut marks on a tree and followed them longer than you care to admit.",
    "A stretch of quiet road felt more threatening than the things that usually announce themselves.",
  ],
  frontier: [
    "A distant chimney reminded you civilization exists somewhere beyond the trees.",
    "You moved slower today, but you chose the safer trail and kept your footing.",
    "You caught yourself scanning every hedgerow before committing to the road.",
    "You are not comfortable out here yet, but you are no longer completely helpless.",
    "An old milestone told you someone once believed this road could be civilized.",
    "You crossed a stretch of road that had been cleared recently enough to make you suspicious.",
    "You found wagon ruts deep enough to promise trade, trouble, or both.",
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

export const SCREEN_STORAGE_KEY = "gameTracker.activeScreen";
export const DEFAULT_SCREEN_ID = "home";
