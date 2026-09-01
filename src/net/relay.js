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
import { generateBoard, SUBGENRES, CENTER_INDEX } from '../data/tropes.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHANNEL_PREFIX = 'bingo-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CLAIM_TIMEOUT_MS = 20000;
const JOIN_TIMEOUT_MS = 10000;
const VALID_SUBGENRES = new Set(SUBGENRES.map((g) => g.id));
const DEFAULT_SUBGENRE = 'general';

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

  // ---------- Public API ----------

  async hostGame(name, subgenre, freeSpace) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Please enter your name.');
    const safeSubgenre = VALID_SUBGENRES.has(subgenre) ? subgenre : DEFAULT_SUBGENRE;
    const useFreeSpace = !!freeSpace;
    const code = randomCode();
    await this._connectChannel(code);
    this._initHostState(code, trimmedName, safeSubgenre, useFreeSpace);
    this._emitState();
    return code;
  }

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
              resolve();
            },
          };
          this._send({ t: 'join', from: this.myId, name: trimmedName });
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

  vote(claimId, agree) {
    this._dispatch({ t: 'vote', claimId, agree });
  }

  cancelClaim(claimId) {
    this._dispatch({ t: 'cancelClaim', claimId });
  }

  resetGame(subgenre, freeSpace) {
    this._dispatch({ t: 'reset', subgenre, freeSpace });
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
        if (this.isHost()) this._handleJoin(data.from, data.name);
        break;
      case 'welcome':
        if (data.to === this.myId && this._pendingJoin) {
          this.state = data.state;
          this._pendingJoin.resolve();
          this._emitState();
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
      case 'action':
        if (this.isHost()) this._applyAction(data.from, data.action);
        break;
      default:
        break;
    }
  }

  // ---------- Host-side game state management ----------

  _initHostState(code, name, subgenre, freeSpace) {
    const board = generateBoard(subgenre, freeSpace);
    const marked = freeSpace ? [CENTER_INDEX] : [];
    this.state = {
      code,
      subgenre,
      freeSpace,
      players: {
        [this.myId]: { id: this.myId, name, seat: 0, connected: true, board, wagered: [], marked },
      },
      seatOrder: [this.myId],
      started: false,
      pendingClaim: null,
    };
  }

  _handleJoin(newId, name) {
    if (this.state.started || this.state.players[newId]) return;
    const safeName = (name || '').trim() || 'Player';
    const board = generateBoard(this.state.subgenre, this.state.freeSpace);
    const marked = this.state.freeSpace ? [CENTER_INDEX] : [];
    const seat = this.state.seatOrder.length;
    this.state.players[newId] = { id: newId, name: safeName, seat, connected: true, board, wagered: [], marked };
    this.state.seatOrder.push(newId);

    this._send({ t: 'welcome', to: newId, state: this.state });
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
      this._startClaim(fromId, index, kind);
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
      if (VALID_SUBGENRES.has(action.subgenre)) state.subgenre = action.subgenre;
      if (typeof action.freeSpace === 'boolean') state.freeSpace = action.freeSpace;
      for (const p of Object.values(state.players)) {
        p.board = generateBoard(state.subgenre, state.freeSpace);
        p.wagered = [];
        p.marked = state.freeSpace ? [CENTER_INDEX] : [];
      }
      state.started = false;
      state.pendingClaim = null;
      this.onEvent({ type: 'gameReset' });
      this._send({ t: 'gameReset' });
      this._emitState();
      this._send({ t: 'state', state: this.state });
      return;
    }
  }

  _connectedCount() {
    return Object.values(this.state.players).filter((p) => p.connected).length;
  }

  _startClaim(fromId, index, kind) {
    const state = this.state;
    const claimant = state.players[fromId];
    const text = claimant.board[index];
    const claimId = `${state.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.pendingClaim = {
      claimId,
      byId: fromId,
      text,
      kind,
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
    }

    this.state.pendingClaim = null;
    const payload = { text: pc.text, kind: pc.kind, approved };
    this.onEvent({ type: 'claimResolved', ...payload });
    this._send({ t: 'resolved', ...payload });
    this._emitState();
    this._send({ t: 'state', state: this.state });
  }
}
