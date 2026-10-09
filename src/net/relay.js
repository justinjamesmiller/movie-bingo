// Relay-based multiplayer engine: every player subscribes to a single Supabase
// Realtime channel (named after the 4-character game code) and broadcasts
// messages to it -- Supabase's server relays messages to everyone else on the
// channel, so no peer-to-peer networking or NAT traversal is needed. Presence
// tracks who is currently connected. Ordinary gameplay runs on the Edge
// Function against the stored room snapshot, even without a connected host.
// The lowest-seat connected authorized host coordinates host-only controls.
import { createClient } from '@supabase/supabase-js';
import {
  pickTropePool,
  buildPlayerBoard,
  getEligibleTropeTexts,
  GENRES,
  SUBGENRES_BY_GENRE,
  CENTER_INDEX,
  FREE_SPACE_TEXT,
  GENERAL_PERCENT_OPTIONS,
  DEFAULT_GENERAL_PERCENT,
  TOTAL_TROPES_OPTIONS,
  DEFAULT_TOTAL_TROPES,
} from '../data/tropes.js';
import { AVATAR_OPTIONS } from '../data/avatars.js';
import { isValidDisagreeRationale } from '../data/disagreeRationales.js';
import { DEFAULT_SESSION_LIFETIME_HOURS, SESSION_LIFETIME_OPTIONS } from '../data/session.js';
import { getCompletedLines } from '../utils/bingoLines.js';
import { formatPlayerName } from '../utils/playerName.js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const CHANNEL_PREFIX = 'bingo-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CLAIM_TIMEOUT_MS = 20000;
const CONNECT_TIMEOUT_MS = 10000;
const JOIN_TIMEOUT_MS = 10000;
// A phone that backgrounds for a moment (answering a text, locking the screen)
// drops its websocket almost immediately, so presence "leave" alone is far too
// trigger-happy to treat as someone having actually left the game.
const DISCONNECT_GRACE_MS = 120000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const HOST_HEARTBEAT_INTERVAL_MS = 20000;
const VALID_GENRES = new Set(GENRES.map((g) => g.id));
const VALID_GENERAL_PERCENTS = new Set(GENERAL_PERCENT_OPTIONS);
const VALID_TOTAL_TROPES = new Set(TOTAL_TROPES_OPTIONS);
const DEFAULT_GENRE = 'horror';
const SESSION_KEY = 'movie-bingo-session';
// Mirrored in localStorage so closing the tab (which wipes sessionStorage)
// doesn't cost the player their seat.
const SESSION_BACKUP_KEY = 'movie-bingo-session-backup';
const SNAPSHOT_KEY = 'movie-bingo-snapshot';
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_SESSION_LIFETIME_MS = Math.max(...SESSION_LIFETIME_OPTIONS.map((option) => option.hours * 60 * 60 * 1000));
const MAX_TIMER_DELAY_MS = 2_000_000_000;
const MAX_CUSTOM_TROPES = 20;
const MAX_CUSTOM_TROPE_LENGTH = 60;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 60;
const MAX_TRACKED_MESSAGE_SENDERS = 128;
const ALLOWED_REACTIONS = new Set(['👏', '😂', '😱', '🔥', '❤️']);

export const SERVER_GAMEPLAY_ACTIONS = new Set([
  'recordTropeView',
  'setWager',
  'proposeWagerChange',
  'proposeBoardSwap',
  'claim',
  'challenge',
  'vote',
  'toggleCall',
  'withdrawQueuedClaim',
  'cancelClaim',
  'changeName',
  'changeAvatar',
  'respondToProfileChange',
  'proposeCustom',
  'proposeReplace',
  'proposeAccept',
  'settleClaim',
  'chooseReplacement',
  'cycleReplacement',
  'cancelReplacement',
  'requestBoardRecovery',
  'respondToBoardRecovery',
  'cancelBoardRecovery',
]);

export function applyServerGameAction(snapshot, playerId, action) {
  if (!SERVER_GAMEPLAY_ACTIONS.has(action?.t) || !Object.hasOwn(snapshot.players, playerId)) {
    throw new Error('Invalid server gameplay action.');
  }
  const messages = [];
  const engine = Object.create(GameClient.prototype);
  Object.assign(engine, {
    state: structuredClone(snapshot),
    myId: playerId,
    code: snapshot.code,
    _serverMode: true,
    _pendingDisconnects: new Map(),
    _emitState() {},
    onEvent(event) {
      if (event.type === 'proposalRejected')
        messages.push({ t: 'proposalRejected', to: playerId, message: event.message });
      if (event.type === 'claimCancelled') messages.push({ t: 'claimCancelled', text: event.text });
    },
    _saveSession() {},
    _send(message) {
      if (message.t !== 'state') messages.push(structuredClone(message));
    },
  });
  if (engine.state.pendingClaim) engine.state.pendingClaim.serverManaged = true;
  if (engine.state.pendingClaim && !Number.isFinite(engine.state.pendingClaim.expiresAt)) {
    const createdAt = Number(engine.state.pendingClaim.claimId.split('-')[1]);
    engine.state.pendingClaim.expiresAt = (Number.isFinite(createdAt) ? createdAt : Date.now()) + CLAIM_TIMEOUT_MS;
    engine.state.pendingClaim.serverManaged = true;
  }
  if (engine.state.pendingClaim?.expiresAt <= Date.now()) {
    engine._resolveClaim(engine.state.pendingClaim.claimId);
  }
  if (engine.state.pendingBoardRecovery?.expiresAt <= Date.now()) engine._completeBoardRecovery();
  if (action.t !== 'settleClaim') engine._applyAction(playerId, action);
  return { state: engine.state, messages };
}

// Storage can be entirely unavailable (private browsing, blocked cookies) or
// throw on write (quota), and none of it is worth failing a game over.
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
    // ignore
  }
}

function removeStore(store, key) {
  try {
    store?.removeItem(key);
  } catch {
    // ignore
  }
}

function sessionStore() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function localStore() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function isValidSubgenre(genre, subgenre) {
  return (SUBGENRES_BY_GENRE[genre] || []).some((s) => s.id === subgenre);
}

function isValidSessionLifetime(hours) {
  return SESSION_LIFETIME_OPTIONS.some((option) => option.hours === hours);
}

// Picks a random avatar, preferring one not already in use by another
// connected/seated player (falls back to the full pool once every avatar is
// taken, e.g. more players than AVATAR_OPTIONS entries).
function randomAvatar(usedAvatars = []) {
  const used = new Set(usedAvatars.filter(Boolean));
  const available = AVATAR_OPTIONS.filter((a) => !used.has(a));
  const pool = available.length > 0 ? available : AVATAR_OPTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Pre-marks any board spaces that match tropes already accepted before this
// board was dealt (e.g. a player joining mid-game) so they don't have to
// re-claim something the group already confirmed happened.
function markAlreadyAcceptedTropes(board, marked, acceptedTropes) {
  board.forEach((text, index) => {
    if (acceptedTropes.includes(text) && !marked.includes(index)) marked.push(index);
  });
}

function recordMarathonWatch(state) {
  if (!state.started) return;
  if (!state.marathon) state.marathon = { watches: [] };
  const watchNumber = state.marathon.watches.length + 1;
  const players = Object.values(state.players).map((player) => {
    const tropes = player.board.filter(
      (text, index) => player.marked.includes(index) && state.acceptedTropes.includes(text),
    ).length;
    const bingos = getCompletedLines(player.marked).length;
    const wagerHits = player.wagered.filter((index) => player.marked.includes(index)).length;
    const calls = state.callStats?.[player.id] || {};
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      tropes,
      bingos,
      wagerHits,
      callsMade: calls.made || 0,
      correctCalls: calls.correct || 0,
    };
  });
  state.marathon.watches.push({ number: watchNumber, movie: state.movie, completedAt: Date.now(), players });
}

function approvedPlayersFromVotes(players, votes) {
  return Object.entries(votes)
    .filter(([, agree]) => agree)
    .map(([id]) => ({ id, name: players[id]?.name || 'Unknown player', avatar: players[id]?.avatar || '👤' }));
}

function formatNameList(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function approvalSentence(approvedBy) {
  const names = approvedBy.map((player) => formatPlayerName(player));
  return names.length > 0 ? ` Approved by ${formatNameList(names)}.` : '';
}

// Sanitizes a list of free-text custom trope submissions (host/reset-time):
// trims, drops blanks, caps length, dedupes, caps total count.
function sanitizeCustomTropes(customTropes) {
  const seen = new Set();
  const safe = [];
  for (const raw of Array.isArray(customTropes) ? customTropes : []) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, MAX_CUSTOM_TROPE_LENGTH);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    safe.push(trimmed);
    if (safe.length >= MAX_CUSTOM_TROPES) break;
  }
  return safe;
}

