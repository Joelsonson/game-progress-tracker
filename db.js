const DB_NAME = "gameTrackerDB";
const DB_VERSION = 7;
const GAMES_STORE = "games";
const SESSIONS_STORE = "sessions";
const META_STORE = "meta";

export const GAME_STATUSES = {
  BACKLOG: "backlog",
  IN_PROGRESS: "in-progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  DROPPED: "dropped",
};

export const DEFAULT_GAME_STATUS = GAME_STATUSES.BACKLOG;

const VALID_GAME_STATUSES = new Set(Object.values(GAME_STATUSES));

export function isMainEligibleStatus(status) {
  return status === GAME_STATUSES.IN_PROGRESS;
}

function normalizeImageValue(value) {
  return typeof value === "string" && value.startsWith("data:image/")
    ? value
    : "";
}

export function normalizeGameRecord(game = {}) {
  const fallbackTimestamp = new Date().toISOString();
  const createdAt = game.createdAt || game.updatedAt || fallbackTimestamp;
  const updatedAt = game.updatedAt || createdAt;
  const status = VALID_GAME_STATUSES.has(game.status)
    ? game.status
    : GAME_STATUSES.IN_PROGRESS;

  return {
    ...game,
    id: typeof game.id === "string" && game.id ? game.id : crypto.randomUUID(),
    title: typeof game.title === "string" ? game.title.trim() : "Untitled Game",
    platform: game.platform?.trim() || "Unspecified",
    currentObjective:
      typeof game.currentObjective === "string"
        ? game.currentObjective.trim()
        : typeof game.notes === "string"
          ? game.notes.trim()
          : "",
    notes: typeof game.notes === "string" ? game.notes : "",
    coverImage: normalizeImageValue(game.coverImage),
    bannerImage: normalizeImageValue(game.bannerImage),
    artUpdatedAt: game.artUpdatedAt || null,
    status,
    isMain: Boolean(game.isMain) && isMainEligibleStatus(status),
    completedAt:
      status === GAME_STATUSES.COMPLETED ? game.completedAt || updatedAt : null,
    pausedAt: status === GAME_STATUSES.PAUSED ? game.pausedAt || updatedAt : null,
    droppedAt:
      status === GAME_STATUSES.DROPPED ? game.droppedAt || updatedAt : null,
    createdAt,
    updatedAt,
  };
}

