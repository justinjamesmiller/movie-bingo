import { SESSION_LIFETIME_OPTIONS } from '../data/session.js';

const SESSION_KEY = 'movie-bingo-session';
const SESSION_BACKUP_KEY = 'movie-bingo-session-backup';
const SNAPSHOT_KEY = 'movie-bingo-snapshot';
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_SESSION_LIFETIME_MS = Math.max(...SESSION_LIFETIME_OPTIONS.map((option) => option.hours * 60 * 60 * 1000));

function readStore(store, key) {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStore(store, key, value) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence must not interrupt a game.
  }
}

function removeStore(store, key) {
  try {
    store?.removeItem(key);
  } catch {
    // Local persistence must not interrupt a game.
  }
}

function sessionStore() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function localStore() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function getSavedSession() {
  const parsed = readStore(sessionStore(), SESSION_KEY) || readStore(localStore(), SESSION_BACKUP_KEY);
  return parsed?.code && parsed?.myId && parsed?.name ? parsed : null;
}

export function getSavedSnapshot(code) {
  const snapshot = readStore(localStore(), SNAPSHOT_KEY);
  if (!snapshot?.state || !snapshot.code) return null;
  if (code && snapshot.code !== code) return null;
  if (snapshot.state.sessionExpiresAt && Date.now() >= snapshot.state.sessionExpiresAt) return null;
  const maxAge = snapshot.state.sessionExtended ? MAX_SESSION_LIFETIME_MS : SNAPSHOT_MAX_AGE_MS;
  if (Date.now() - (snapshot.savedAt || 0) > maxAge) return null;
  return snapshot;
}

export function saveSession(session) {
  writeStore(sessionStore(), SESSION_KEY, session);
  writeStore(localStore(), SESSION_BACKUP_KEY, session);
}

export function saveSnapshot(code, state) {
  if (state.gameOver) {
    removeStore(localStore(), SNAPSHOT_KEY);
    return;
  }
  writeStore(localStore(), SNAPSHOT_KEY, { code, savedAt: Date.now(), state });
}

export function clearSavedSession() {
  removeStore(sessionStore(), SESSION_KEY);
  removeStore(localStore(), SESSION_BACKUP_KEY);
  removeStore(localStore(), SNAPSHOT_KEY);
}