// Sanitizes a host/reset genre + sub-genre selection: `genres` is an array of
// genre ids (at least one, deduped, falls back to the default genre if none
// are valid); `subgenreSelections` is an array of `{genre, subgenre}` pairs
// layered on top of each selected genre's implicit "general" pool (dropped if
// they don't reference a selected genre, aren't a real sub-genre, or are
// 'general' itself, and deduped).
function sanitizeGenreSelection(genres, subgenreSelections) {
  const safeGenres = Array.from(new Set((Array.isArray(genres) ? genres : []).filter((g) => VALID_GENRES.has(g))));
  if (safeGenres.length === 0) safeGenres.push(DEFAULT_GENRE);

  const seen = new Set();
  const safeSelections = (Array.isArray(subgenreSelections) ? subgenreSelections : []).filter((s) => {
    if (!s || typeof s.genre !== 'string' || typeof s.subgenre !== 'string') return false;
    if (s.subgenre === 'general' || !safeGenres.includes(s.genre) || !isValidSubgenre(s.genre, s.subgenre))
      return false;
    const key = `${s.genre}::${s.subgenre}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { genres: safeGenres, subgenreSelections: safeSelections };
}

// Sanitizes a `{[genre]: percent}` map -- every selected genre gets its own
// independent general/specific mix slider, defaulting to the standard
// default percent if missing or invalid for that genre.
function sanitizeGeneralPercents(genres, generalPercents) {
  const safe = {};
  for (const genre of genres) {
    const val = generalPercents?.[genre];
    safe[genre] = VALID_GENERAL_PERCENTS.has(val) ? val : DEFAULT_GENERAL_PERCENT;
  }
  return safe;
}

function randomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

function randomId() {
  return 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function isValidPlayerId(id) {
  return typeof id === 'string' && /^p[a-z0-9]{1,20}$/.test(id);
}

function isValidReplicatedState(state) {
  if (
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state) ||
    typeof state.code !== 'string' ||
    !Array.isArray(state.seatOrder) ||
    state.seatOrder.length === 0 ||
    new Set(state.seatOrder).size !== state.seatOrder.length ||
    !state.players ||
    typeof state.players !== 'object' ||
    Array.isArray(state.players) ||
    !Array.isArray(state.genres) ||
    !Array.isArray(state.subgenreSelections) ||
    !Array.isArray(state.tropePool) ||
    !Array.isArray(state.acceptedTropes)
  ) {
    return false;
  }
  return state.seatOrder.every((id) => {
    if (typeof id !== 'string' || !Object.hasOwn(state.players, id)) return false;
    const player = state.players[id];
    return (
      player &&
      typeof player === 'object' &&
      player.id === id &&
      Number.isInteger(player.seat) &&
      typeof player.connected === 'boolean' &&
      Array.isArray(player.board) &&
      player.board.length === 25 &&
      Array.isArray(player.marked) &&
      player.marked.every((index) => Number.isInteger(index) && index >= 0 && index < 25) &&
      Array.isArray(player.wagered) &&
      player.wagered.every((index) => Number.isInteger(index) && index >= 0 && index < 25)
    );
  });
}

function shuffled(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export class GameClient {
  constructor({ onState, onEvent } = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).');
    }
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.myId = randomId();
    this.authUserId = null;
    this.channel = null;
    this.state = null;
    this.claimTimeout = null;
    this._pendingJoin = null;
    this._pendingDisconnects = new Map();
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._reconnectPaused = false;
    this._sessionExpiryTimer = null;
    this._queuedActions = [];
    this._messageRateLimits = new Map();
    this._publishQueue = Promise.resolve();
    this._actionQueue = Promise.resolve();
    this._serverGameplayEnabled = false;
    this._statePublishGeneration = 0;
    this._hostHeartbeatTimer = null;
    this._installLifecycleListeners();
  }

  async _ensureAuthenticated() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    let user = data?.session?.user;
    if (!user) {
      const result = await this.supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
      user = result.data?.user;
    }
    if (!user?.id) throw new Error('Could not establish a secure game identity.');
    this.authUserId = user.id;
    return user.id;
  }

  async _relayRequest(operation, values = {}) {
    const { data, error } = await this.supabase.functions.invoke('game-relay', {
      body: { operation, ...values },
    });
    if (error) {
      const failure = new Error(error.message || 'Could not reach the secure game relay.');
      failure.retryable = !error.context?.status || error.context.status >= 500;
      throw failure;
    }
    if (data?.error) throw new Error(data.error);
    this._serverGameplayEnabled = data?.gameplayMode === 'server';
    return data;
  }

  _syncHostHeartbeat() {
    if (!this.state || !this.code || this._destroyed || this.channel?.state !== 'joined') {
      clearInterval(this._hostHeartbeatTimer);
      this._hostHeartbeatTimer = null;
      return;
    }
    if (this._hostHeartbeatTimer) return;
    this._hostHeartbeatTimer = setInterval(() => {
      this._relayRequest('heartbeat', { code: this.code, playerId: this.myId })
        .then((result) => {
          if (isValidReplicatedState(result?.state) && result.state.serverRevision > this.state.serverRevision) {
            this.state = result.state;
            this._emitState();
          }
        })
        .catch(() => {});
    }, HOST_HEARTBEAT_INTERVAL_MS);
    this._hostHeartbeatTimer.unref?.();
  }

  // Returning to the tab or regaining network are the two moments when a
  // silently-dropped subscription is most likely, and also exactly when the
  // player expects to be back in the game -- so re-check the channel then
  // rather than making them refresh the page.
  _installLifecycleListeners() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this._onWake = () => {
      if (document.visibilityState === 'hidden') return;
      this._checkConnection();
    };
    document.addEventListener('visibilitychange', this._onWake);
    window.addEventListener('online', this._onWake);
    window.addEventListener('focus', this._onWake);
  }

  _removeLifecycleListeners() {
    if (!this._onWake) return;
    document.removeEventListener('visibilitychange', this._onWake);
    window.removeEventListener('online', this._onWake);
    window.removeEventListener('focus', this._onWake);
    this._onWake = null;
  }

  destroy() {
    this._destroyed = true;
    if (this._pendingJoin?.awaitingApproval && this.code && this.myId) {
      this._relayRequest('cancel-join', { code: this.code, playerId: this.myId }).catch(() => {});
    }
    this._pendingJoin = null;
    clearTimeout(this.claimTimeout);
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._boardRecoveryTimer);
    clearTimeout(this._sessionExpiryTimer);
    clearInterval(this._hostHeartbeatTimer);
    this._reconnectTimer = null;
    this._hostHeartbeatTimer = null;
    this._pendingDisconnects.forEach((timer) => clearTimeout(timer));
    this._pendingDisconnects.clear();
    this._messageRateLimits.clear();
    this._removeLifecycleListeners();
    if (this.channel) this.supabase.removeChannel(this.channel);
  }

  // ---------- Session persistence (lets a disconnected player/host reconnect) ----------

  static getSavedSession() {
    const parsed = readStore(sessionStore(), SESSION_KEY) || readStore(localStore(), SESSION_BACKUP_KEY);
    if (!parsed?.code || !parsed?.myId || !parsed?.name) return null;
    return parsed;
  }

  static async isSavedSessionActive(savedSession) {
    if (!savedSession?.code || !savedSession?.myId) return false;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    if (!authData?.session) return false;
    const { data, error } = await supabase.functions.invoke('game-relay', {
      body: { operation: 'join-status', code: savedSession.code, playerId: savedSession.myId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const expiresAt = Number.isFinite(data?.expiresAt) ? data.expiresAt : data?.state?.sessionExpiresAt;
    return (
      data?.status === 'active' &&
      isValidReplicatedState(data.state) &&
      Object.hasOwn(data.state.players, savedSession.myId) &&
      !data.state.gameOver &&
      (!Number.isFinite(expiresAt) || Date.now() < expiresAt)
    );
  }

  // The full replicated game state, kept so a game can be revived even when
  // every player was disconnected at once and nobody is left to answer.
  static getSavedSnapshot(code) {
    const snap = readStore(localStore(), SNAPSHOT_KEY);
    if (!snap?.state || !snap.code) return null;
    if (code && snap.code !== code) return null;
    if (snap.state.sessionExpiresAt && Date.now() >= snap.state.sessionExpiresAt) return null;
    const maxAge = snap.state.sessionExtended ? MAX_SESSION_LIFETIME_MS : SNAPSHOT_MAX_AGE_MS;
    if (Date.now() - (snap.savedAt || 0) > maxAge) return null;
    return snap;
  }

  static clearSavedSession() {
    removeStore(sessionStore(), SESSION_KEY);
    removeStore(localStore(), SESSION_BACKUP_KEY);
    removeStore(localStore(), SNAPSHOT_KEY);
  }

  _saveSession(code, name) {
    const session = { code, myId: this.myId, name, avatar: this.state?.players?.[this.myId]?.avatar };
    writeStore(sessionStore(), SESSION_KEY, session);
    writeStore(localStore(), SESSION_BACKUP_KEY, session);
  }

  _saveCurrentSession() {
    const me = this.state?.players?.[this.myId];
    if (this.code && me) this._saveSession(this.code, me.name);
  }

  _saveSnapshot() {
    if (!this.state || !this.code) return;
    if (this.state.gameOver) {
      removeStore(localStore(), SNAPSHOT_KEY);
      return;
    }
    writeStore(localStore(), SNAPSHOT_KEY, { code: this.code, savedAt: Date.now(), state: this.state });
  }

  // ---------- Public API ----------

  async hostGame(
    name,
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes,
    genrePercents,
    subgenrePercents,
    movie,
    hostRecoveryPassword = '',
  ) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Please enter your name.');
    const safe = sanitizeGenreSelection(genres, subgenreSelections);
    const useFreeSpace = !!freeSpace;
    const safeGeneralPercents = sanitizeGeneralPercents(safe.genres, generalPercents);
    const safeTotalTropes = VALID_TOTAL_TROPES.has(totalTropes) ? totalTropes : DEFAULT_TOTAL_TROPES;
    const safeCustomTropes = sanitizeCustomTropes(customTropes);
    const code = randomCode();
    await this._ensureAuthenticated();
    this.code = code;
    this._initHostState(
      code,
      trimmedName,
      safe.genres,
      safe.subgenreSelections,
      useFreeSpace,
      safeGeneralPercents,
      safeTotalTropes,
      safeCustomTropes,
      genrePercents,
      subgenrePercents,
      movie,
    );
    await this._relayRequest('create', {
      code,
      playerId: this.myId,
      state: this.state,
      hostRecoveryPassword: hostRecoveryPassword || undefined,
    });
    await this._connectChannel(code);
    this._saveSession(code, trimmedName);
    this._emitState();
    return code;
  }

  // Resolves to `{ needsChoice: false }` once fully joined, `{ needsChoice: true,
  // options, allowNew, name }` if the host finds disconnected seats on that
  // code (see claimDisconnectedSeat), or `{ needsApproval: true }` if the game
  // has already started and the host must approve this as a brand-new seat --
  // in that last case, listen for the 'joinApproved'/'joinDenied' events.
  async joinGame(code, name, hostRecoveryPassword = '') {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return Promise.reject(new Error('Please enter your name.'));
    const normalized = code.trim().toUpperCase();
    await this._ensureAuthenticated();
    const membership = await this._relayRequest('join', {
      code: normalized,
      requestedPlayerId: this.myId,
      newSeat: true,
      name: trimmedName,
      hostRecoveryPassword: hostRecoveryPassword || undefined,
    });
    this.myId = membership.playerId;
    this.code = normalized;
    if (membership.isHost && isValidReplicatedState(membership.state)) {
      this.state = membership.state;
      const me = this.state.players[this.myId];
      me.connected = true;
      me.name = trimmedName;
      await this._connectChannel(normalized);
      this._saveSession(normalized, trimmedName);
      this._emitState();
      await this._send({ t: 'state', state: this.state });
      return { needsChoice: false };
    }
    if (membership.needsApproval || membership.status === 'pending') {
      this._pendingJoin = { awaitingApproval: true, name: trimmedName };
      this._watchJoinApproval(normalized, this.myId, trimmedName).catch(() => {});
      return { needsApproval: true };
    }
    await this._connectChannel(normalized);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingJoin = null;
        reject(
          new Error(
            'No response from a host with that code. Double-check the code and that the host is still connected.',
          ),
        );
      }, JOIN_TIMEOUT_MS);

      this._pendingJoin = {
        name: trimmedName,
        resolve: () => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          this._saveSession(normalized, trimmedName);
          resolve({ needsChoice: false });
        },
        reject: (err) => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          reject(err);
        },
        choice: (options, allowNew) => {
          clearTimeout(timeout);
          resolve({ needsChoice: true, options, allowNew, name: trimmedName });
        },
        pending: () => {
          clearTimeout(timeout);
          this._pendingJoin.awaitingApproval = true;
          resolve({ needsApproval: true });
        },
      };
      this._send({ t: 'join', from: this.myId, name: trimmedName });
    });
  }

  async _watchJoinApproval(code, playerId, name) {
    const expiresAt = Date.now() + JOIN_TIMEOUT_MS;
    while (!this._destroyed && this._pendingJoin?.awaitingApproval && Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (this._destroyed || !this._pendingJoin?.awaitingApproval) return;
      try {
        const result = await this._relayRequest('join-status', { code, playerId });
        if (result.status === 'revoked') {
          this._pendingJoin = null;
          this.onEvent({ type: 'joinDenied', reason: 'The host declined your request to join.' });
          this.destroy();
          return;
        }
        if (result.status !== 'active' || !isValidReplicatedState(result.state)) continue;
        this.code = code;
        this.myId = playerId;
        this.state = result.state;
        await this._connectChannel(code);
        this._saveSession(code, name);
        this._emitState();
        this._pendingJoin = null;
        this.onEvent({ type: 'joinApproved' });
        return;
      } catch (error) {
        if (Date.now() >= expiresAt) {
          this._pendingJoin = null;
          this.onEvent({ type: 'joinDenied', reason: error.message || 'The host did not respond in time.' });
          this.destroy();
          return;
        }
      }
    }
    if (!this._destroyed && this._pendingJoin?.awaitingApproval) {
      this._pendingJoin = null;
      this.onEvent({ type: 'joinDenied', reason: 'The host did not respond in time.' });
      this.destroy();
    }
  }

  // Re-sends the join request on the same (already-connected) temp channel,
  // telling the host to skip the claim-offer and create a brand-new seat.
  // Used when the player picks "Join as a new player" from the choice modal.
  // Resolves to `{ needsApproval: true }` the same way joinGame() can, if the
  // game has already started.
  async confirmNewJoin(name) {
    const trimmedName = (name || '').trim();
    const membership = await this._relayRequest('join', { code: this.code, newSeat: true });
    this.myId = membership.playerId;
    if (membership.needsApproval || membership.status === 'pending') {
      this._pendingJoin = { awaitingApproval: true, name: trimmedName };
      this._watchJoinApproval(this.code, this.myId, trimmedName).catch(() => {});
      return { needsApproval: true };
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingJoin = null;
        reject(new Error('No response from the host.'));
      }, JOIN_TIMEOUT_MS);
      this._pendingJoin = {
        name: trimmedName,
        resolve: () => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          this._saveSession(this.code, trimmedName);
          resolve({ needsApproval: false });
        },
        reject: (err) => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          reject(err);
        },
        pending: () => {
          clearTimeout(timeout);
          this._pendingJoin.awaitingApproval = true;
          resolve({ needsApproval: true });
        },
      };
      this._send({ t: 'join', from: this.myId, name: trimmedName, forceNew: true });
    });
  }

  // Takes over an existing (disconnected) seat picked from the choice modal --
  // reconnects using that seat's id (same mechanism as rejoinGame) so its
  // board/wagers/marks are preserved, but with the freshly-entered name.
  async claimDisconnectedSeat(seatId, name) {
    const trimmedName = (name || '').trim();
    const code = this.code;
    await this._relayRequest('claim-seat', { code, playerId: this.myId, seatId });
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.myId = seatId;
    return new Promise((resolve, reject) => {
      this._connectChannel(code)
        .then(() => {
          const timeout = setTimeout(() => {
            this._pendingJoin = null;
            reject(new Error('No response from that game. It may have ended.'));
          }, JOIN_TIMEOUT_MS);
          this._pendingJoin = {
            resolve: () => {
              clearTimeout(timeout);
              this._pendingJoin = null;
              this._saveSession(code, trimmedName);
              resolve();
            },
            reject: (err) => {
              clearTimeout(timeout);
              this._pendingJoin = null;
              reject(err);
            },
          };
          this._send({ t: 'rejoin', from: seatId, name: trimmedName });
        })
        .catch(reject);
    });
  }

  // Reconnects using a previously-saved session (same player id), which lets a
  // disconnected host resume host authority once they reconnect (host authority
  // is always the lowest-seat *connected* player, so restoring `connected: true`
  // on the original host's seat automatically hands authority back to them).
  async rejoinGame() {
    const saved = GameClient.getSavedSession();
    if (!saved) return Promise.reject(new Error('No previous session found to reconnect to.'));
    await this._ensureAuthenticated();
    let membership;
    try {
      membership = await this._relayRequest('join', { code: saved.code, requestedPlayerId: saved.myId });
    } catch {
      GameClient.clearSavedSession();
      throw new Error('No response from that game. It may have ended.');
    }
    if (membership.playerId !== saved.myId) throw new Error('This browser is not authorized to reclaim that seat.');
    this.myId = saved.myId;
    this.code = saved.code;
    if (membership.isHost && isValidReplicatedState(membership.state)) {
      this.state = membership.state;
      const me = this.state.players[this.myId];
      const noOtherConnectedPlayers = Object.values(this.state.players).every(
        (player) => player.id === this.myId || !player.connected,
      );
      me.connected = true;
      if (saved.name) me.name = saved.name;
      await this._connectChannel(saved.code);
      this._saveSession(saved.code, me.name);
      this._emitState();
      await this._send({ t: 'state', state: this.state });
      if (noOtherConnectedPlayers) this.onEvent({ type: 'gameRestored' });
      return;
    }
    return new Promise((resolve, reject) => {
      this._connectChannel(saved.code)
        .then(() => {
          const timeout = setTimeout(() => {
            this._pendingJoin = null;
            GameClient.clearSavedSession();
            reject(new Error('No response from that game. It may have ended.'));
          }, JOIN_TIMEOUT_MS);

          this._pendingJoin = {
            resolve: () => {
              clearTimeout(timeout);
              this._pendingJoin = null;
              this._saveSession(saved.code, saved.name);
              resolve();
            },
            reject: (err) => {
              clearTimeout(timeout);
              this._pendingJoin = null;
              GameClient.clearSavedSession();
              reject(err);
            },
          };
          this._send({ t: 'rejoin', from: this.myId, name: saved.name });
        })
        .catch(reject);
    });
  }

  setWager(indices) {
    this._dispatch({ t: 'setWager', indices });
  }

  // Proposes adding and/or removing wagers after the game has started (e.g. a
  // slot freed up via an approved 'replace', spaces never wagered pre-game,
  // or simply changing one's mind) -- unlike setWager, this requires majority
  // approval from the other players since it happens mid-game. All removals
  // and additions picked at once are submitted together as a single proposal.
  proposeWagerChange(add, remove) {
    this._dispatch({ t: 'proposeWagerChange', add, remove });
  }

  // Asks the group to deal this player a brand new board (majority approval,
  // same as any other mid-game change).
  proposeBoardSwap() {
    this._dispatch({ t: 'proposeBoardSwap' });
  }

  startGame() {
    this._dispatch({ t: 'start' });
  }

  claim(index, sceneContext) {
    this._dispatch({ t: 'claim', index, sceneContext });
  }

  challengeTrope(text, sceneContext) {
    this._dispatch({ t: 'challenge', text, sceneContext });
  }

  vote(claimId, agree, rationale) {
    this._dispatch({ t: 'vote', claimId, agree, rationale });
  }

  toggleCall(text) {
    this._dispatch({ t: 'toggleCall', text });
  }

  recordTropeView(text) {
    this._dispatch({ t: 'recordTropeView', text });
  }

  cancelClaim(claimId) {
    this._dispatch({ t: 'cancelClaim', claimId });
  }

  withdrawQueuedClaim(queueId) {
    this._dispatch({ t: 'withdrawQueuedClaim', queueId });
  }

  resetGame(
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes,
    genrePercents,
    subgenrePercents,
    movie,
  ) {
    this._dispatch({
      t: 'reset',
      genres,
      subgenreSelections,
      freeSpace,
      generalPercents,
      totalTropes,
      customTropes,
      genrePercents,
      subgenrePercents,
      movie,
    });
  }

  // `genre`/`subgenre` here can be ANY genre/sub-genre in the whole registry,
  // independent of the game's own configured genres -- swapping a trope out
  // for something from a totally different genre is intentional.
  proposeReplace(text, genre, subgenre, sceneContext) {
    this._dispatch({ t: 'proposeReplace', text, genre, subgenre, sceneContext });
  }

  chooseReplacement(text) {
    this._dispatch({ t: 'chooseReplacement', text });
  }

  cycleReplacement() {
    this._dispatch({ t: 'cycleReplacement' });
  }

  cancelReplacement() {
    this._dispatch({ t: 'cancelReplacement' });
  }

  proposeAccept(text, sceneContext) {
    this._dispatch({ t: 'proposeAccept', text, sceneContext });
  }

  // Host-only: marks the game as over and broadcasts a recap trigger to
  // everyone (no further claims/wagers can be proposed after this).
  declareGameOver() {
    this._dispatch({ t: 'gameOver' });
  }

  // Host-only: reopens an ended game so extra late/after-credits tropes can
  // still be claimed without resetting the board or accepted-trope history.
  resumeGame() {
    this._dispatch({ t: 'resumeGame' });
  }

  updateSessionLifetime(extended, hours) {
    this._dispatch({ t: 'updateSessionLifetime', extended: !!extended, hours });
  }

  updateMovie(movie) {
    this._dispatch({ t: 'updateMovie', movie });
  }

  changeName(newName) {
    const trimmed = (newName || '').trim().slice(0, 20);
    if (!trimmed) return;
    this._dispatch({ t: 'changeName', name: trimmed });
    this._saveSession(this.code, trimmed);
  }

  changeAvatar(avatar) {
    if (!AVATAR_OPTIONS.includes(avatar)) return;
    this._dispatch({ t: 'changeAvatar', avatar });
  }

  // Submits a brand-new free-text trope (not part of the pre-built pool) for
  // majority approval mid-game -- if approved it's added to the accepted
  // list AND the trope pool (so it shows up in "All Tropes" going forward).
  proposeCustomTrope(text, sceneContext) {
    this._dispatch({ t: 'proposeCustom', text, sceneContext });
  }

  // Ephemeral -- not part of replicated game state, just a fire-and-forget
  // broadcast (with an optimistic local echo, since broadcast.self is false)
  // so everyone sees a brief reaction burst.
  sendReaction(emoji) {
    this._send({ t: 'reaction', from: this.myId, emoji });
    this.onEvent({ type: 'reaction', from: this.myId, emoji });
  }

  // Host-only: removes a player and rotates the game code as a security
  // measure (in case the old code leaked), then transparently migrates every
  // still-connected client (including the host) to the new code's channel.
  kickPlayer(targetId) {
    this._dispatch({ t: 'kick', targetId });
  }

  restoreDisconnectedBoard(targetId, sourceId) {
    this._dispatch({ t: 'restoreDisconnectedBoard', targetId, sourceId });
  }

  requestBoardRecovery(targetId, sourceId, timeoutSeconds = 30) {
    return this._dispatch({ t: 'requestBoardRecovery', targetId, sourceId, timeoutSeconds });
  }

  respondToBoardRecovery(requestId) {
    return this._dispatch({ t: 'respondToBoardRecovery', requestId });
  }

  cancelBoardRecovery(requestId) {
    return this._dispatch({ t: 'cancelBoardRecovery', requestId });
  }

  setHostRecoveryPassword(password) {
    return this._relayRequest('set-host-recovery-password', {
      code: this.code,
      playerId: this.myId,
      password,
    });
  }

  // Host-only: seats the currently-pending mid-game join request.
  approveJoinRequest() {
    this._dispatch({ t: 'approveJoin' });
  }

  // Host-only: turns away the currently-pending mid-game join request,
  // optionally rotating the game code afterward (e.g. if the code may have
  // leaked to someone unwanted).
  denyJoinRequest(rotateCode = false) {
    this._dispatch({ t: 'denyJoin', rotateCode: !!rotateCode });
  }

  addHost(targetId) {
    return this._dispatch({ t: 'addHost', targetId });
  }

  transferHost(targetId) {
    return this.addHost(targetId);
  }

  resignHost() {
    return this._dispatch({ t: 'resignHost' });
  }

  proposeProfileChange(targetId, name, avatar) {
    return this._dispatch({ t: 'proposeProfileChange', targetId, name, avatar });
  }

  respondToProfileChange(accept) {
    return this._dispatch({ t: 'respondToProfileChange', accept: !!accept });
  }

  leaveGame() {
    if (this.code && this.myId) this._relayRequest('leave', { code: this.code, playerId: this.myId }).catch(() => {});
    GameClient.clearSavedSession();
    this.destroy();
  }

  cancelReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._reconnectPaused = true;
    this.onEvent({ type: 'reconnectCancelled' });
  }

  retryReconnect() {
    if (this._destroyed || !this.state || !this.code) return;
    this._reconnectPaused = false;
    this._reconnectAttempts = 0;
    this._checkConnection();
    this.onEvent({ type: 'reconnectStarted' });
  }

  isHost() {
    return !!this.state && this._hostIds().includes(this.myId) && !!this.state.players[this.myId]?.connected;
  }

  // ---------- Channel plumbing ----------

  async _connectChannel(code) {
    await this._ensureAuthenticated();
    this.code = code;
    return new Promise((resolve, reject) => {
      const channel = this.supabase.channel(CHANNEL_PREFIX + code, {
        config: { private: true, broadcast: { self: false }, presence: { key: this.myId } },
      });
      this.channel = channel;

      channel.on('broadcast', { event: 'msg' }, ({ payload }) => this._onMessage(payload));
      channel.on('presence', { event: 'leave' }, ({ key }) => this._onPeerLeft(key));

      const timeout = setTimeout(() => {
        if (this._destroyed || this.channel !== channel) return;
        this.onEvent({ type: 'connectionStatus', status: 'disconnected' });
        this.supabase.removeChannel(channel);
        if (this.channel === channel) this.channel = null;
        reject(new Error('Could not connect to the relay. Check your connection and try again.'));
      }, CONNECT_TIMEOUT_MS);

      const finish = (callback) => {
        clearTimeout(timeout);
        callback();
      };
      let resubscribed = false;

      channel.subscribe((status, err) => {
        // Ignore status events from a channel that's already been replaced
        // (e.g. its own CLOSED callback firing after a code-rotation
        // migration intentionally removed it) -- otherwise a stale event can
        // be misread as a fresh disconnect right after successfully
        // reconnecting on the new channel. Also ignore anything after this
        // client has been explicitly destroyed (removeChannel's own async
        // teardown can still fire a CLOSED status well after the fact).
        if (this._destroyed || this.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
          finish(() => {
            channel.track({ id: this.myId });
            this._reconnectAttempts = 0;
            // realtime-js re-joins this same channel by itself after a socket
            // blip, so a replacement we scheduled on the error is now moot.
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
            this.onEvent({ type: 'connectionStatus', status: 'connected' });
            this._syncHostHeartbeat();
            if (resubscribed) {
              this._announceSelf();
              this._flushQueuedActions();
            }
            resubscribed = true;
            resolve();
          });
        } else {
          this.onEvent({ type: 'connectionStatus', status: 'disconnected' });
          this._syncHostHeartbeat();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this._scheduleReconnect();
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            finish(() => reject(err || new Error('Could not connect to the relay.')));
          }
        }
      });
    });
  }

  // Re-subscribes (with backoff) after the transport drops, then re-asserts our
  // seat so whoever currently holds authority clears our disconnected flag --
  // recovering without the player having to refresh and reconnect by hand.
  _scheduleReconnect() {
    if (this._destroyed || this._reconnectPaused || this._reconnectTimer || !this.state || !this.code) return;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this._reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    this._reconnectAttempts += 1;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnect();
    }, delay);
  }

  async _reconnect() {
    if (this._destroyed || this._reconnectPaused || !this.state || !this.code) return;
    const oldChannel = this.channel;
    try {
      await this._connectChannel(this.code);
    } catch {
      // Drop the failed attempt and fall back to the previous channel, which
      // realtime-js may still rejoin on its own -- otherwise both end up
      // subscribed to the same topic and every broadcast arrives twice.
      if (this.channel && this.channel !== oldChannel) this.supabase.removeChannel(this.channel);
      this.channel = oldChannel;
      if (!this._reconnectPaused) this._scheduleReconnect();
      return;
    }
    if (this._reconnectPaused) return;
    if (oldChannel && oldChannel !== this.channel) this.supabase.removeChannel(oldChannel);
    this._announceSelf();
    this._flushQueuedActions();
  }

  // Checks the subscription is genuinely still live and repairs it if not.
  _checkConnection() {
    if (this._destroyed || this._reconnectPaused || !this.state || !this.code) return;
    if (this.channel?.state === 'joined') {
      this.channel.track({ id: this.myId });
      this._announceSelf();
      this._flushQueuedActions();
      return;
    }
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._reconnect();
  }

  // Tells the rest of the table we're here, so a stale disconnected flag on our
  // own seat gets cleared by whoever holds authority.
  _announceSelf() {
    const me = this.state?.players?.[this.myId];
    if (!me) return;
    if (me.connected && this._currentHostId() === this.myId) {
      this._send({ t: 'state', state: this.state });
      return;
    }
    this._send({ t: 'rejoin', from: this.myId, name: me.name });
  }

  // Every message carries its sender so receivers can tell which client a
  // full-state broadcast came from (see _shouldAcceptState) and can treat any
  // traffic from a peer as proof that peer is still around. State broadcasts
  // also carry a revision that only ever moves forward, so returning clients
  // can tell a fresher snapshot from a staler one.
  _send(msg) {
    if (msg.t === 'state' && this.state) this.state.rev = (this.state.rev || 0) + 1;
    const message = msg;
    const fingerprint = message.t === 'action' ? JSON.stringify(message.action) : null;
    this._uncertainActions ||= new Map();
    const uncertain = this._uncertainActions.get(fingerprint);
    const actionRevision = this.state?.serverRevision;
    const requestId =
      message.t === 'action'
        ? uncertain?.revision === actionRevision
          ? uncertain.requestId
          : crypto.randomUUID()
        : undefined;
    const isSnapshot = message.t === 'state' || message.t === 'welcome' || message.t === 'migrate';
    const independent = ['reaction', 'resolved', 'replacementResolved'].includes(message.t);
    const generation = this._statePublishGeneration;
    const publish = async () => {
      if (isSnapshot && generation !== this._statePublishGeneration) return null;
      const expectedRevision = isSnapshot
        ? Number.isSafeInteger(message.state?.serverRevision)
          ? message.state.serverRevision
          : Number.isSafeInteger(this.state?.serverRevision)
            ? this.state.serverRevision
            : 0
        : undefined;
      if (isSnapshot && message.state?.serverRevision == null) message.state.serverRevision = expectedRevision;
      const values = {
        code: this.code,
        playerId: this.myId,
        ...(isSnapshot && { expectedRevision }),
        ...(requestId && { requestId }),
        message,
      };
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await this._relayRequest('publish', values);
          break;
        } catch (error) {
          if (!requestId || !this._serverGameplayEnabled || !error.retryable || attempt === 2) throw error;
        }
      }
      if (fingerprint) this._uncertainActions.delete(fingerprint);
      if (result?.conflict && isValidReplicatedState(result.state)) {
        this._statePublishGeneration += 1;
        this.state = result.state;
        this._emitState();
        this.onEvent({ type: 'stateConflict' });
        return null;
      }
      if (
        Number.isSafeInteger(result?.revision) &&
        result.revision > (this.state?.serverRevision || 0) &&
        result.code === this.state?.code
      ) {
        if (message.t === 'action' && isValidReplicatedState(result.state)) this.state = result.state;
        this.state.serverRevision = result.revision;
        this._emitState();
      }
      return result;
    };
    const request = independent ? publish() : this._publishQueue.then(publish);
    if (!independent) this._publishQueue = request.catch(() => {});
    return request.catch((error) => {
      if (fingerprint && this._serverGameplayEnabled && error.retryable) {
        this._uncertainActions.set(fingerprint, { requestId, revision: actionRevision });
        if (this._uncertainActions.size > 32) this._uncertainActions.delete(this._uncertainActions.keys().next().value);
      }
      this.onEvent({ type: 'relayError', message: error.message || 'The secure game relay rejected an update.' });
      return null;
    });
  }

  // Transparently swaps the transport channel to a new code (used after a
  // kick rotates the code) without disrupting the caller's in-memory state --
  // no re-entered name/code, no visible screen change.
  async _migrateToCode(newCode) {
    const oldChannel = this.channel;
    await this._connectChannel(newCode);
    if (oldChannel) this.supabase.removeChannel(oldChannel);
    const me = this.state?.players?.[this.myId];
    this._saveSession(newCode, me?.name || '');
  }

  _dispatch(action) {
    if (!this.state) return;
    if (this.channel?.state !== 'joined') {
      this._queuedActions.push(action);
      this.onEvent({ type: 'actionQueued', actionType: action.t });
      return;
    }
    const request = this._actionQueue.then(async () => {
      await this._publishQueue;
      return this._dispatchConnected(action);
    });
    this._actionQueue = request.catch(() => {});
    return request;
  }

  _dispatchConnected(action) {
    if (this._serverGameplayEnabled && SERVER_GAMEPLAY_ACTIONS.has(action?.t)) {
      return this._send({ t: 'action', from: this.myId, action });
    }
    const currentHostId = this._currentHostId();
    if (!currentHostId) {
      this._queuedActions.push(action);
      this.onEvent({ type: 'actionQueued', actionType: action.t });
      return;
    }
    if (currentHostId === this.myId) {
      this._applyAction(this.myId, action);
      return this._publishQueue;
    } else {
      return this._send({ t: 'action', from: this.myId, action });
    }
  }

  _flushQueuedActions() {
    if (this.channel?.state !== 'joined' || this._queuedActions.length === 0) return;
    const actions = this._queuedActions.splice(0);
    actions.forEach((action) => this._dispatch(action));
  }

  _currentHostId() {
    if (!this.state) return null;
    const hostIds = this._hostIds();
    return this.state.seatOrder.find((id) => hostIds.includes(id) && this.state.players[id]?.connected) || null;
  }

  _hostIds() {
    return Array.isArray(this.state?.hostIds) && this.state.hostIds.length > 0 ? this.state.hostIds : [];
  }

  _isHostId(id) {
    return this._hostIds().includes(id);
  }

  _isActiveHostId(id) {
    const activeHostIds = this._hostIds().filter((hostId) => this.state.players[hostId]?.connected);
    return activeHostIds.includes(id);
  }

  // The lowest-seat connected player, optionally ignoring one seat. Excluding a
  // seat answers "who should act for the table while that player is away",
  // which is how a rejoin request from the host itself still gets answered.
  _authorityId(excludeId = null) {
    if (!this.state) return null;
    return (
      this.state.seatOrder.find(
        (id) => id !== excludeId && this._hostIds().includes(id) && this.state.players[id]?.connected,
      ) || null
    );
  }

  _emitState() {
    if (this.state && !Object.hasOwn(this.state.players, this.myId) && !this._pendingJoin) {
      GameClient.clearSavedSession();
      this.onEvent({ type: 'kicked', reason: 'Your player session was recovered on another device.' });
      this.destroy();
      this.state = null;
      return;
    }
    clearTimeout(this._boardRecoveryTimer);
    const recovery = this.state?.pendingBoardRecovery;
    if (recovery) {
      this._boardRecoveryTimer = setTimeout(
        () => {
          if (this._serverGameplayEnabled) this._dispatch({ t: 'settleClaim' });
          else if (this._currentHostId() === this.myId) this._completeBoardRecovery();
        },
        Math.max(0, recovery.expiresAt - Date.now()),
      );
    }
    this._saveSnapshot();
    const saved = GameClient.getSavedSession();
    const me = this.state?.players?.[this.myId];
    if (
      saved?.myId === this.myId &&
      saved.code === this.code &&
      me &&
      (saved.avatar !== me.avatar || saved.name !== me.name)
    ) {
      this._saveSession(this.code, me.name);
    }
    this._scheduleSessionExpiry();
    if (this.state?.pendingClaim?.serverManaged) {
      clearTimeout(this.claimTimeout);
      const claim = this.state.pendingClaim;
      this.claimTimeout = setTimeout(
        () => this._resolveClaim(claim.claimId),
        Math.max(0, claim.expiresAt - Date.now()),
      );
    }
    this.onState(this.state, this.myId);
    this._syncHostHeartbeat();
  }

  _scheduleSessionExpiry() {
    clearTimeout(this._sessionExpiryTimer);
    const expiresAt = this.state?.sessionExpiresAt;
    if (!expiresAt) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      GameClient.clearSavedSession();
      this.onEvent({ type: 'sessionExpired' });
      this.destroy();
      return;
    }
    this._sessionExpiryTimer = setTimeout(
      () => {
        if (delay > MAX_TIMER_DELAY_MS) {
          this._scheduleSessionExpiry();
          return;
        }
        GameClient.clearSavedSession();
        this.onEvent({ type: 'sessionExpired' });
        this.destroy();
      },
      Math.min(delay, MAX_TIMER_DELAY_MS),
    );
  }

  // Presence "leave" fires the instant a phone backgrounds, so hold the seat
  // open for a grace period -- any traffic from that peer in the meantime
  // cancels the pending disconnect entirely.
  _onPeerLeft(peerId) {
    if (!this.state || !isValidPlayerId(peerId) || !Object.hasOwn(this.state.players, peerId)) return;
    if (this._pendingDisconnects.has(peerId)) return;
    this._pendingDisconnects.set(
      peerId,
      setTimeout(() => {
        this._pendingDisconnects.delete(peerId);
        this._markDisconnected(peerId);
      }, DISCONNECT_GRACE_MS),
    );
  }

  _isPresent(peerId) {
    try {
      return Object.keys(this.channel?.presenceState?.() || {}).includes(peerId);
    } catch {
      return false;
    }
  }

  // Any message from a peer proves they're still here, so cancel a pending
  // disconnect and undo a stale one.
  _notePeerAlive(peerId) {
    if (!isValidPlayerId(peerId) || peerId === this.myId || !Object.hasOwn(this.state?.players || {}, peerId)) {
      return;
    }
    const timer = this._pendingDisconnects.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this._pendingDisconnects.delete(peerId);
    }
    const player = this.state.players[peerId];
    if (!player || player.connected) return;
    player.connected = true;
    this._emitState();
    if (this._currentHostId() === this.myId) this._send({ t: 'state', state: this.state });
  }

  _markDisconnected(peerId) {
    if (!this.state || !isValidPlayerId(peerId) || !Object.hasOwn(this.state.players, peerId)) return;
    // A leave can arrive for a channel the peer has already replaced (their own
    // reconnect tears the old one down), so trust live presence over the event.
    if (this._isPresent(peerId)) return;
    const wasHost = this._currentHostId();
    this.state.players[peerId].connected = false;
    const nowHost = this._currentHostId();

    if (nowHost === this.myId && wasHost !== this.myId) {
      this._onPromotedToHost();
      this.onEvent({ type: 'promotedToHost' });
    }
    this._emitState();
    if (nowHost === this.myId) this._send({ t: 'state', state: this.state });
  }

  // Decides whether an incoming full-state broadcast should replace ours. A
  // strictly fresher revision always wins, so a client returning with a stale
  // snapshot can't roll the table back. Otherwise only a client with a
  // stronger claim to authority (a lower seat) can, and anyone else gets our
  // state re-asserted at a higher revision -- which is what settles two
  // clients briefly both believing they're host after a flaky reconnect.
  _shouldAcceptState(data) {
    if (!this.state || !data.sender) return true;
    const incomingServerRevision = data.state?.serverRevision;
    const currentServerRevision = this.state.serverRevision;
    if (
      Number.isSafeInteger(incomingServerRevision) &&
      Number.isSafeInteger(currentServerRevision) &&
      incomingServerRevision !== currentServerRevision
    ) {
      return incomingServerRevision > currentServerRevision;
    }
    const incomingRev = data.state?.rev || 0;
    const myRev = this.state.rev || 0;
    if (data.sender === this.myId && incomingRev <= myRev) return false;
    if (incomingRev > myRev) return true;
    if (this._currentHostId() !== this.myId) return true;
    const mySeat = this.state.players[this.myId]?.seat;
    const theirSeat = Object.hasOwn(this.state.players, data.sender)
      ? this.state.players[data.sender]?.seat
      : Object.hasOwn(data.state?.players || {}, data.sender)
        ? data.state.players[data.sender]?.seat
        : null;
    if (mySeat == null || theirSeat == null || theirSeat < mySeat) return true;
    this._send({ t: 'state', state: this.state });
    return false;
  }

  // Our own seat must never read as disconnected while we're plainly here --
  // repair it immediately rather than leaving the player mislabeled (which
  // previously desynced host authority until they refreshed).
  _ensureSeatConnected() {
    const me = this.state?.players?.[this.myId];
    if (!me || me.connected) return;
    me.connected = true;
    this._emitState();
    if (this._authorityId(this.myId)) {
      this._send({ t: 'rejoin', from: this.myId, name: me.name });
    } else if (this.isHost()) {
      this._send({ t: 'state', state: this.state });
    }
  }

  // ---------- Message handling ----------

  _allowIncomingMessage(sender) {
    const key = sender || 'unattributed';
    const now = Date.now();
    let bucket = this._messageRateLimits.get(key);
    if (!bucket || now - bucket.startedAt >= MESSAGE_RATE_WINDOW_MS) {
      bucket = { startedAt: now, count: 0 };
    }
    if (bucket.count >= MAX_MESSAGES_PER_WINDOW) return false;
    bucket.count += 1;
    this._messageRateLimits.set(key, bucket);
    if (this._messageRateLimits.size > MAX_TRACKED_MESSAGE_SENDERS) {
      this._messageRateLimits.delete(this._messageRateLimits.keys().next().value);
    }
    return true;
  }

  _onMessage(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.t !== 'string') return;
    if (data.sender != null && !isValidPlayerId(data.sender)) return;
    if (data.sender === this.myId) return;
    if (data.sender !== 'pserver' && !this._allowIncomingMessage(data.sender)) return;
    if (
      (data.t === 'state' ||
        data.t === 'stateConflict' ||
        data.t === 'migrate' ||
        (data.t === 'welcome' && data.to === this.myId && this._pendingJoin)) &&
      !isValidReplicatedState(data.state)
    ) {
      return;
    }
    if (data.t === 'migrate' && (typeof data.newCode !== 'string' || !data.newCode)) return;
    this._notePeerAlive(data.sender);
    switch (data.t) {
      case 'join':
        if (this._currentHostId() === this.myId) this._handleJoin(data.from, data.name, data.forceNew);
        break;
      case 'rejoin':
        // Answered by whoever holds authority *ignoring the requester* -- when
        // the host itself is the one rejoining, everyone else still considers
        // them the host, so a plain isHost() check would leave the request
        // unanswered and the host stuck retrying.
        if (this._authorityId(data.from) === this.myId) this._handleRejoin(data.from, data.name);
        break;
      case 'welcome':
        if (data.to === this.myId && this._pendingJoin) {
          this.state = data.state;
          if (this._pendingJoin.awaitingApproval) {
            this._saveSession(this.code, this._pendingJoin.name);
            this._pendingJoin = null;
            this._emitState();
            this.onEvent({ type: 'joinApproved' });
          } else {
            this._pendingJoin.resolve();
            this._emitState();
            this._flushQueuedActions();
          }
        }
        break;
      case 'joinPending':
        if (data.to === this.myId && this._pendingJoin?.pending) {
          this._pendingJoin.pending();
        }
        break;
      case 'claimOffer':
        if (data.to === this.myId && this._pendingJoin?.choice && Array.isArray(data.options)) {
          const options = data.options.filter(
            (option) =>
              option &&
              isValidPlayerId(option.id) &&
              typeof option.name === 'string' &&
              typeof option.avatar === 'string' &&
              Number.isInteger(option.seat),
          );
          if (typeof data.allowNew === 'boolean' && (options.length > 0 || data.allowNew)) {
            this._pendingJoin.choice(options, data.allowNew);
          }
        }
        break;
      case 'joinRejected':
        if (data.to === this.myId && this._pendingJoin) {
          if (this._pendingJoin.awaitingApproval) {
            this._pendingJoin = null;
            GameClient.clearSavedSession();
            const reason =
              data.reason === 'busy'
                ? 'Someone else was already waiting to join — try again shortly.'
                : 'The host declined your request to join.';
            this.onEvent({ type: 'joinDenied', reason });
            // Tear down the channel subscription now -- otherwise this
            // never-seated client keeps listening and can misread later
            // broadcasts (e.g. a subsequent code rotation) as being kicked.
            this.destroy();
          } else {
            const reason =
              data.reason === 'busy'
                ? 'Someone else is already waiting to join — try again in a moment.'
                : 'Could not join that game.';
            this._pendingJoin.reject?.(new Error(reason));
          }
        }
        break;
      case 'rejoinFailed':
        if (data.to === this.myId && this._pendingJoin) {
          this._pendingJoin.reject?.(new Error('That session could not be found — the game may have ended.'));
        }
        break;
      case 'state':
        if (!this._shouldAcceptState(data)) break;
        this.state = data.state;
        this._emitState();
        this._ensureSeatConnected();
        break;
      case 'stateConflict': {
        const incomingRevision = data.state?.serverRevision;
        const currentRevision = this.state?.serverRevision;
        if (
          isValidReplicatedState(data.state) &&
          Number.isSafeInteger(incomingRevision) &&
          (!Number.isSafeInteger(currentRevision) || incomingRevision > currentRevision)
        ) {
          this.state = data.state;
          this._emitState();
          this._ensureSeatConnected();
        }
        this.onEvent({ type: 'stateConflict' });
        break;
      }
      case 'resolved':
        this.onEvent({
          type: 'claimResolved',
          text: data.text,
          kind: data.kind,
          custom: !!data.custom,
          byId: data.byId,
          approved: data.approved,
          approvedBy: Array.isArray(data.approvedBy)
            ? data.approvedBy
                .filter((player) => player && typeof player === 'object' && !Array.isArray(player))
                .map((player) => ({
                  id: typeof player.id === 'string' ? player.id : '',
                  name: typeof player.name === 'string' ? player.name : 'Unknown player',
                  avatar: typeof player.avatar === 'string' ? player.avatar : '👤',
                }))
            : [],
          disagreeRationaleCounts: data.disagreeRationaleCounts || {},
          proposedBy: Array.isArray(data.proposedBy) ? data.proposedBy.filter(isValidPlayerId) : [],
          wagerFreed: Array.isArray(data.wagerFreedIds) && data.wagerFreedIds.includes(this.myId),
          missedCalls: Array.isArray(data.missedCalls)
            ? data.missedCalls.filter(
                (call) => call && typeof call.playerId === 'string' && typeof call.text === 'string',
              )
            : [],
        });
        break;
      case 'proposalRejected':
        if (data.to === this.myId) {
          this.onEvent({
            type: 'proposalRejected',
            message: typeof data.message === 'string' ? data.message.slice(0, 240) : 'Proposal could not be queued.',
          });
        }
        break;
      case 'claimCancelled':
        this.onEvent({ type: 'claimCancelled', text: data.text });
        break;
      case 'replacementResolved':
        this.onEvent({
          type: 'replacementResolved',
          wagerFreed: Array.isArray(data.wagerFreedIds) && data.wagerFreedIds.includes(this.myId),
        });
        break;
      case 'reaction':
        if (typeof data.from === 'string' && ALLOWED_REACTIONS.has(data.emoji)) {
          this.onEvent({ type: 'reaction', from: data.from, emoji: data.emoji });
        }
        break;
      case 'gameReset':
        this.onEvent({ type: 'gameReset' });
        break;
      case 'gameOverAnnounced':
        GameClient.clearSavedSession();
        this.onEvent({ type: 'gameOver' });
        break;
      case 'gameResumed':
        this._saveCurrentSession();
        this.onEvent({ type: 'gameResumed' });
        break;
      case 'hostAdded':
        if (data.to === this.myId) {
          this.onEvent({
            type: 'hostAdded',
            byName: typeof data.byName === 'string' ? data.byName.slice(0, 40) : 'A player',
            byAvatar: typeof data.byAvatar === 'string' ? data.byAvatar.slice(0, 16) : '👤',
          });
        }
        break;
      case 'migrate':
        if (!this.state) break;
        if (!data.state.players[this.myId]) {
          GameClient.clearSavedSession();
          this.onEvent({ type: 'kicked' });
          this.destroy();
          this.state = null;
          break;
        }
        this.state = data.state;
        this._emitState();
        this.onEvent({ type: 'codeChanged', code: data.newCode });
        this._migrateToCode(data.newCode).catch(() => {});
        break;
      case 'action':
        if (
          this._currentHostId() === this.myId &&
          typeof data.from === 'string' &&
          data.action &&
          typeof data.action === 'object' &&
          !Array.isArray(data.action)
        ) {
          this._applyAction(data.from, data.action);
        }
        break;
      default:
        break;
    }
  }

  // ---------- Host-side game state management ----------

  _initHostState(
    code,
    name,
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes = [],
    genrePercents = {},
    subgenrePercents = {},
    movie = null,
  ) {
    const tropePool = Array.from(
      new Set([
        ...pickTropePool(genres, subgenreSelections, generalPercents, totalTropes, genrePercents, subgenrePercents),
        ...customTropes,
      ]),
    );
    const board = buildPlayerBoard(tropePool, freeSpace);
    const marked = freeSpace ? [CENTER_INDEX] : [];
    this.state = {
      code,
      rev: 0,
      serverRevision: 0,
      genres,
      subgenreSelections,
      freeSpace,
      generalPercents,
      genrePercents,
      subgenrePercents,
      totalTropes,
      tropePool,
      players: {
        [this.myId]: {
          id: this.myId,
          name,
          seat: 0,
          connected: true,
          avatar: randomAvatar(),
          board,
          wagered: [],
          marked,
        },
      },
      seatOrder: [this.myId],
      hostIds: [this.myId],
      started: false,
      gameOver: false,
      pendingClaim: null,
      claimQueue: [],
      claimHistory: [],
      pendingReplacement: null,
      pendingJoinRequest: null,
      pendingProfileChanges: {},
      acceptedTropes: [],
      acceptedTropeProposers: {},
      acceptedCalls: {},
      calls: {},
      callStats: {},
      callHistory: {},
      superlativeStats: {},
      superlativeMilestones: {},
      bingoEvents: [],
      activityLog: [],
      movie,
      marathon: { watches: [] },
      sessionExtended: false,
      sessionLifetimeHours: DEFAULT_SESSION_LIFETIME_HOURS,
      sessionExpiresAt: Date.now() + DEFAULT_SESSION_LIFETIME_HOURS * 60 * 60 * 1000,
    };
  }

  // Appends a short activity-feed entry (capped to the most recent 30) --
  // part of replicated state so every client sees the identical feed.
  _logActivity(text) {
    const state = this.state;
    if (!Array.isArray(state.activityLog)) state.activityLog = [];
    state.activityLog.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, ts: Date.now() });
    state.activityLog = state.activityLog.slice(-30);
  }

  _superlativeStats(playerId) {
    this.state.superlativeStats ||= {};
    this.state.superlativeStats[playerId] ||= {
      views: 0,
      viewedTropes: [],
      submissions: 0,
      rejections: 0,
      approvalVotes: 0,
      otherApprovalVotes: 0,
      acceptedProposals: 0,
      acceptedAfterRejection: 0,
      marksAfterRejection: 0,
    };
    return this.state.superlativeStats[playerId];
  }

  _recordSuperlativeMilestone(kind, playerIds) {
    this.state.superlativeMilestones ||= {};
    if (Object.values(this.state.superlativeMilestones).some((milestone) => milestone[kind])) return;
    const ids = [...new Set(playerIds)];
    for (const id of ids) {
      this.state.superlativeMilestones[id] ||= {};
      this.state.superlativeMilestones[id][kind] = true;
      this.state.superlativeMilestones[id][`${kind}Tied`] = ids.length > 1;
    }
  }

  _handleJoin(newId, name, forceNew) {
    if (!isValidPlayerId(newId)) return;
    if (Object.hasOwn(this.state.players, newId)) {
      if (!forceNew) this._handleRejoin(newId, name);
      return;
    }
    const safeName = (typeof name === 'string' ? name.trim().slice(0, 20) : '') || 'Player';
    if (this.state.started) {
      // Brand-new seats mid-game need the host's go-ahead first -- only one
      // request can be pending at a time.
      if (this.state.pendingJoinRequest) {
        this._send({ t: 'joinRejected', to: newId, reason: 'busy' });
        return;
      }
      this.state.pendingJoinRequest = {
        id: newId,
        name: safeName,
        avatar: randomAvatar(Object.values(this.state.players).map((player) => player.avatar)),
      };
      this._send({ t: 'joinPending', to: newId });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }
    const board = buildPlayerBoard(this.state.tropePool, this.state.freeSpace);
    const marked = this.state.freeSpace ? [CENTER_INDEX] : [];
    markAlreadyAcceptedTropes(board, marked, this.state.acceptedTropes);
    const seat = this.state.seatOrder.length;
    this.state.players[newId] = {
      id: newId,
      name: safeName,
      seat,
      connected: true,
      avatar: randomAvatar(Object.values(this.state.players).map((p) => p.avatar)),
      board,
      wagered: [],
      marked,
    };
    this.state.seatOrder.push(newId);

    this._send({ t: 'welcome', to: newId, state: this.state });
    this._emitState();
    this._send({ t: 'state', state: this.state });
  }

  // Restores an existing (already-seated) player's connected flag instead of
  // creating a new seat -- unlike _handleJoin this is allowed even mid-game,
  // since it's how a disconnected host/player resumes their same seat (and,
  // for the original host, automatically regains host authority).
  _handleRejoin(id, name) {
    const player = isValidPlayerId(id) && Object.hasOwn(this.state.players, id) ? this.state.players[id] : null;
    if (!player) {
      this._send({ t: 'rejoinFailed', to: id });
      return;
    }
    player.connected = true;
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 20) : '';
    if (trimmed) player.name = trimmed;
    if (!player.avatar) {
      player.avatar = randomAvatar(
        Object.values(this.state.players)
          .filter((p) => p.id !== id)
          .map((p) => p.avatar),
      );
    }

    this._send({ t: 'welcome', to: id, state: this.state });
    this._emitState();
    this._send({ t: 'state', state: this.state });
    this._drainClaimQueue();
  }

  _onPromotedToHost() {
    if (this.state.pendingClaim) {
      clearTimeout(this.claimTimeout);
      const claimId = this.state.pendingClaim.claimId;
      this.claimTimeout = setTimeout(() => this._resolveClaim(claimId), CLAIM_TIMEOUT_MS);
    }
  }

  _applyAction(fromId, action) {
    const state = this.state;
    const player = Object.hasOwn(state.players, fromId) ? state.players[fromId] : null;
    if (!player || typeof player !== 'object' || !action || typeof action !== 'object') return;

    if (
      state.pendingBoardRecovery &&
      [
        'claim',
        'challenge',
        'proposeAccept',
        'proposeReplace',
        'proposeCustom',
        'proposeBoardSwap',
        'proposeWagerChange',
        'approveJoin',
        'denyJoin',
        'kick',
        'addHost',
        'resignHost',
        'proposeProfileChange',
        'restoreDisconnectedBoard',
      ].includes(action.t)
    ) {
      const message = 'A player recovery is in progress. Try again after it finishes.';
      if (fromId === this.myId) this.onEvent({ type: 'proposalRejected', message });
      else this._send({ t: 'proposalRejected', to: fromId, message });
      return;
    }

    if (action.t === 'requestBoardRecovery') {
      if (!Object.hasOwn(state.players, action.sourceId) || !Object.hasOwn(state.players, action.targetId)) return;
      const source = state.players[action.sourceId];
      const target = state.players[action.targetId];
      if (
        !this._isActiveHostId(fromId) ||
        ![0, 10, 30, 300].includes(action.timeoutSeconds) ||
        !state.started ||
        state.gameOver ||
        state.pendingClaim ||
        state.pendingReplacement ||
        state.claimQueue?.length ||
        state.pendingBoardRecovery ||
        state.pendingJoinRequest ||
        !source ||
        !target?.connected ||
        source.id === target.id ||
        this._isHostId(source.id) ||
        state.pendingProfileChanges?.[source.id] ||
        state.pendingProfileChanges?.[target.id]
      )
        return;
      const createdAt = Date.now();
      state.pendingBoardRecovery = {
        id: `${state.code}-recovery-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        byId: fromId,
        sourceId: source.id,
        targetId: target.id,
        expiresAt: createdAt + action.timeoutSeconds * 1000,
      };
      if (action.timeoutSeconds === 0) this._completeBoardRecovery();
      else {
        this._emitState();
        this._send({ t: 'state', state });
      }
      return;
    }

    if (action.t === 'respondToBoardRecovery') {
      const recovery = state.pendingBoardRecovery;
      if (
        !recovery ||
        recovery.sourceId !== fromId ||
        recovery.id !== action.requestId ||
        recovery.expiresAt <= Date.now()
      )
        return;
      state.pendingBoardRecovery = null;
      this._logActivity(`${formatPlayerName(player)} confirmed they are still playing; recovery cancelled.`);
      this._emitState();
      this._send({ t: 'state', state });
      return;
    }

    if (action.t === 'cancelBoardRecovery') {
      if (!this._isActiveHostId(fromId) || state.pendingBoardRecovery?.id !== action.requestId) return;
      state.pendingBoardRecovery = null;
      this._emitState();
      this._send({ t: 'state', state });
      return;
    }

    if (action.t === 'recordTropeView') {
      if (state.gameOver || typeof action.text !== 'string' || !state.tropePool.includes(action.text)) return;
      const stats = this._superlativeStats(fromId);
      stats.views += 1;
      if (!stats.viewedTropes.includes(action.text)) stats.viewedTropes.push(action.text);
      this._emitState();
      this._send({ t: 'state', state });
      return;
    }

    if (action.t === 'setWager') {
      if (state.started) return;
      const indices = Array.isArray(action.indices)
        ? action.indices.filter(
            (i) => Number.isInteger(i) && i >= 0 && i < 25 && !(state.freeSpace && i === CENTER_INDEX),
          )
        : [];
      player.wagered = Array.from(new Set(indices)).slice(0, 5);
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'proposeWagerChange') {
      if (!state.started || state.gameOver || state.pendingClaim) return;
      const remove = Array.from(new Set(Array.isArray(action.remove) ? action.remove : [])).filter(
        (i) => Number.isInteger(i) && player.wagered.includes(i),
      );
      const add = Array.from(new Set(Array.isArray(action.add) ? action.add : [])).filter(
        (i) =>
          Number.isInteger(i) &&
          i >= 0 &&
          i < 25 &&
          !(state.freeSpace && i === CENTER_INDEX) &&
          !player.marked.includes(i) &&
          !player.wagered.includes(i) &&
          !remove.includes(i),
      );
      if (add.length === 0 && remove.length === 0) return;
      const resultingCount = player.wagered.length - remove.length + add.length;
      if (resultingCount > 5) return;
      const addTexts = add.map((i) => player.board[i]);
      const removeTexts = remove.map((i) => player.board[i]);
      this._startClaim(fromId, '', 'wagerChange', { add, remove, addTexts, removeTexts });
      return;
    }

    if (action.t === 'proposeBoardSwap') {
      if (!state.started || state.gameOver || state.pendingClaim) return;
      this._startClaim(fromId, '', 'reroll');
      return;
    }

    if (action.t === 'start') {
      if (!this._isActiveHostId(fromId)) return;
      state.started = true;
      this._logActivity('🎬 The host started the game.');
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'claim') {
      if (!state.started || state.gameOver) return;
      const index = action.index;
      if (!Number.isInteger(index) || index < 0 || index >= 25) return;
      if (state.freeSpace && index === CENTER_INDEX) return;
      const kind = player.marked.includes(index) ? 'unmark' : 'mark';
      this._submitTropeProposal(fromId, player.board[index], kind, {}, action.sceneContext);
      return;
    }

    if (action.t === 'challenge') {
      if (!state.started || state.gameOver) return;
      if (typeof action.text !== 'string' || !state.acceptedTropes.includes(action.text)) return;
      this._submitTropeProposal(fromId, action.text, 'unmark', {}, action.sceneContext);
      return;
    }

    if (action.t === 'vote') {
      const pc = state.pendingClaim;
      if (!pc || pc.claimId !== action.claimId || fromId === pc.byId || Object.hasOwn(pc.votes, fromId)) return;
      pc.votes[fromId] = !!action.agree;
      if (!action.agree && isValidDisagreeRationale(pc.kind, action.rationale)) {
        pc.disagreeRationaleCounts ||= {};
        pc.disagreeRationaleCounts[action.rationale] = (pc.disagreeRationaleCounts[action.rationale] || 0) + 1;
      }
      if (this._maybeAutoResolve()) return;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'toggleCall') {
      if (!state.started || state.gameOver || typeof action.text !== 'string') return;
      if (!player.board.includes(action.text) || state.acceptedTropes.includes(action.text)) return;
      state.calls ||= {};
      state.callStats ||= {};
      if (state.calls[fromId] === action.text) {
        this._finishCall(fromId, 'withdrawn');
        delete state.calls[fromId];
      } else {
        this._finishCall(fromId, 'changed');
        state.calls[fromId] = action.text;
        state.callStats[fromId] = { ...state.callStats[fromId], made: (state.callStats[fromId]?.made || 0) + 1 };
        state.callHistory ||= {};
        state.callHistory[fromId] ||= [];
        state.callHistory[fromId].push({
          id: `${fromId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: action.text,
          status: 'active',
        });
      }
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'withdrawQueuedClaim') {
      const entry = (state.claimQueue || []).find((item) => item.id === action.queueId);
      if (!entry?.proposedBy.includes(fromId)) return;
      entry.proposedBy = entry.proposedBy.filter((id) => id !== fromId);
      entry.sceneContexts = entry.sceneContexts.filter((context) => context.playerId !== fromId);
      if (!entry.proposedBy.length) state.claimQueue = state.claimQueue.filter((item) => item !== entry);
      else entry.byId = entry.proposedBy[0];
      this._emitState();
      this._send({ t: 'state', state });
      return;
    }

    if (action.t === 'cancelClaim') {
      const pc = state.pendingClaim;
      if (!pc || pc.claimId !== action.claimId || fromId !== pc.byId) return;
      clearTimeout(this.claimTimeout);
      state.pendingClaim = null;
      state.pendingReplacement = null;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      this.onEvent({ type: 'claimCancelled', text: pc.text });
      this._drainClaimQueue();
      return;
    }

    if (action.t === 'reset') {
      if (!this._isActiveHostId(fromId)) return;
      clearTimeout(this.claimTimeout);
      state.pendingBoardRecovery = null;
      recordMarathonWatch(state);
      const safe = sanitizeGenreSelection(action.genres, action.subgenreSelections);
      state.genres = safe.genres;
      state.subgenreSelections = safe.subgenreSelections;
      if (typeof action.freeSpace === 'boolean') state.freeSpace = action.freeSpace;
      state.generalPercents = sanitizeGeneralPercents(state.genres, action.generalPercents);
      state.movie = action.movie || null;
      state.genrePercents = action.genrePercents || {};
      state.subgenrePercents = action.subgenrePercents || {};
      if (VALID_TOTAL_TROPES.has(action.totalTropes)) state.totalTropes = action.totalTropes;
      const safeCustomTropes = sanitizeCustomTropes(action.customTropes);
      state.tropePool = Array.from(
        new Set([
          ...pickTropePool(
            state.genres,
            state.subgenreSelections,
            state.generalPercents,
            state.totalTropes,
            state.genrePercents,
            state.subgenrePercents,
          ),
          ...safeCustomTropes,
        ]),
      );
      for (const p of Object.values(state.players)) {
        p.board = buildPlayerBoard(state.tropePool, state.freeSpace);
        p.wagered = [];
        p.marked = state.freeSpace ? [CENTER_INDEX] : [];
      }
      state.started = false;
      state.gameOver = false;
      state.pendingClaim = null;
      state.claimQueue = [];
      state.claimHistory = [];
      state.pendingJoinRequest = null;
      state.pendingProfileChanges = {};
      state.acceptedTropes = [];
      state.acceptedTropeProposers = {};
      state.acceptedCalls = {};
      state.calls = {};
      state.callStats = {};
      state.callHistory = {};
      state.superlativeStats = {};
      state.superlativeMilestones = {};
      state.bingoEvents = [];
      state.activityLog = [];
      this._logActivity(
        state.marathon?.watches.length > 0
          ? `🏁 Watch ${state.marathon.watches.length} was added to the marathon standings.`
          : '🔄 The host reset the game.',
      );
      this.onEvent({ type: 'gameReset' });
      this._send({ t: 'gameReset' });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'changeName') {
      const trimmed = typeof action.name === 'string' ? action.name.trim().slice(0, 20) : '';
      if (!trimmed) return;
      player.name = trimmed;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'changeAvatar') {
      if (typeof action.avatar !== 'string' || !AVATAR_OPTIONS.includes(action.avatar)) return;
      player.avatar = action.avatar;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'proposeProfileChange') {
      if (!this._isActiveHostId(fromId)) return;
      const target = state.players[action.targetId];
      const name = typeof action.name === 'string' ? action.name.trim().slice(0, 20) : '';
      if (!target || !target.connected || !name || !AVATAR_OPTIONS.includes(action.avatar)) return;
      state.pendingProfileChanges ||= {};
      state.pendingProfileChanges[target.id] = {
        name,
        avatar: action.avatar,
        proposedBy: player.name,
        proposedByAvatar: player.avatar,
      };
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'restoreDisconnectedBoard') {
      const sourceId = action.sourceId;
      const targetId = action.targetId;
      const source = state.players[sourceId];
      const target = state.players[targetId];
      if (
        (!this._isActiveHostId(fromId) && !(this._approvedBoardRecovery && this._isHostId(fromId))) ||
        !state.started ||
        state.gameOver ||
        state.pendingClaim ||
        state.pendingReplacement ||
        state.claimQueue?.length ||
        !source ||
        !target ||
        sourceId === targetId ||
        (!this._approvedBoardRecovery && source.connected) ||
        (!this._approvedBoardRecovery && this._pendingDisconnects.has(sourceId)) ||
        target.connected !== true ||
        this._isHostId(sourceId) ||
        state.pendingProfileChanges?.[sourceId] ||
        state.pendingProfileChanges?.[targetId]
      ) {
        return;
      }

      target.board = [...source.board];
      target.marked = [...source.marked];
      target.wagered = [...source.wagered];
      if (this._approvedBoardRecovery) {
        target.name = source.name;
        target.avatar = source.avatar;
      }

      state.calls ||= {};
      this._finishCall(targetId, 'changed');
      if (state.calls[sourceId]) state.calls[targetId] = state.calls[sourceId];
      else delete state.calls[targetId];
      delete state.calls[sourceId];
      state.callHistory ||= {};
      state.callHistory[targetId] = [...(state.callHistory[targetId] || []), ...(state.callHistory[sourceId] || [])];
      delete state.callHistory[sourceId];

      state.callStats ||= {};
      const oldCallStats = state.callStats[sourceId];
      const currentCallStats = state.callStats[targetId] || {};
      if (oldCallStats) {
        state.callStats[targetId] = {
          made: (currentCallStats.made || 0) + (oldCallStats.made || 0),
          correct: (currentCallStats.correct || 0) + (oldCallStats.correct || 0),
        };
      }
      delete state.callStats[sourceId];

      state.superlativeStats ||= {};
      const oldStats = state.superlativeStats[sourceId];
      const currentStats = state.superlativeStats[targetId];
      if (oldStats) {
        const mergedStats = { ...oldStats, ...currentStats };
        for (const key of Object.keys(oldStats)) {
          if (key !== 'viewedTropes' && typeof oldStats[key] === 'number') {
            mergedStats[key] = (oldStats[key] || 0) + (currentStats?.[key] || 0);
          }
        }
        mergedStats.viewedTropes = [
          ...new Set([...(oldStats.viewedTropes || []), ...(currentStats?.viewedTropes || [])]),
        ];
        state.superlativeStats[targetId] = mergedStats;
      }
      delete state.superlativeStats[sourceId];

      state.superlativeMilestones ||= {};
      if (state.superlativeMilestones[sourceId]) {
        state.superlativeMilestones[targetId] = {
          ...state.superlativeMilestones[sourceId],
          ...state.superlativeMilestones[targetId],
        };
      }
      delete state.superlativeMilestones[sourceId];

      for (const proposers of Object.values(state.acceptedTropeProposers || {})) {
        for (let index = 0; index < proposers.length; index++) {
          if (proposers[index] === sourceId) proposers[index] = targetId;
        }
      }
      for (const callers of Object.values(state.acceptedCalls || {})) {
        const oldCaller = callers.find((caller) => caller.id === sourceId);
        if (oldCaller && !callers.some((caller) => caller.id === targetId)) {
          callers.push({ ...oldCaller, id: targetId, name: target.name, avatar: target.avatar });
        }
        for (let index = callers.length - 1; index >= 0; index--) {
          if (callers[index].id === sourceId) callers.splice(index, 1);
        }
      }
      for (const event of state.bingoEvents || []) {
        if (event.playerId === sourceId) event.playerId = targetId;
      }
      for (const entry of state.claimHistory || []) {
        entry.proposerIds = (entry.proposerIds || []).map((id) => (id === sourceId ? targetId : id));
        entry.proposerIds = [...new Set(entry.proposerIds)];
        for (const proposer of entry.proposers || []) {
          if (proposer.id === sourceId)
            Object.assign(proposer, { id: targetId, name: target.name, avatar: target.avatar });
        }
        for (const context of entry.sceneContexts || []) {
          if (context.playerId === sourceId) context.playerId = targetId;
        }
      }

      delete state.players[sourceId];
      clearTimeout(this._pendingDisconnects.get(sourceId));
      this._pendingDisconnects.delete(sourceId);
      state.seatOrder = state.seatOrder.filter((id) => id !== sourceId);
      this._logActivity(`🔄 ${formatPlayerName(target)} recovered the player seat from ${formatPlayerName(source)}.`);
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'respondToProfileChange') {
      const proposal = state.pendingProfileChanges?.[fromId];
      if (!proposal || !player) return;
      if (action.accept) {
        player.name = proposal.name;
        player.avatar = proposal.avatar;
      }
      delete state.pendingProfileChanges[fromId];
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'proposeCustom') {
      if (state.gameOver) return;
      if (typeof action.text !== 'string') return;
      const trimmed = action.text.trim().slice(0, MAX_CUSTOM_TROPE_LENGTH);
      if (!trimmed || trimmed === FREE_SPACE_TEXT || state.tropePool.includes(trimmed)) return;
      this._submitTropeProposal(fromId, trimmed, 'mark', { custom: true }, action.sceneContext);
      return;
    }

    if (action.t === 'proposeReplace') {
      if (state.gameOver) return;
      if (
        typeof action.text !== 'string' ||
        action.text === FREE_SPACE_TEXT ||
        state.acceptedTropes.includes(action.text) ||
        !state.tropePool.includes(action.text)
      )
        return;
      const safeGenre = VALID_GENRES.has(action.genre) ? action.genre : state.genres[0];
      const safeSubgenre = isValidSubgenre(safeGenre, action.subgenre) ? action.subgenre : 'general';
      this._submitTropeProposal(
        fromId,
        action.text,
        'replace',
        { genre: safeGenre, subgenre: safeSubgenre },
        action.sceneContext,
      );
      return;
    }

    if (action.t === 'chooseReplacement' || action.t === 'cycleReplacement' || action.t === 'cancelReplacement') {
      const replacement = state.pendingReplacement;
      if (!replacement || replacement.byId !== fromId) return;
      if (action.t === 'cancelReplacement') {
        state.pendingReplacement = null;
        this._logActivity(`🔁 ${formatPlayerName(player)} cancelled the replacement for "${replacement.oldText}".`);
      } else if (action.t === 'cycleReplacement') {
        replacement.index = (replacement.index + 1) % replacement.candidates.length;
      } else {
        if (!replacement.candidates.includes(action.text)) return;
        const wagerFreedIds = this._applyReplacement(replacement, action.text);
        state.pendingReplacement = null;
        this._send({ t: 'replacementResolved', wagerFreedIds });
      }
      this._emitState();
      this._send({ t: 'state', state: this.state });
      if (!state.pendingReplacement) this._drainClaimQueue();
      return;
    }

    if (action.t === 'proposeAccept') {
      if (state.gameOver) return;
      if (typeof action.text !== 'string' || !state.tropePool.includes(action.text)) return;
      if (state.acceptedTropes.includes(action.text)) return;
      this._submitTropeProposal(fromId, action.text, 'mark', {}, action.sceneContext);
      return;
    }

    if (action.t === 'updateSessionLifetime') {
      if (!this._isActiveHostId(fromId)) return;
      const hours = isValidSessionLifetime(action.hours) ? action.hours : DEFAULT_SESSION_LIFETIME_HOURS;
      state.sessionExtended = hours !== DEFAULT_SESSION_LIFETIME_HOURS;
      state.sessionLifetimeHours = hours;
      state.sessionExpiresAt = Date.now() + state.sessionLifetimeHours * 60 * 60 * 1000;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      this.onEvent({
        type: 'sessionLifetimeUpdated',
        extended: state.sessionExtended,
        hours: state.sessionLifetimeHours,
      });
      return;
    }

    if (action.t === 'updateMovie') {
      if (!this._isActiveHostId(fromId)) return;
      const title = typeof action.movie?.title === 'string' ? action.movie.title.trim().slice(0, 120) : '';
      const themeSelection = sanitizeGenreSelection(action.movie?.genres, action.movie?.subgenreSelections);
      state.movie = title
        ? {
            title,
            year: action.movie.year || null,
            type: action.movie.type || null,
            poster: action.movie.poster || null,
            imdbID: action.movie.imdbID || null,
            director: action.movie.director || null,
            actors: action.movie.actors || null,
            genres: Array.isArray(action.movie.genres) ? action.movie.genres : [],
            unmapped: Array.isArray(action.movie.unmapped) ? action.movie.unmapped : [],
            subgenreSelections: Array.isArray(action.movie.subgenreSelections) ? themeSelection.subgenreSelections : [],
            themeGenres: Array.isArray(action.movie?.genres) ? themeSelection.genres : null,
            themeSubgenreSelections: Array.isArray(action.movie?.subgenreSelections)
              ? themeSelection.subgenreSelections
              : null,
          }
        : null;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'gameOver') {
      if (!this._isActiveHostId(fromId)) return;
      state.pendingBoardRecovery = null;
      if (!state.started || state.gameOver || state.pendingClaim) return;
      state.gameOver = true;
      state.claimQueue = [];
      this._logActivity('🏁 The game has ended.');
      this._send({ t: 'gameOverAnnounced' });
      GameClient.clearSavedSession();
      this.onEvent({ type: 'gameOver' });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'resumeGame') {
      if (!this._isActiveHostId(fromId)) return;
      if (!state.started || !state.gameOver || state.pendingClaim) return;
      state.gameOver = false;
      this._logActivity('▶️ The game was resumed for extra tropes.');
      this._send({ t: 'gameResumed' });
      this._saveCurrentSession();
      this.onEvent({ type: 'gameResumed' });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'addHost') {
      if (!this._isActiveHostId(fromId)) return;
      const targetId = action.targetId;
      if (!state.players[targetId]?.connected || this._isHostId(targetId)) return;
      state.hostIds = [...this._hostIds(), targetId];
      this._logActivity(`👑 ${formatPlayerName(state.players[targetId])} is now a host.`);
      this._send({ t: 'hostAdded', to: targetId, byName: player.name, byAvatar: player.avatar });
      this._emitState();
      return this._send({ t: 'state', state: this.state });
    }

    if (action.t === 'resignHost') {
      if (!this._isHostId(fromId) || this._hostIds().length < 2) return;
      state.hostIds = this._hostIds().filter((id) => id !== fromId);
      this._logActivity(`👑 ${formatPlayerName(state.players[fromId])} resigned as host.`);
      this._emitState();
      return this._send({ t: 'state', state: this.state });
    }

    if (action.t === 'kick') {
      if (!this._isActiveHostId(fromId)) return;
      const targetId = action.targetId;
      if (targetId === fromId || !state.players[targetId]) return;
      const removedName = formatPlayerName(state.players[targetId]);
      delete state.players[targetId];
      state.seatOrder = state.seatOrder.filter((id) => id !== targetId);
      state.hostIds = this._hostIds().filter((id) => id !== targetId);
      delete state.pendingProfileChanges?.[targetId];
      if (state.pendingClaim && state.pendingClaim.byId === targetId) {
        clearTimeout(this.claimTimeout);
        state.pendingClaim = null;
      }
      this._rotateCode(`🚪 ${removedName} was removed from the game.`);
      return;
    }

    if (action.t === 'approveJoin') {
      if (!this._isActiveHostId(fromId)) return;
      const req = state.pendingJoinRequest;
      if (!req) return;
      const board = buildPlayerBoard(state.tropePool, state.freeSpace);
      const marked = state.freeSpace ? [CENTER_INDEX] : [];
      markAlreadyAcceptedTropes(board, marked, state.acceptedTropes);
      const seat = state.seatOrder.length;
      state.players[req.id] = {
        id: req.id,
        name: req.name,
        seat,
        connected: true,
        avatar: req.avatar || randomAvatar(Object.values(state.players).map((p) => p.avatar)),
        board,
        wagered: [],
        marked,
      };
      state.seatOrder.push(req.id);
      state.pendingJoinRequest = null;
      this._logActivity(`🙋 ${formatPlayerName(state.players[req.id])} joined mid-game.`);
      this._send({ t: 'welcome', to: req.id, state });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'denyJoin') {
      if (!this._isActiveHostId(fromId)) return;
      const req = state.pendingJoinRequest;
      if (!req) return;
      state.pendingJoinRequest = null;
      this._send({ t: 'joinRejected', to: req.id, reason: 'denied' });
      if (action.rotateCode) {
        this._rotateCode(`🔒 The game code was rotated after denying ${formatPlayerName(req)}.`);
      } else {
        this._emitState();
        this._send({ t: 'state', state: this.state });
      }
      return;
    }
  }

  // Generates a new game code, rotates the channel every connected client is
  // on (including this one), and broadcasts the migration -- shared by kick
  // and "deny + rotate code" so a leaked/compromised code stops working.
  _rotateCode(activityText) {
    const state = this.state;
    const newCode = randomCode();
    state.code = newCode;
    if (activityText) this._logActivity(activityText);
    const migration = this._send({ t: 'migrate', newCode, state });
    this._emitState();
    this.onEvent({ type: 'codeChanged', code: newCode });
    migration.then((sent) => sent && this._migrateToCode(newCode).catch(() => {}));
  }

  _connectedCount() {
    return Object.values(this.state.players).filter((p) => p.connected).length;
  }

  _sceneContext(fromId, value) {
    const note = typeof value?.note === 'string' ? value.note.trim().slice(0, 240) : '';
    const timestamp = typeof value?.timestamp === 'string' ? value.timestamp.trim().slice(0, 16) : '';
    const validTime = /^(?:\d{1,2}:[0-5]\d|\d{1,3}):[0-5]\d$/.test(timestamp);
    return note || validTime ? { playerId: fromId, note, timestamp: validTime ? timestamp : '' } : null;
  }

  _submitTropeProposal(fromId, text, kind, meta = {}, context) {
    const scene = this._sceneContext(fromId, context);
    if (
      this.state.pendingClaim?.kind === 'mark' &&
      kind === 'mark' &&
      this.state.pendingClaim.text === text &&
      !!this.state.pendingClaim.custom === !!meta.custom
    ) {
      this._mergeDuplicateMarkProposal(fromId, text, scene);
      return;
    }
    if (!this.state.pendingClaim && !this.state.pendingReplacement && !(this.state.claimQueue || []).length) {
      this._startClaim(fromId, text, kind, { ...meta, sceneContexts: scene ? [scene] : [] });
      return;
    }
    this.state.claimQueue ||= [];
    const duplicate = this.state.claimQueue.find(
      (item) =>
        item.text === text &&
        item.kind === kind &&
        item.meta.genre === meta.genre &&
        item.meta.subgenre === meta.subgenre &&
        !!item.meta.custom === !!meta.custom,
    );
    if (duplicate) {
      if (!duplicate.proposedBy.includes(fromId)) {
        duplicate.proposedBy.push(fromId);
        if (scene) duplicate.sceneContexts.push(scene);
      }
    } else {
      if (
        this.state.claimQueue.length >= 30 ||
        this.state.claimQueue.filter((item) => item.proposedBy.includes(fromId)).length >= 5
      ) {
        const message =
          'The claim queue is full or you already have five waiting proposals. Withdraw one before adding another.';
        if (fromId === this.myId) this.onEvent({ type: 'proposalRejected', message });
        this._send({ t: 'proposalRejected', to: fromId, message });
        return;
      }
      this.state.claimQueue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        byId: fromId,
        proposedBy: [fromId],
        text,
        kind,
        meta,
        sceneContexts: scene ? [scene] : [],
      });
    }
    this._emitState();
    this._send({ t: 'state', state: this.state });
  }

  _drainClaimQueue() {
    const state = this.state;
    if (state.gameOver || state.pendingClaim || state.pendingReplacement) return;
    while (state.claimQueue?.length) {
      const eligibleIndex = state.claimQueue.findIndex((item) =>
        item.proposedBy.some((id) => state.players[id]?.connected),
      );
      if (eligibleIndex === -1) break;
      const [entry] = state.claimQueue.splice(eligibleIndex, 1);
      const proposers = entry.proposedBy.filter((id) => state.players[id]?.connected);
      if (!proposers.length) continue;
      const accepted = state.acceptedTropes.includes(entry.text);
      if ((entry.kind === 'unmark' && !accepted) || (entry.kind !== 'unmark' && accepted)) continue;
      if (!entry.meta.custom && !state.tropePool.includes(entry.text)) continue;
      for (const id of proposers.slice(1)) this._superlativeStats(id).submissions += 1;
      this._startClaim(proposers[0], entry.text, entry.kind, {
        ...entry.meta,
        proposedBy: proposers,
        sceneContexts: entry.sceneContexts.filter((context) => proposers.includes(context.playerId)),
      });
      return;
    }
    this._emitState();
    this._send({ t: 'state', state });
  }

  _startClaim(fromId, text, kind, meta = {}) {
    const state = this.state;
    if (['mark', 'unmark', 'replace'].includes(kind)) {
      if (
        !state.acceptedTropes.length &&
        Object.values(state.superlativeStats || {}).every((stats) => !stats.submissions)
      ) {
        this._recordSuperlativeMilestone('firstProposal', [fromId]);
      }
      this._superlativeStats(fromId).submissions += 1;
    }
    const createdAt = Date.now();
    const claimId = `${state.code}-${createdAt}-${Math.random().toString(36).slice(2, 6)}`;
    state.pendingClaim = {
      claimId,
      byId: fromId,
      text,
      kind,
      proposedBy: [fromId],
      ...meta,
      votes: Object.fromEntries((meta.proposedBy || [fromId]).map((id) => [id, true])),
      totalPlayers: this._connectedCount(),
      expiresAt: createdAt + CLAIM_TIMEOUT_MS,
      serverManaged: !!this._serverMode,
    };
    clearTimeout(this.claimTimeout);
    if (!this._serverMode) this.claimTimeout = setTimeout(() => this._resolveClaim(claimId), CLAIM_TIMEOUT_MS);
    if (this._maybeAutoResolve()) return;
    this._emitState();
    this._send({ t: 'state', state: this.state });
  }

  _mergeDuplicateMarkProposal(fromId, text, scene) {
    const pc = this.state.pendingClaim;
    if (!pc || pc.kind !== 'mark' || pc.text !== text || pc.byId === fromId || pc.votes[fromId] === false) return false;
    if (!Array.isArray(pc.proposedBy)) pc.proposedBy = [pc.byId];
    if (pc.proposedBy.includes(fromId)) return false;
    this._superlativeStats(fromId).submissions += 1;
    pc.proposedBy.push(fromId);
    if (scene) {
      pc.sceneContexts ||= [];
      pc.sceneContexts.push(scene);
    }
    pc.votes[fromId] = true;
    this._logActivity(`👥 ${formatPlayerName(this.state.players[fromId])} also proposed "${text}".`);
    if (this._maybeAutoResolve()) return true;
    this._emitState();
    this._send({ t: 'state', state: this.state });
    return true;
  }

  _majorityNeeded(total) {
    return Math.floor(total / 2) + 1;
  }

  _tally(pc) {
    let agree = 0;
    let disagree = 0;
    for (const v of Object.values(pc.votes)) {
      if (v) agree++;
      else disagree++;
    }
    return { agree, disagree };
  }

  _maybeAutoResolve() {
    const pc = this.state.pendingClaim;
    if (!pc) return false;
    const { agree, disagree } = this._tally(pc);
    const needed = this._majorityNeeded(pc.totalPlayers);
    const impossible = disagree > pc.totalPlayers - needed;
    const allVoted = Object.keys(pc.votes).length >= pc.totalPlayers;
    if (agree >= needed || impossible || allVoted) {
      this._resolveClaim(pc.claimId);
      return true;
    }
    return false;
  }

  _resolveClaim(claimId) {
    const pc = this.state.pendingClaim;
    if (!pc || pc.claimId !== claimId) return;
    if (pc.serverManaged && !this._serverMode) {
      return this._send({ t: 'action', from: this.myId, action: { t: 'settleClaim' } });
    }
    clearTimeout(this.claimTimeout);
    const { agree } = this._tally(pc);
    const needed = this._majorityNeeded(pc.totalPlayers);
    const approved = agree >= needed;
    const approvedBy = approvedPlayersFromVotes(this.state.players, pc.votes);
    const disagreeRationaleCounts = approved ? {} : pc.disagreeRationaleCounts || {};
    const approvedByText = approvalSentence(approvedBy);
    const wagerFreedIds = [];
    const missedCalls = [];
    const previousBingoLines = Object.fromEntries(
      Object.values(this.state.players).map((player) => [
        player.id,
        new Set(getCompletedLines(player.marked).map((line) => line.join(','))),
      ]),
    );

    if (approved) {
      if (pc.kind === 'replace') {
        const affected = Object.values(this.state.players).filter((p) => p.board.includes(pc.text));
        const eligible = getEligibleTropeTexts(pc.genre, pc.subgenre);
        const candidates = eligible.filter(
          (text) => text !== pc.text && text !== FREE_SPACE_TEXT && !affected.some((p) => p.board.includes(text)),
        );
        if (candidates.length > 0) {
          this.state.pendingReplacement = {
            replacementId: `${pc.claimId}-replacement`,
            byId: pc.byId,
            oldText: pc.text,
            genre: pc.genre,
            subgenre: pc.subgenre,
            candidates: shuffled(candidates),
            index: 0,
            affectedIds: affected.map((p) => p.id),
          };
          this._logActivity(`🔁 "${pc.text}" was approved for replacement.${approvedByText}`);
        } else {
          this._logActivity(
            `🔁 "${pc.text}" was approved to be swapped out, but no replacement was available.${approvedByText}`,
          );
        }
      } else if (pc.kind === 'wagerChange') {
        const proposer = this.state.players[pc.byId];
        if (proposer) {
          proposer.wagered = proposer.wagered.filter((idx) => !pc.remove.includes(idx));
          for (const idx of pc.add) {
            if (proposer.wagered.length >= 5) break;
            if (proposer.wagered.includes(idx) || proposer.marked.includes(idx)) continue;
            proposer.wagered.push(idx);
          }
          this._logActivity(`🎯 ${formatPlayerName(proposer)} updated their wagers.${approvedByText}`);
        }
      } else if (pc.kind === 'reroll') {
        const proposer = this.state.players[pc.byId];
        if (proposer) {
          proposer.board = buildPlayerBoard(this.state.tropePool, this.state.freeSpace);
          proposer.marked = this.state.freeSpace ? [CENTER_INDEX] : [];
          markAlreadyAcceptedTropes(proposer.board, proposer.marked, this.state.acceptedTropes);
          // Wagers point at board positions that no longer mean anything, so
          // they're cleared and can be re-placed via the usual wager proposal.
          if (proposer.wagered.length > 0) wagerFreedIds.push(proposer.id);
          proposer.wagered = [];
          this._logActivity(`🔀 ${formatPlayerName(proposer)} was dealt a fresh board.${approvedByText}`);
        }
      } else {
        for (const p of Object.values(this.state.players)) {
          const idx = p.board.indexOf(pc.text);
          if (idx === -1) continue;
          if (pc.kind === 'unmark') {
            const pos = p.marked.indexOf(idx);
            if (pos !== -1) p.marked.splice(pos, 1);
          } else if (!p.marked.includes(idx)) {
            p.marked.push(idx);
          }
        }
        if (pc.kind === 'unmark') {
          this.state.acceptedTropes = this.state.acceptedTropes.filter((t) => t !== pc.text);
          delete this.state.acceptedTropeProposers?.[pc.text];
          delete this.state.acceptedCalls?.[pc.text];
          this._logActivity(`↩️ "${pc.text}" was unmarked.${approvedByText}`);
        } else {
          const newlyAccepted = !this.state.acceptedTropes.includes(pc.text);
          if (newlyAccepted) {
            this.state.acceptedTropes.push(pc.text);
            const proposerIds = pc.proposedBy || [pc.byId];
            this.state.acceptedTropeProposers ||= {};
            this.state.acceptedTropeProposers[pc.text] = [...proposerIds];
            for (const proposerId of proposerIds) {
              const stats = this._superlativeStats(proposerId);
              stats.acceptedProposals = (stats.acceptedProposals || 0) + 1;
              if (stats.rejections > 0) stats.acceptedAfterRejection += 1;
            }
            for (const voter of approvedBy) {
              const stats = this._superlativeStats(voter.id);
              stats.approvalVotes += 1;
              if (!proposerIds.includes(voter.id)) stats.otherApprovalVotes = (stats.otherApprovalVotes || 0) + 1;
            }
            for (const player of Object.values(this.state.players)) {
              const stats = this.state.superlativeStats?.[player.id];
              if (stats?.rejections > 0 && player.board.includes(pc.text)) stats.marksAfterRejection += 1;
            }
            if (this.state.acceptedTropes.length === 1) this._recordSuperlativeMilestone('firstAccepted', proposerIds);
            const wagerHits = Object.values(this.state.players).filter((player) =>
              player.wagered.includes(player.board.indexOf(pc.text)),
            );
            this._recordSuperlativeMilestone(
              'firstWagerHit',
              wagerHits.map((player) => player.id),
            );
          }
          if (pc.custom) {
            if (!this.state.tropePool.includes(pc.text)) this.state.tropePool.push(pc.text);
            this._logActivity(`📝 "${pc.text}" was added as a new custom trope.${approvedByText}`);
          } else {
            this._logActivity(`✅ "${pc.text}" was marked as happened.${approvedByText}`);
          }
          for (const [playerId, calledText] of Object.entries(this.state.calls || {})) {
            if (calledText !== pc.text) {
              if (newlyAccepted) missedCalls.push({ playerId, text: calledText });
              continue;
            }
            this._finishCall(playerId, 'scored');
            this.state.callStats ||= {};
            this.state.callStats[playerId] = {
              ...this.state.callStats[playerId],
              correct: (this.state.callStats[playerId]?.correct || 0) + 1,
            };
            this.state.acceptedCalls ||= {};
            this.state.acceptedCalls[pc.text] ||= [];
            const caller = this.state.players[playerId];
            if (!this.state.acceptedCalls[pc.text].some((entry) => entry.id === playerId)) {
              this.state.acceptedCalls[pc.text].push({
                id: playerId,
                name: caller?.name || 'Unknown player',
                avatar: caller?.avatar || '👤',
              });
            }
            delete this.state.calls[playerId];
          }
          this._recordBingoEvents(previousBingoLines, pc.claimId);
        }
      }
    } else if (['mark', 'unmark', 'replace'].includes(pc.kind)) {
      for (const id of pc.proposedBy || [pc.byId]) this._superlativeStats(id).rejections += 1;
      const proposers = (pc.proposedBy || [pc.byId]).map((id) => formatPlayerName(this.state.players[id]));
      const proposal =
        pc.kind === 'replace'
          ? `replacing "${pc.text}"`
          : pc.kind === 'unmark'
            ? `unmarking "${pc.text}"`
            : pc.custom
              ? `adding "${pc.text}" as a custom trope`
              : `"${pc.text}" as happened`;
      const reasons = Object.entries(disagreeRationaleCounts).map(([reason, count]) => `${reason} (${count})`);
      const reasonText = reasons.length ? ` Reasons: ${reasons.join(', ')}.` : ' No decline reasons were provided.';
      this._logActivity(
        `❌ ${formatNameList(proposers)} proposed ${proposal}, but it did not reach majority approval.${reasonText}`,
      );
    }

    this.state.pendingClaim = null;
    this.state.claimHistory ||= [];
    this.state.claimHistory.push({
      id: pc.claimId,
      text: pc.text,
      kind: pc.kind,
      approved,
      proposerIds: pc.proposedBy || [pc.byId],
      proposers: (pc.proposedBy || [pc.byId]).map((id) => ({
        id,
        name: this.state.players[id]?.name || 'Unknown player',
        avatar: this.state.players[id]?.avatar || '👤',
      })),
      sceneContexts: pc.sceneContexts || [],
      reasons: disagreeRationaleCounts,
      ts: Date.now(),
    });
    this.state.claimHistory = this.state.claimHistory.slice(-100);
    const sceneText = (pc.sceneContexts || [])
      .map((context) => [context.timestamp, context.note].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join(' | ');
    if (sceneText && this.state.activityLog?.length) this.state.activityLog.at(-1).text += ` Scene: ${sceneText}`;
    const payload = {
      text: pc.text,
      kind: pc.kind,
      custom: !!pc.custom,
      byId: pc.byId,
      approved,
      approvedBy,
      disagreeRationaleCounts,
      wagerFreedIds,
      missedCalls,
      proposedBy: pc.proposedBy || [pc.byId],
    };
    this.onEvent({ type: 'claimResolved', ...payload, wagerFreed: wagerFreedIds.includes(this.myId) });
    this._send({ t: 'resolved', ...payload });
    this._emitState();
    this._send({ t: 'state', state: this.state });
    this._drainClaimQueue();
  }

  _completeBoardRecovery() {
    const state = this.state;
    const recovery = state?.pendingBoardRecovery;
    if (!recovery || recovery.expiresAt > Date.now()) return;
    state.pendingBoardRecovery = null;
    const source = state.players[recovery.sourceId];
    const target = state.players[recovery.targetId];
    if (
      !source ||
      !target?.connected ||
      !this._isHostId(recovery.byId) ||
      this._isHostId(source.id) ||
      state.gameOver ||
      !state.started ||
      state.pendingClaim ||
      state.pendingReplacement ||
      state.claimQueue?.length ||
      state.pendingProfileChanges?.[source.id] ||
      state.pendingProfileChanges?.[target.id]
    ) {
      this._logActivity('Player recovery cancelled because a required seat or host is no longer available.');
      this._emitState();
      this._send({ t: 'state', state });
      return;
    }
    for (const key of ['calls', 'callStats', 'callHistory', 'superlativeStats', 'superlativeMilestones']) {
      if (state[key]) delete state[key][target.id];
    }
    for (const callers of Object.values(state.acceptedCalls || {})) {
      for (let index = callers.length - 1; index >= 0; index--) {
        if (callers[index].id === target.id) callers.splice(index, 1);
      }
    }
    for (const proposers of Object.values(state.acceptedTropeProposers || {})) {
      for (let index = proposers.length - 1; index >= 0; index--) {
        if (proposers[index] === target.id) proposers.splice(index, 1);
      }
    }
    state.bingoEvents = (state.bingoEvents || []).filter((event) => event.playerId !== target.id);
    for (const watch of state.marathon?.watches || []) {
      watch.players = watch.players
        .filter((player) => player.id !== target.id)
        .map((player) => (player.id === source.id ? { ...player, id: target.id } : player));
    }
    state.lastBoardRecovery = { id: recovery.id, sourceId: source.id, targetId: target.id };
    this._approvedBoardRecovery = true;
    try {
      this._applyAction(recovery.byId, { t: 'restoreDisconnectedBoard', targetId: target.id, sourceId: source.id });
    } finally {
      this._approvedBoardRecovery = false;
    }
  }

  _finishCall(playerId, status) {
    const text = this.state.calls?.[playerId];
    if (!text) return;
    this.state.callHistory ||= {};
    const history = (this.state.callHistory[playerId] ||= []);
    const entry = history.findLast((call) => call.status === 'active' && call.text === text);
    if (entry) entry.status = status;
    else history.push({ id: `${playerId}-${Date.now()}-legacy`, text, status });
  }

  _applyReplacement(replacement, newText) {
    const affected = Object.values(this.state.players).filter((p) => replacement.affectedIds.includes(p.id));
    const wagerFreedIds = [];
    for (const p of affected) {
      const idx = p.board.indexOf(replacement.oldText);
      if (idx === -1) continue;
      if (p.wagered.includes(idx)) wagerFreedIds.push(p.id);
      p.board[idx] = newText;
      p.wagered = p.wagered.filter((i) => i !== idx);
      p.marked = p.marked.filter((i) => i !== idx);
      if (this.state.acceptedTropes.includes(newText)) p.marked.push(idx);
    }
    for (const [playerId, calledText] of Object.entries(this.state.calls || {})) {
      if (calledText === replacement.oldText) {
        this._finishCall(playerId, 'replaced');
        delete this.state.calls[playerId];
      }
    }
    if (!this.state.tropePool.includes(newText)) this.state.tropePool.push(newText);
    this.state.acceptedTropes = this.state.acceptedTropes.filter((text) => text !== replacement.oldText);
    delete this.state.acceptedTropeProposers?.[replacement.oldText];
    delete this.state.acceptedCalls?.[replacement.oldText];
    this._logActivity(`🔁 "${replacement.oldText}" was swapped out for "${newText}".`);
    return wagerFreedIds;
  }

  _recordBingoEvents(previousBingoLines, claimId) {
    if (!Array.isArray(this.state.bingoEvents)) this.state.bingoEvents = [];
    const firstBingo = this.state.bingoEvents.length === 0;
    const firstBingoIds = [];
    for (const player of Object.values(this.state.players)) {
      const lines = getCompletedLines(player.marked);
      const newlyCompleted = lines.filter((line) => !previousBingoLines[player.id]?.has(line.join(',')));
      if (firstBingo && newlyCompleted.length > 0) firstBingoIds.push(player.id);
      for (let index = 0; index < newlyCompleted.length; index++) {
        const count = lines.length - newlyCompleted.length + index + 1;
        this.state.bingoEvents.push({
          id: `${claimId}-${player.id}-${count}`,
          playerId: player.id,
          playerName: player.name,
          playerAvatar: player.avatar,
          count,
          claimId,
          newLines: newlyCompleted.length,
          totalLines: lines.length,
          ts: Date.now(),
        });
      }
    }
    if (firstBingo) this._recordSuperlativeMilestone('firstBingo', firstBingoIds);
    this.state.bingoEvents = this.state.bingoEvents.slice(-50);
  }
}
