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
import { recordAwardTransitions } from '../utils/superlatives.js';
import { RelayAuthority } from './relayAuthority.js';
import { ClaimLifecycle } from './claimLifecycle.js';
import { PlayerLifecycle } from './playerLifecycle.js';
import { PresenceLifecycle } from './presenceLifecycle.js';
import { RelayActionDispatcher } from './relayActionDispatcher.js';
import { RelayApi } from './relayApi.js';
import { RelayMessagePolicy } from './relayMessagePolicy.js';
import { RelayPublisher } from './relayPublisher.js';
import { RelayTransport } from './relayTransport.js';
import { RelayDeadlineLifecycle } from './relayDeadlineLifecycle.js';
import { RelayStateLifecycle } from './relayStateLifecycle.js';
import { RelayMessageHandler } from './relayMessageHandler.js';
import { RelayHeartbeatLifecycle } from './relayHeartbeatLifecycle.js';
import { RelayProgressLifecycle } from './relayProgressLifecycle.js';
import { RelayJoinLifecycle } from './relayJoinLifecycle.js';
import { RelayMembershipLifecycle } from './relayMembershipLifecycle.js';
import { PlayerStateLifecycle } from './playerStateLifecycle.js';
import { WatchLifecycle, recordMarathonWatch } from './watchLifecycle.js';
import { clearSavedSession, getSavedSession, getSavedSnapshot, saveSession, saveSnapshot } from './gameSessionStore.js';
import { applyServerGameAction as runServerGameAction } from './serverGameplay.js';
import { SERVER_GAMEPLAY_ACTIONS } from './gameplayActions.js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const CHANNEL_PREFIX = 'bingo-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CLAIM_TIMEOUT_MS = 20000;
const CONNECT_TIMEOUT_MS = 10000;
const JOIN_TIMEOUT_MS = 10000;
const RECOVERY_REQUEST_TIMEOUT_MS = 20000;
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
const MAX_TIMER_DELAY_MS = 2_000_000_000;
const MAX_CUSTOM_TROPES = 20;
const MAX_CUSTOM_TROPE_LENGTH = 60;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 60;
const MAX_TRACKED_MESSAGE_SENDERS = 128;
const ALLOWED_REACTIONS = new Set(['👏', '😂', '😱', '🔥', '❤️']);