export function normalizeSessionRecord(session = {}) {
  const fallbackTimestamp = new Date().toISOString();
  const playedAt = session.playedAt || session.createdAt || fallbackTimestamp;
  const createdAt = session.createdAt || playedAt;
  const minutes = Math.max(0, Math.round(Number(session.minutes) || 0));
  const focusPenaltyXp = Math.min(0, Math.round(Number(session.focusPenaltyXp) || 0));

  return {
    ...session,
    id:
      typeof session.id === "string" && session.id
        ? session.id
        : crypto.randomUUID(),
    gameId: typeof session.gameId === "string" ? session.gameId : "",
    minutes,
    note: typeof session.note === "string" ? session.note : "",
    meaningfulProgress: Boolean(session.meaningfulProgress),
    focusPenaltyXp,
    focusPenaltyReason:
      typeof session.focusPenaltyReason === "string"
        ? session.focusPenaltyReason
        : "",
    playedAt,
    createdAt,
  };
}

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains(GAMES_STORE)) {
        const gameStore = db.createObjectStore(GAMES_STORE, { keyPath: "id" });
        gameStore.createIndex("by_isMain", "isMain", { unique: false });
        gameStore.createIndex("by_status", "status", { unique: false });
        gameStore.createIndex("by_createdAt", "createdAt", { unique: false });
        gameStore.createIndex("by_updatedAt", "updatedAt", { unique: false });
      } else {
        const gameStore = transaction.objectStore(GAMES_STORE);

        if (!gameStore.indexNames.contains("by_isMain")) {
          gameStore.createIndex("by_isMain", "isMain", { unique: false });
        }

        if (!gameStore.indexNames.contains("by_status")) {
          gameStore.createIndex("by_status", "status", { unique: false });
        }

        if (!gameStore.indexNames.contains("by_createdAt")) {
          gameStore.createIndex("by_createdAt", "createdAt", { unique: false });
        }

        if (!gameStore.indexNames.contains("by_updatedAt")) {
          gameStore.createIndex("by_updatedAt", "updatedAt", { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionStore = db.createObjectStore(SESSIONS_STORE, {
          keyPath: "id",
        });
        sessionStore.createIndex("by_gameId", "gameId", { unique: false });
        sessionStore.createIndex("by_playedAt", "playedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }

      if (
        event.oldVersion < 7 &&
        transaction &&
        db.objectStoreNames.contains(GAMES_STORE)
      ) {
        const gameStore = transaction.objectStore(GAMES_STORE);
        const cursorRequest = gameStore.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;

          const currentValue = cursor.value;
          const normalizedValue = normalizeGameRecord(currentValue);

          if (!isSameGameRecord(currentValue, normalizedValue)) {
            cursor.update(normalizedValue);
          }

          cursor.continue();
        };
      }

      if (
        event.oldVersion < 6 &&
        transaction &&
        db.objectStoreNames.contains(SESSIONS_STORE)
      ) {
        const sessionStore = transaction.objectStore(SESSIONS_STORE);
        const cursorRequest = sessionStore.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;

          const currentValue = cursor.value;
          const normalizedValue = normalizeSessionRecord(currentValue);

          if (!isSameSessionRecord(currentValue, normalizedValue)) {
            cursor.update(normalizedValue);
          }

          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isSameGameRecord(a, b) {
  const keys = [
    "id",
    "title",
    "platform",
    "currentObjective",
    "notes",
    "coverImage",
    "bannerImage",
    "artUpdatedAt",
    "status",
    "isMain",
    "completedAt",
    "pausedAt",
    "droppedAt",
    "createdAt",
    "updatedAt",
  ];

  return keys.every((key) => a?.[key] === b?.[key]);
}

function isSameSessionRecord(a, b) {
  const keys = [
    "id",
    "gameId",
    "minutes",
    "note",
    "meaningfulProgress",
    "focusPenaltyXp",
    "focusPenaltyReason",
    "playedAt",
    "createdAt",
  ];

  return keys.every((key) => a?.[key] === b?.[key]);
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function getAllGames(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(GAMES_STORE, "readonly");
    const store = transaction.objectStore(GAMES_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getAllSessions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getMeta(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, "readonly");
    const store = transaction.objectStore(META_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function setMeta(db, key, value) {
  const transaction = db.transaction(META_STORE, "readwrite");
  const store = transaction.objectStore(META_STORE);
  store.put({ key, value });
  await waitForTransaction(transaction);
}

export async function addGame(db, game) {
  const transaction = db.transaction(GAMES_STORE, "readwrite");
  const store = transaction.objectStore(GAMES_STORE);
  store.add(game);
  await waitForTransaction(transaction);
}

export async function updateGame(db, game) {
  const transaction = db.transaction(GAMES_STORE, "readwrite");
  const store = transaction.objectStore(GAMES_STORE);
  store.put(game);
  await waitForTransaction(transaction);
}

export async function updateGames(db, games) {
  if (!games.length) return;

  const transaction = db.transaction(GAMES_STORE, "readwrite");
  const store = transaction.objectStore(GAMES_STORE);

  for (const game of games) {
    store.put(game);
  }

  await waitForTransaction(transaction);
}

export async function addSession(db, session) {
  const transaction = db.transaction(SESSIONS_STORE, "readwrite");
  const store = transaction.objectStore(SESSIONS_STORE);
  store.add(session);
  await waitForTransaction(transaction);
}

export async function clearAllData(db) {
  const transaction = db.transaction(
    [GAMES_STORE, SESSIONS_STORE, META_STORE],
    "readwrite"
  );
  transaction.objectStore(GAMES_STORE).clear();
  transaction.objectStore(SESSIONS_STORE).clear();
  transaction.objectStore(META_STORE).clear();
  await waitForTransaction(transaction);
}

export async function replaceAllData(db, payload = {}) {
  const games = Array.isArray(payload.games) ? payload.games : [];
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};

  const transaction = db.transaction(
    [GAMES_STORE, SESSIONS_STORE, META_STORE],
    "readwrite"
  );
  const gameStore = transaction.objectStore(GAMES_STORE);
  const sessionStore = transaction.objectStore(SESSIONS_STORE);
  const metaStore = transaction.objectStore(META_STORE);

  gameStore.clear();
  sessionStore.clear();
  metaStore.clear();

  for (const game of games) {
    gameStore.put(game);
  }

  for (const session of sessions) {
    sessionStore.put(session);
  }

  for (const [key, value] of Object.entries(meta)) {
    metaStore.put({ key, value });
  }

  await waitForTransaction(transaction);
}

export async function setMainGame(db, selectedId) {
  const games = await getAllGames(db);
  const transaction = db.transaction(GAMES_STORE, "readwrite");
  const store = transaction.objectStore(GAMES_STORE);
  const updatedAt = new Date().toISOString();

  for (const game of games) {
    const normalizedGame = normalizeGameRecord(game);
    const shouldBeMain =
      normalizedGame.id === selectedId &&
      isMainEligibleStatus(normalizedGame.status);

    if (normalizedGame.isMain !== shouldBeMain) {
      store.put({
        ...normalizedGame,
        isMain: shouldBeMain,
        updatedAt,
      });
    }
  }

  await waitForTransaction(transaction);
}
