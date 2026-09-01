// Relay-based multiplayer engine: every player subscribes to a single Supabase
// Realtime channel (named after the 4-character game code) and broadcasts
// messages to it -- Supabase's server relays messages to everyone else on the
// channel, so no peer-to-peer networking or NAT traversal is needed. Presence
// tracks who is currently connected. The player with the lowest connected
// "seat" number (join order) acts as the authoritative host; if they
// disconnect, authority automatically migrates to the next lowest connected
// seat -- every client can compute this independently since game state is
// replicated to everyone via broadcast.
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHANNEL_PREFIX = 'bingo-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CLAIM_TIMEOUT_MS = 20000;
const JOIN_TIMEOUT_MS = 10000;
const VALID_GENRES = new Set(GENRES.map((g) => g.id));
const VALID_GENERAL_PERCENTS = new Set(GENERAL_PERCENT_OPTIONS);
const VALID_TOTAL_TROPES = new Set(TOTAL_TROPES_OPTIONS);
const DEFAULT_GENRE = 'horror';
const SESSION_KEY = 'movie-bingo-session';

function isValidSubgenre(genre, subgenre) {
  return (SUBGENRES_BY_GENRE[genre] || []).some((s) => s.id === subgenre);
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
    if (s.subgenre === 'general' || !safeGenres.includes(s.genre) || !isValidSubgenre(s.genre, s.subgenre)) return false;
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

export class GameClient {
  constructor({ onState, onEvent } = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).',
      );
    }
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.myId = randomId();
    this.channel = null;
    this.state = null;
    this.claimTimeout = null;
    this._pendingJoin = null;
  }

  destroy() {
    clearTimeout(this.claimTimeout);
    if (this.channel) this.supabase.removeChannel(this.channel);
  }

  // ---------- Session persistence (lets a disconnected player/host reconnect) ----------

  static getSavedSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.code || !parsed?.myId || !parsed?.name) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static clearSavedSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  _saveSession(code, name) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, myId: this.myId, name }));
    } catch {
      // sessionStorage may be unavailable (e.g. private browsing); reconnect just won't be offered
    }
  }

  // ---------- Public API ----------

  async hostGame(name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Please enter your name.');
    const safe = sanitizeGenreSelection(genres, subgenreSelections);
    const useFreeSpace = !!freeSpace;
    const safeGeneralPercents = sanitizeGeneralPercents(safe.genres, generalPercents);
    const safeTotalTropes = VALID_TOTAL_TROPES.has(totalTropes) ? totalTropes : DEFAULT_TOTAL_TROPES;
    const code = randomCode();
    await this._connectChannel(code);
    this._initHostState(code, trimmedName, safe.genres, safe.subgenreSelections, useFreeSpace, safeGeneralPercents, safeTotalTropes);
    this._saveSession(code, trimmedName);
    this._emitState();
    return code;
  }

  // Resolves to `{ needsChoice: false }` once fully joined, or, if the host
  // finds disconnected seats on that code, to `{ needsChoice: true, options,
  // allowNew, name }` so the UI can offer picking one up (see claimDisconnectedSeat)
  // instead of always creating a brand-new seat.
  joinGame(code, name) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return Promise.reject(new Error('Please enter your name.'));
    const normalized = code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      this._connectChannel(normalized)
        .then(() => {
          const timeout = setTimeout(() => {
            this._pendingJoin = null;
            reject(new Error('No response from a host with that code. Double-check the code and that the host is still connected.'));
          }, JOIN_TIMEOUT_MS);

          this._pendingJoin = {
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
          };
          this._send({ t: 'join', from: this.myId, name: trimmedName });
        })
        .catch(reject);
    });
  }

  // Re-sends the join request on the same (already-connected) temp channel,
  // telling the host to skip the claim-offer and create a brand-new seat.
  // Used when the player picks "Join as a new player" from the choice modal.
  confirmNewJoin(name) {
    const trimmedName = (name || '').trim();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingJoin = null;
        reject(new Error('No response from the host.'));
      }, JOIN_TIMEOUT_MS);
      this._pendingJoin = {
        resolve: () => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          this._saveSession(this.code, trimmedName);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeout);
          this._pendingJoin = null;
          reject(err);
        },
      };
      this._send({ t: 'join', from: this.myId, name: trimmedName, forceNew: true });
    });
  }

  // Takes over an existing (disconnected) seat picked from the choice modal --
  // reconnects using that seat's id (same mechanism as rejoinGame) so its
  // board/wagers/marks are preserved, but with the freshly-entered name.
  claimDisconnectedSeat(seatId, name) {
    const trimmedName = (name || '').trim();
    const code = this.code;
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
  rejoinGame() {
    const saved = GameClient.getSavedSession();
    if (!saved) return Promise.reject(new Error('No previous session found to reconnect to.'));
    this.myId = saved.myId;
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

  startGame() {
    this._dispatch({ t: 'start' });
  }

  claim(index) {
    this._dispatch({ t: 'claim', index });
  }

  challengeTrope(text) {
    this._dispatch({ t: 'challenge', text });
  }

  vote(claimId, agree) {
    this._dispatch({ t: 'vote', claimId, agree });
  }

  cancelClaim(claimId) {
    this._dispatch({ t: 'cancelClaim', claimId });
  }

  resetGame(genres, subgenreSelections, freeSpace, generalPercents, totalTropes) {
    this._dispatch({ t: 'reset', genres, subgenreSelections, freeSpace, generalPercents, totalTropes });
  }

  // `genre`/`subgenre` here can be ANY genre/sub-genre in the whole registry,
  // independent of the game's own configured genres -- swapping a trope out
  // for something from a totally different genre is intentional.
  proposeReplace(text, genre, subgenre) {
    this._dispatch({ t: 'proposeReplace', text, genre, subgenre });
  }

  proposeAccept(text) {
    this._dispatch({ t: 'proposeAccept', text });
  }

  changeName(newName) {
    const trimmed = (newName || '').trim().slice(0, 20);
    if (!trimmed) return;
    this._dispatch({ t: 'changeName', name: trimmed });
    this._saveSession(this.code, trimmed);
  }

  // Host-only: removes a player and rotates the game code as a security
  // measure (in case the old code leaked), then transparently migrates every
  // still-connected client (including the host) to the new code's channel.
  kickPlayer(targetId) {
    this._dispatch({ t: 'kick', targetId });
  }

  leaveGame() {
    GameClient.clearSavedSession();
    this.destroy();
  }

  isHost() {
    return !!this.state && this._currentHostId() === this.myId;
  }

  // ---------- Channel plumbing ----------

  _connectChannel(code) {
    this.code = code;
    return new Promise((resolve, reject) => {
      const channel = this.supabase.channel(CHANNEL_PREFIX + code, {
        config: { broadcast: { self: false }, presence: { key: this.myId } },
      });
      this.channel = channel;

      channel.on('broadcast', { event: 'msg' }, ({ payload }) => this._onMessage(payload));
      channel.on('presence', { event: 'leave' }, ({ key }) => this._onPeerLeft(key));

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ id: this.myId });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(err || new Error('Could not connect to the relay.'));
        }
      });
    });
  }

  _send(msg) {
    this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg });
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
    if (this.isHost()) {
      this._applyAction(this.myId, action);
    } else {
      this._send({ t: 'action', from: this.myId, action });
    }
  }

  _currentHostId() {
    if (!this.state) return null;
    return this.state.seatOrder.find((id) => this.state.players[id]?.connected) || null;
  }

  _emitState() {
    this.onState(this.state, this.myId);
  }

  _onPeerLeft(peerId) {
    if (!this.state || !this.state.players[peerId]) return;
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

  // ---------- Message handling ----------

  _onMessage(data) {
    switch (data.t) {
      case 'join':
        if (this.isHost()) this._handleJoin(data.from, data.name, data.forceNew);
        break;
      case 'rejoin':
        if (this.isHost()) this._handleRejoin(data.from, data.name);
        break;
      case 'welcome':
        if (data.to === this.myId && this._pendingJoin) {
          this.state = data.state;
          this._pendingJoin.resolve();
          this._emitState();
        }
        break;
      case 'claimOffer':
        if (data.to === this.myId && this._pendingJoin?.choice) {
          this._pendingJoin.choice(data.options, data.allowNew);
        }
        break;
      case 'joinRejected':
        if (data.to === this.myId && this._pendingJoin) {
          const reason = data.reason === 'started' ? 'That game has already started.' : 'Could not join that game.';
          this._pendingJoin.reject?.(new Error(reason));
        }
        break;
      case 'rejoinFailed':
        if (data.to === this.myId && this._pendingJoin) {
          this._pendingJoin.reject?.(new Error('That session could not be found — the game may have ended.'));
        }
        break;
      case 'state':
        this.state = data.state;
        this._emitState();
        break;
      case 'resolved':
        this.onEvent({ type: 'claimResolved', text: data.text, kind: data.kind, approved: data.approved });
        break;
      case 'gameReset':
        this.onEvent({ type: 'gameReset' });
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
        if (this.isHost()) this._applyAction(data.from, data.action);
        break;
      default:
        break;
    }
  }

  // ---------- Host-side game state management ----------

  _initHostState(code, name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes) {
    const tropePool = pickTropePool(genres, subgenreSelections, generalPercents, totalTropes);
    const board = buildPlayerBoard(tropePool, freeSpace);
    const marked = freeSpace ? [CENTER_INDEX] : [];
    this.state = {
      code,
      genres,
      subgenreSelections,
      freeSpace,
      generalPercents,
      totalTropes,
      tropePool,
      players: {
        [this.myId]: { id: this.myId, name, seat: 0, connected: true, board, wagered: [], marked },
      },
      seatOrder: [this.myId],
      started: false,
      pendingClaim: null,
      acceptedTropes: [],
    };
  }

  _handleJoin(newId, name, forceNew) {
    if (this.state.players[newId]) return;
    const disconnected = Object.values(this.state.players).filter((p) => !p.connected);
    if (!forceNew && disconnected.length > 0) {
      this._send({
        t: 'claimOffer',
        to: newId,
        options: disconnected.map((p) => ({ id: p.id, name: p.name, seat: p.seat })),
        allowNew: !this.state.started,
      });
      return;
    }
    if (this.state.started) {
      this._send({ t: 'joinRejected', to: newId, reason: 'started' });
      return;
    }
    const safeName = (name || '').trim() || 'Player';
    const board = buildPlayerBoard(this.state.tropePool, this.state.freeSpace);
    const marked = this.state.freeSpace ? [CENTER_INDEX] : [];
    const seat = this.state.seatOrder.length;
    this.state.players[newId] = { id: newId, name: safeName, seat, connected: true, board, wagered: [], marked };
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
    const player = this.state.players[id];
    if (!player) {
      this._send({ t: 'rejoinFailed', to: id });
      return;
    }
    player.connected = true;
    const trimmed = (name || '').trim();
    if (trimmed) player.name = trimmed;

    this._send({ t: 'welcome', to: id, state: this.state });
    this._emitState();
    this._send({ t: 'state', state: this.state });
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
    const player = state.players[fromId];
    if (!player) return;

    if (action.t === 'setWager') {
      if (state.started) return;
      const indices = Array.isArray(action.indices)
        ? action.indices.filter((i) => Number.isInteger(i) && i >= 0 && i < 25 && !(state.freeSpace && i === CENTER_INDEX))
        : [];
      player.wagered = Array.from(new Set(indices)).slice(0, 5);
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'start') {
      if (fromId !== this._currentHostId()) return;
      state.started = true;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'claim') {
      if (!state.started || state.pendingClaim) return;
      const index = action.index;
      if (!Number.isInteger(index) || index < 0 || index >= 25) return;
      if (state.freeSpace && index === CENTER_INDEX) return;
      const kind = player.marked.includes(index) ? 'unmark' : 'mark';
      this._startClaim(fromId, player.board[index], kind);
      return;
    }

    if (action.t === 'challenge') {
      if (!state.started || state.pendingClaim) return;
      if (typeof action.text !== 'string' || !state.acceptedTropes.includes(action.text)) return;
      this._startClaim(fromId, action.text, 'unmark');
      return;
    }

    if (action.t === 'vote') {
      const pc = state.pendingClaim;
      if (!pc || pc.claimId !== action.claimId || fromId === pc.byId) return;
      pc.votes[fromId] = !!action.agree;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      this._maybeAutoResolve();
      return;
    }

    if (action.t === 'cancelClaim') {
      const pc = state.pendingClaim;
      if (!pc || pc.claimId !== action.claimId || fromId !== pc.byId) return;
      clearTimeout(this.claimTimeout);
      state.pendingClaim = null;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      this.onEvent({ type: 'claimCancelled', text: pc.text });
      return;
    }

    if (action.t === 'reset') {
      if (fromId !== this._currentHostId()) return;
      clearTimeout(this.claimTimeout);
      const safe = sanitizeGenreSelection(action.genres, action.subgenreSelections);
      state.genres = safe.genres;
      state.subgenreSelections = safe.subgenreSelections;
      if (typeof action.freeSpace === 'boolean') state.freeSpace = action.freeSpace;
      state.generalPercents = sanitizeGeneralPercents(state.genres, action.generalPercents);
      if (VALID_TOTAL_TROPES.has(action.totalTropes)) state.totalTropes = action.totalTropes;
      state.tropePool = pickTropePool(state.genres, state.subgenreSelections, state.generalPercents, state.totalTropes);
      for (const p of Object.values(state.players)) {
        p.board = buildPlayerBoard(state.tropePool, state.freeSpace);
        p.wagered = [];
        p.marked = state.freeSpace ? [CENTER_INDEX] : [];
      }
      state.started = false;
      state.pendingClaim = null;
      state.acceptedTropes = [];
      this.onEvent({ type: 'gameReset' });
      this._send({ t: 'gameReset' });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'changeName') {
      const trimmed = (action.name || '').trim().slice(0, 20);
      if (!trimmed) return;
      player.name = trimmed;
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }

    if (action.t === 'proposeReplace') {
      if (state.pendingClaim) return;
      if (typeof action.text !== 'string' || action.text === FREE_SPACE_TEXT || !state.tropePool.includes(action.text)) return;
      const safeGenre = VALID_GENRES.has(action.genre) ? action.genre : state.genres[0];
      const safeSubgenre = isValidSubgenre(safeGenre, action.subgenre) ? action.subgenre : 'general';
      this._startClaim(fromId, action.text, 'replace', { genre: safeGenre, subgenre: safeSubgenre });
      return;
    }

    if (action.t === 'proposeAccept') {
      if (state.pendingClaim) return;
      if (typeof action.text !== 'string' || !state.tropePool.includes(action.text)) return;
      if (state.acceptedTropes.includes(action.text)) return;
      this._startClaim(fromId, action.text, 'mark');
      return;
    }

    if (action.t === 'kick') {
      if (fromId !== this._currentHostId()) return;
      const targetId = action.targetId;
      if (targetId === fromId || !state.players[targetId]) return;
      delete state.players[targetId];
      state.seatOrder = state.seatOrder.filter((id) => id !== targetId);
      if (state.pendingClaim && state.pendingClaim.byId === targetId) {
        clearTimeout(this.claimTimeout);
        state.pendingClaim = null;
      }
      const newCode = randomCode();
      state.code = newCode;
      this._send({ t: 'migrate', newCode, state });
      this._emitState();
      this.onEvent({ type: 'codeChanged', code: newCode });
      this._migrateToCode(newCode).catch(() => {});
      return;
    }
  }

  _connectedCount() {
    return Object.values(this.state.players).filter((p) => p.connected).length;
  }

  _startClaim(fromId, text, kind, meta = {}) {
    const state = this.state;
    const claimId = `${state.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.pendingClaim = {
      claimId,
      byId: fromId,
      text,
      kind,
      ...meta,
      votes: { [fromId]: true },
      totalPlayers: this._connectedCount(),
    };
    this._emitState();
    this._send({ t: 'state', state: this.state });
    clearTimeout(this.claimTimeout);
    this.claimTimeout = setTimeout(() => this._resolveClaim(claimId), CLAIM_TIMEOUT_MS);
    this._maybeAutoResolve();
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
    if (!pc) return;
    const { agree, disagree } = this._tally(pc);
    const needed = this._majorityNeeded(pc.totalPlayers);
    const impossible = disagree > pc.totalPlayers - needed;
    const allVoted = Object.keys(pc.votes).length >= pc.totalPlayers;
    if (agree >= needed || impossible || allVoted) {
      this._resolveClaim(pc.claimId);
    }
  }

  _resolveClaim(claimId) {
    const pc = this.state.pendingClaim;
    if (!pc || pc.claimId !== claimId) return;
    clearTimeout(this.claimTimeout);
    const { agree } = this._tally(pc);
    const needed = this._majorityNeeded(pc.totalPlayers);
    const approved = agree >= needed;

    if (approved) {
      if (pc.kind === 'replace') {
        const affected = Object.values(this.state.players).filter((p) => p.board.includes(pc.text));
        const eligible = getEligibleTropeTexts(pc.genre, pc.subgenre);
        const candidates = eligible.filter(
          (text) => text !== pc.text && text !== FREE_SPACE_TEXT && !affected.some((p) => p.board.includes(text)),
        );
        if (candidates.length > 0) {
          const newText = candidates[Math.floor(Math.random() * candidates.length)];
          for (const p of affected) {
            const idx = p.board.indexOf(pc.text);
            p.board[idx] = newText;
            p.wagered = p.wagered.filter((i) => i !== idx);
            p.marked = p.marked.filter((i) => i !== idx);
          }
          if (!this.state.tropePool.includes(newText)) this.state.tropePool.push(newText);
        }
        this.state.acceptedTropes = this.state.acceptedTropes.filter((t) => t !== pc.text);
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
        } else if (!this.state.acceptedTropes.includes(pc.text)) {
          this.state.acceptedTropes.push(pc.text);
        }
      }
    }

    this.state.pendingClaim = null;
    const payload = { text: pc.text, kind: pc.kind, approved };
    this.onEvent({ type: 'claimResolved', ...payload });
    this._send({ t: 'resolved', ...payload });
    this._emitState();
    this._send({ t: 'state', state: this.state });
  }
}