function isValidSubgenre(genre, subgenre) {
  return (SUBGENRES_BY_GENRE[genre] || []).some((s) => s.id === subgenre);
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

function createClaimLifecycleContext(client) {
  return {
    getState: () => client.state,
    getPlayerId: () => client.myId,
    isServerMode: () => !!client._serverMode,
    claimTimeoutMs: CLAIM_TIMEOUT_MS,
    maxWagers: 5,
    maxCustomTropeLength: MAX_CUSTOM_TROPE_LENGTH,
    connectedCount: () => client._connectedCount(),
    getCompletedLines,
    isActiveHostId: (playerId) => client._isActiveHostId(playerId),
    isHostId: (playerId) => client._isHostId(playerId),
    isValidGenre: (genre) => VALID_GENRES.has(genre),
    isValidSubgenre,
    isValidDisagreeRationale,
    hasPendingDisconnect: (playerId) => client._pendingDisconnects.has(playerId),
    clearPendingDisconnect: (playerId) => {
      clearTimeout(client._pendingDisconnects.get(playerId));
      client._pendingDisconnects.delete(playerId);
    },
    centerIndex: CENTER_INDEX,
    buildPlayerBoard,
    markAlreadyAcceptedTropes,
    freeSpaceText: FREE_SPACE_TEXT,
    getEligibleTropeTexts,
    shuffle: shuffled,
    superlativeStats: (playerId) => client._superlativeStats(playerId),
    recordSuperlativeMilestone: (kind, playerIds) => client._recordSuperlativeMilestone(kind, playerIds),
    logActivity: (text) => client._logActivity(text),
    clearClaimTimeout: () => clearTimeout(client.claimTimeout),
    emitState: () => client._emitState(),
    send: (message) => client._send(message),
    drainQueue: () => client._drainClaimQueue(),
    onEvent: (event) => client.onEvent(event),
    resolveClaim: (claimId) => client._resolveClaim(claimId),
    formatPlayerName,
    scheduleClaimTimeout: (claimId) => {
      clearTimeout(client.claimTimeout);
      if (!client._serverMode) client.claimTimeout = setTimeout(() => client._resolveClaim(claimId), CLAIM_TIMEOUT_MS);
    },
  };
}

function createClaimLifecycle(client) {
  client.claimLifecycle = new ClaimLifecycle(createClaimLifecycleContext(client));
  return client.claimLifecycle;
}

function createWatchLifecycleContext(client) {
  return {
    getState: () => client.state,
    isActiveHostId: (playerId) => client._isActiveHostId(playerId),
    defaultSessionLifetimeHours: DEFAULT_SESSION_LIFETIME_HOURS,
    validateSessionLifetime: (hours) => SESSION_LIFETIME_OPTIONS.some((option) => option.hours === hours),
    validateTotalTropes: (value, current) => (VALID_TOTAL_TROPES.has(value) ? value : current),
    sanitizeGenreSelection,
    sanitizeGeneralPercents,
    sanitizeCustomTropes,
    pickTropePool,
    buildPlayerBoard,
    markAlreadyAcceptedTropes,
    centerIndex: CENTER_INDEX,
    recordMarathonWatch,
    clearClaimTimeout: () => clearTimeout(client.claimTimeout),
    clearSavedSession: () => GameClient.clearSavedSession(),
    saveCurrentSession: () => client._saveCurrentSession(),
    logActivity: (text) => client._logActivity(text),
    emitState: () => client._emitState(),
    send: (message) => client._send(message),
    onEvent: (event) => client.onEvent(event),
  };
}

function createWatchLifecycle(client) {
  client.watchLifecycle = new WatchLifecycle(createWatchLifecycleContext(client));
  return client.watchLifecycle;
}

function createPlayerLifecycleContext(client) {
  return {
    getState: () => client.state,
    isActiveHostId: (playerId) => client._isActiveHostId(playerId),
    isHostId: (playerId) => client._isHostId(playerId),
    getHostIds: () => client._hostIds(),
    avatars: AVATAR_OPTIONS,
    formatPlayerName,
    logActivity: (text) => client._logActivity(text),
    emitState: () => client._emitState(),
    send: (message) => client._send(message),
  };
}

function createPlayerLifecycle(client) {
  client.playerLifecycle = new PlayerLifecycle(createPlayerLifecycleContext(client));
  return client.playerLifecycle;
}

function createPlayerStateLifecycle(client) {
  client.playerStateLifecycle = new PlayerStateLifecycle(client, { centerIndex: CENTER_INDEX, maxWagers: 5 });
  return client.playerStateLifecycle;
}

function createProgressLifecycle(client) {
  client.progressLifecycle = new RelayProgressLifecycle(client, { activityLogLimit: 30 });
  return client.progressLifecycle;
}

export class GameClient {
  constructor({ onState, onEvent } = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).');
    }
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.relayApi = new RelayApi(
      () => this.supabase,
      (enabled) => {
        this._serverGameplayEnabled = enabled;
      },
    );
    this.joinLifecycle = new RelayJoinLifecycle(this, {
      joinTimeoutMs: JOIN_TIMEOUT_MS,
      recoveryRequestTimeoutMs: RECOVERY_REQUEST_TIMEOUT_MS,
      isValidReplicatedState,
      sanitizeGenreSelection,
      sanitizeGeneralPercents,
      sanitizeCustomTropes,
      isValidTotalTropes: (value) => VALID_TOTAL_TROPES.has(value),
      defaultTotalTropes: DEFAULT_TOTAL_TROPES,
      randomCode,
      getSavedSession: () => GameClient.getSavedSession(),
      clearSavedSession: () => GameClient.clearSavedSession(),
    });
    this.heartbeatLifecycle = new RelayHeartbeatLifecycle(this, {
      intervalMs: HOST_HEARTBEAT_INTERVAL_MS,
      isValidReplicatedState,
    });
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
    this._publishQueue = Promise.resolve();
    this._actionQueue = Promise.resolve();
    this._serverGameplayEnabled = false;
    this._statePublishGeneration = 0;
    this._hostHeartbeatTimer = null;
    this.authority = new RelayAuthority(this);
    this.actionDispatcher = new RelayActionDispatcher(this, { serverGameplayActions: SERVER_GAMEPLAY_ACTIONS });
    this.presenceLifecycle = new PresenceLifecycle(this, {
      disconnectGraceMs: DISCONNECT_GRACE_MS,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      isValidPlayerId,
    });
    this.messagePolicy = new RelayMessagePolicy(this, {
      messageRateWindowMs: MESSAGE_RATE_WINDOW_MS,
      maxMessagesPerWindow: MAX_MESSAGES_PER_WINDOW,
      maxTrackedMessageSenders: MAX_TRACKED_MESSAGE_SENDERS,
    });
    this.publisher = new RelayPublisher(this, { isValidReplicatedState });
    this.deadlineLifecycle = new RelayDeadlineLifecycle(this, {
      maxTimerDelayMs: MAX_TIMER_DELAY_MS,
      clearSavedSession: () => GameClient.clearSavedSession(),
    });
    this.stateLifecycle = new RelayStateLifecycle(this, {
      recordAwardTransitions,
      getSavedSession: () => GameClient.getSavedSession(),
      clearSavedSession: () => GameClient.clearSavedSession(),
    });
    this.messageHandler = new RelayMessageHandler(this, {
      isValidPlayerId,
      isValidReplicatedState,
      allowedReactions: ALLOWED_REACTIONS,
      clearSavedSession: () => GameClient.clearSavedSession(),
    });
    this.membershipLifecycle = new RelayMembershipLifecycle(this, {
      isValidPlayerId,
      pickTropePool,
      buildPlayerBoard,
      centerIndex: CENTER_INDEX,
      defaultSessionLifetimeHours: DEFAULT_SESSION_LIFETIME_HOURS,
      randomAvatar,
      randomCode,
      markAlreadyAcceptedTropes,
      formatPlayerName,
    });
    this.transportLifecycle = new RelayTransport(this, {
      channelPrefix: CHANNEL_PREFIX,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      recoveryRequestTimeoutMs: RECOVERY_REQUEST_TIMEOUT_MS,
      reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
      reconnectMaxDelayMs: RECONNECT_MAX_DELAY_MS,
      isValidReplicatedState,
    });
    createClaimLifecycle(this);
    createWatchLifecycle(this);
    createPlayerLifecycle(this);
    createPlayerStateLifecycle(this);
    createProgressLifecycle(this);
    this._installLifecycleListeners();
  }

  async _ensureAuthenticated() {
    this.authUserId = await this.relayApi.ensureAuthenticated();
    return this.authUserId;
  }

  async _relayRequest(operation, values = {}, options = {}) {
    return this.relayApi.request(operation, values, options);
  }

  _syncHostHeartbeat() {
    return this.heartbeatLifecycle.sync();
  }

  async _heartbeat() {
    return this.heartbeatLifecycle.heartbeat();
  }

  // Returning to the tab or regaining network are the two moments when a
  // silently-dropped subscription is most likely, and also exactly when the
  // player expects to be back in the game -- so re-check the channel then
  // rather than making them refresh the page.
  _installLifecycleListeners() {
    this.transportLifecycle.installLifecycleListeners();
  }

  _removeLifecycleListeners() {
    this.transportLifecycle.removeLifecycleListeners();
  }

  destroy() {
    this._destroyed = true;
    if (this._pendingJoin?.awaitingApproval && this.code && this.myId) {
      this._relayRequest('cancel-join', { code: this.code, playerId: this.myId }).catch(() => {});
    }
    this._pendingJoin = null;
    clearTimeout(this.claimTimeout);
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._viewFlushTimer);
    clearTimeout(this._boardRecoveryTimer);
    clearTimeout(this._sessionExpiryTimer);
    clearInterval(this._hostHeartbeatTimer);
    this._reconnectTimer = null;
    this._hostHeartbeatTimer = null;
    this.presenceLifecycle.clearPendingDisconnects();
    this.messagePolicy.clear();
    this._removeLifecycleListeners();
    if (this.channel) this.supabase.removeChannel(this.channel);
  }

  // ---------- Session persistence (lets a disconnected player/host reconnect) ----------

  static getSavedSession() {
    return getSavedSession();
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
    return getSavedSnapshot(code);
  }

  static clearSavedSession() {
    clearSavedSession();
  }

  _saveSession(code, name) {
    const session = { code, myId: this.myId, name, avatar: this.state?.players?.[this.myId]?.avatar };
    saveSession(session);
  }

  _saveCurrentSession() {
    const me = this.state?.players?.[this.myId];
    if (this.code && me) this._saveSession(this.code, me.name);
  }

  _saveSnapshot() {
    if (!this.state || !this.code) return;
    saveSnapshot(this.code, this.state);
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
    return this.joinLifecycle.hostGame(
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
      hostRecoveryPassword,
    );
  }

  // Resolves to `{ needsChoice: false }` once fully joined, `{ needsChoice: true,
  // options, allowNew, name }` if the host finds disconnected seats on that
  // code (see claimDisconnectedSeat), or `{ needsApproval: true }` if the game
  // has already started and the host must approve this as a brand-new seat --
  // in that last case, listen for the 'joinApproved'/'joinDenied' events.
  async joinGame(code, name, hostRecoveryPassword = '') {
    return this.joinLifecycle.joinGame(code, name, hostRecoveryPassword);
  }

  async _watchJoinApproval(code, playerId, name) {
    return this.joinLifecycle.watchJoinApproval(code, playerId, name);
  }

  // Re-sends the join request on the same (already-connected) temp channel,
  // telling the host to skip the claim-offer and create a brand-new seat.
  // Used when the player picks "Join as a new player" from the choice modal.
  // Resolves to `{ needsApproval: true }` the same way joinGame() can, if the
  // game has already started.
  async confirmNewJoin(name) {
    return this.joinLifecycle.confirmNewJoin(name);
  }

  // Takes over an existing (disconnected) seat picked from the choice modal --
  // reconnects using that seat's id (same mechanism as rejoinGame) so its
  // board/wagers/marks are preserved, but with the freshly-entered name.
  async claimDisconnectedSeat(seatId, name) {
    return this.joinLifecycle.claimDisconnectedSeat(seatId, name);
  }

  // Reconnects using a previously-saved session (same player id), which lets a
  // disconnected host resume host authority once they reconnect (host authority
  // is always the lowest-seat *connected* player, so restoring `connected: true`
  // on the original host's seat automatically hands authority back to them).
  async rejoinGame() {
    return this.joinLifecycle.rejoinGame();
  }

  setWager(indices) {
    return this._dispatch({ t: 'setWager', indices });
  }

  // Proposes adding and/or removing wagers after the game has started (e.g. a
  // slot freed up via an approved 'replace', spaces never wagered pre-game,
  // or simply changing one's mind) -- unlike setWager, this requires majority
  // approval from the other players since it happens mid-game. All removals
  // and additions picked at once are submitted together as a single proposal.
  proposeWagerChange(add, remove) {
    return this._dispatch({ t: 'proposeWagerChange', add, remove });
  }

  // Asks the group to deal this player a brand new board (majority approval,
  // same as any other mid-game change).
  proposeBoardSwap() {
    return this._dispatch({ t: 'proposeBoardSwap' });
  }

  startGame() {
    this._dispatch({ t: 'start' });
  }

  claim(index, sceneContext) {
    return this._dispatch({ t: 'claim', index, sceneContext });
  }

  challengeTrope(text, sceneContext) {
    return this._dispatch({ t: 'challenge', text, sceneContext });
  }

  vote(claimId, agree, rationale) {
    this._dispatch({ t: 'vote', claimId, agree, rationale });
  }

  toggleCall(text) {
    this._dispatch({ t: 'toggleCall', text });
  }

  recordTropeView(text) {
    if (!this._serverGameplayEnabled) return this._dispatch({ t: 'recordTropeView', text });
    if (!this.state?.tropePool.includes(text)) return;
    this._pendingViews ||= [];
    if (this._pendingViews.length < 320) this._pendingViews.push(text);
    clearTimeout(this._viewFlushTimer);
    this._viewFlushTimer = setTimeout(() => this.flushTropeViews(), 300);
  }

  flushTropeViews() {
    return this._dispatch({ t: 'flushViews' });
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
    return this._dispatch({ t: 'proposeReplace', text, genre, subgenre, sceneContext });
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
    return this._dispatch({ t: 'proposeAccept', text, sceneContext });
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
    return this._dispatch({ t: 'proposeCustom', text, sceneContext });
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
    return this.transportLifecycle.connectChannel(code);
  }

  // Re-subscribes (with backoff) after the transport drops, then re-asserts our
  // seat so whoever currently holds authority clears our disconnected flag --
  // recovering without the player having to refresh and reconnect by hand.
  _scheduleReconnect() {
    return this.transportLifecycle.scheduleReconnect();
  }

  _reconnect() {
    return this.transportLifecycle.reconnect();
  }

  async _performReconnect() {
    return this.transportLifecycle.performReconnect();
  }

  // Checks the subscription is genuinely still live and repairs it if not.
  _checkConnection() {
    return this.transportLifecycle.checkConnection();
  }

  // Tells the rest of the table we're here, so a stale disconnected flag on our
  // own seat gets cleared by whoever holds authority.
  _announceSelf() {
    return this.transportLifecycle.announceSelf();
  }

  // Every message carries its sender so receivers can tell which client a
  // full-state broadcast came from (see _shouldAcceptState) and can treat any
  // traffic from a peer as proof that peer is still around. State broadcasts
  // also carry a revision that only ever moves forward, so returning clients
  // can tell a fresher snapshot from a staler one.
  _send(msg) {
    return this.publisher.send(msg);
  }

  // Transparently swaps the transport channel to a new code (used after a
  // kick rotates the code) without disrupting the caller's in-memory state --
  // no re-entered name/code, no visible screen change.
  async _migrateToCode(newCode) {
    return this.transportLifecycle.migrateToCode(newCode);
  }

  _dispatch(action) {
    return this.actionDispatcher.dispatch(action);
  }

  _dispatchConnected(action) {
    return this.actionDispatcher.dispatchConnected(action);
  }

  _flushQueuedActions() {
    return this.actionDispatcher.flushQueuedActions();
  }

  _currentHostId() {
    return this.authority.currentHostId();
  }

  _hostIds() {
    return this.authority.hostIds();
  }

  _isHostId(id) {
    return this.authority.isHostId(id);
  }

  _isActiveHostId(id) {
    return this.authority.isActiveHostId(id);
  }

  // The lowest-seat connected player, optionally ignoring one seat. Excluding a
  // seat answers "who should act for the table while that player is away",
  // which is how a rejoin request from the host itself still gets answered.
  _authorityId(excludeId = null) {
    return this.authority.authorityId(excludeId);
  }

  _emitState() {
    return this.stateLifecycle.emit();
  }

  _scheduleSessionExpiry() {
    return this.deadlineLifecycle.scheduleSessionExpiry();
  }

  // Presence "leave" fires the instant a phone backgrounds, so hold the seat
  // open for a grace period -- any traffic from that peer in the meantime
  // cancels the pending disconnect entirely.
  _onPeerLeft(peerId) {
    return this.presenceLifecycle.onPeerLeft(peerId);
  }

  _isPresent(peerId) {
    return this.presenceLifecycle.isPresent(peerId);
  }

  // Any message from a peer proves they're still here, so cancel a pending
  // disconnect and undo a stale one.
  _notePeerAlive(peerId) {
    return this.presenceLifecycle.notePeerAlive(peerId);
  }

  _markDisconnected(peerId) {
    return this.presenceLifecycle.markDisconnected(peerId);
  }

  // Decides whether an incoming full-state broadcast should replace ours. A
  // strictly fresher revision always wins, so a client returning with a stale
  // snapshot can't roll the table back. Otherwise only a client with a
  // stronger claim to authority (a lower seat) can, and anyone else gets our
  // state re-asserted at a higher revision -- which is what settles two
  // clients briefly both believing they're host after a flaky reconnect.
  _shouldAcceptState(data) {
    return this.messagePolicy.shouldAcceptState(data);
  }

  // Our own seat must never read as disconnected while we're plainly here --
  // repair it immediately rather than leaving the player mislabeled (which
  // previously desynced host authority until they refreshed).
  _ensureSeatConnected() {
    return this.presenceLifecycle.ensureSeatConnected();
  }

  // ---------- Message handling ----------

  _allowIncomingMessage(sender) {
    return this.messagePolicy.allowIncomingMessage(sender);
  }

  _onMessage(data) {
    return this.messageHandler.handle(data);
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
    return this.membershipLifecycle.initHostState(
      code,
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
    );
  }

  // Appends a short activity-feed entry (capped to the most recent 30) --
  // part of replicated state so every client sees the identical feed.
  _logActivity(text) {
    return this.progressLifecycle.logActivity(text);
  }

  _superlativeStats(playerId) {
    return this.progressLifecycle.superlativeStats(playerId);
  }

  _recordSuperlativeMilestone(kind, playerIds) {
    return this.progressLifecycle.recordSuperlativeMilestone(kind, playerIds);
  }

  _handleJoin(newId, name, forceNew) {
    return this.membershipLifecycle.handleJoin(newId, name, forceNew);
  }

  // Restores an existing (already-seated) player's connected flag instead of
  // creating a new seat -- unlike _handleJoin this is allowed even mid-game,
  // since it's how a disconnected host/player resumes their same seat (and,
  // for the original host, automatically regains host authority).
  _handleRejoin(id, name) {
    return this.membershipLifecycle.handleRejoin(id, name);
  }

  _applyAction(fromId, action) {
    const state = this.state;
    const player = Object.hasOwn(state.players, fromId) ? state.players[fromId] : null;
    if (!player || typeof player !== 'object' || !action || typeof action !== 'object') return;
    if (this.claimLifecycle.rejectActionDuringRecovery(fromId, action)) return;

    if (action.t === 'requestBoardRecovery') {
      this.claimLifecycle.requestBoardRecovery(fromId, action.sourceId, action.targetId, action.timeoutSeconds);
      return;
    }

    if (action.t === 'respondToBoardRecovery') {
      this.claimLifecycle.respondToBoardRecovery(fromId, action.requestId);
      return;
    }

    if (action.t === 'cancelBoardRecovery') {
      this.claimLifecycle.cancelBoardRecovery(fromId, action.requestId);
      return;
    }

    if (this.claimLifecycle.handleAction(fromId, action, player)) return;
    if (this.playerLifecycle.handleAction(fromId, action, player)) return;
    if (this.membershipLifecycle?.handleHostAction(fromId, action)) return;
    if (this.playerStateLifecycle.handleAction(fromId, action, player)) return;

    if (action.t === 'start') {
      this.watchLifecycle.start(fromId);
      return;
    }

    if (action.t === 'reset') {
      this.watchLifecycle.reset(fromId, action);
      return;
    }

    if (action.t === 'restoreDisconnectedBoard') {
      this.claimLifecycle.restoreDisconnectedBoard(fromId, action.targetId, action.sourceId);
      return;
    }

    if (action.t === 'updateSessionLifetime') {
      this.watchLifecycle.updateSessionLifetime(fromId, action.hours);
      return;
    }

    if (action.t === 'updateMovie') {
      this.watchLifecycle.updateMovie(fromId, action.movie);
      return;
    }

    if (action.t === 'gameOver') {
      this.watchLifecycle.end(fromId);
      return;
    }

    if (action.t === 'resumeGame') {
      this.watchLifecycle.resume(fromId);
      return;
    }
  }

  // Generates a new game code, rotates the channel every connected client is
  // on (including this one), and broadcasts the migration -- shared by kick
  // and "deny + rotate code" so a leaked/compromised code stops working.
  _rotateCode(activityText) {
    return this.membershipLifecycle.rotateCode(activityText);
  }

  _connectedCount() {
    return this.authority.connectedCount();
  }

  _drainClaimQueue() {
    return this.claimLifecycle.drainQueue();
  }

  _startClaim(fromId, text, kind, meta = {}) {
    return this.claimLifecycle.startClaim(fromId, text, kind, meta);
  }

  _resolveClaim(claimId) {
    return this.claimLifecycle.resolveClaim(claimId);
  }

  _completeBoardRecovery() {
    return this.claimLifecycle.completeBoardRecovery();
  }

  _applyReplacement(replacement, newText) {
    return this.claimLifecycle.applyReplacement(replacement, newText);
  }
}

export function applyServerGameAction(snapshot, playerId, action, viewBatch) {
  return runServerGameAction(
    ({ playerId: actingPlayerId, messages }) => {
      const engine = Object.assign(Object.create(GameClient.prototype), {
        onEvent(event) {
          if (event.type === 'proposalRejected')
            messages.push({ t: 'proposalRejected', to: actingPlayerId, message: event.message });
          if (event.type === 'claimCancelled') messages.push({ t: 'claimCancelled', text: event.text });
        },
        _emitState() {},
        _saveSession() {},
        _send(message) {
          if (message.t !== 'state') messages.push(structuredClone(message));
        },
      });
      engine.authority = new RelayAuthority(engine);
      createClaimLifecycle(engine);
      createWatchLifecycle(engine);
      createPlayerLifecycle(engine);
      createPlayerStateLifecycle(engine);
      createProgressLifecycle(engine);
      return engine;
    },
    CLAIM_TIMEOUT_MS,
    snapshot,
    playerId,
    action,
    viewBatch,
  );
}
