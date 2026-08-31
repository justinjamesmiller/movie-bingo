// Serverless multiplayer engine: a full-mesh WebRTC network (via PeerJS) where
// every peer holds a replicated copy of game state, and the peer with the
// lowest connected "seat" number acts as the authoritative host. If that peer
// disconnects, authority automatically migrates to the next lowest connected
// seat -- every peer can compute this independently since state is replicated.
import Peer from 'peerjs';
import { generateBoard, CENTER_INDEX } from '../data/tropes.js';

const ID_PREFIX = 'moviebingo-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CLAIM_TIMEOUT_MS = 20000;
const HEARTBEAT_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 16000;
const JOIN_TIMEOUT_MS = 20000;

// STUN alone can't traverse all NATs/firewalls; fall back to a free public TURN
// relay (Open Relay Project) when a direct peer-to-peer path isn't available.
// Best-effort only -- no uptime guarantee, since it's a free shared service.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function randomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

function randomPeerId() {
  return 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export class GameClient {
  constructor({ onState, onEvent } = {}) {
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});
    this.peer = null;
    this.myId = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.lastSeen = new Map();
    this.heartbeatTimer = null;
    this.claimTimeout = null;
    this.state = null;
  }

  destroy() {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.claimTimeout);
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch { /* ignore */ }
    }
    if (this.peer) this.peer.destroy();
  }

  // ---------- Public API ----------

  async hostGame(name) {
    let lastErr;
    for (let attempts = 0; attempts < 8; attempts++) {
      const code = randomCode();
      try {
        await this._openPeer(ID_PREFIX + code);
        this.myId = this.peer.id;
        this._initHostState(code, name);
        this._listenForConnections();
        this._startHeartbeat();
        this._emitState();
        return code;
      } catch (err) {
        lastErr = err;
        if (err?.type !== 'unavailable-id') throw err;
      }
    }
    throw lastErr || new Error('Could not allocate a game code, please try again.');
  }

  joinGame(code, name) {
    const hostPeerId = ID_PREFIX + code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      this._openPeer(randomPeerId())
        .then(() => {
          this.myId = this.peer.id;
          this._listenForConnections();
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          let settled = false;

          const onData = (data) => {
            if (data?.t === 'welcome') {
              settled = true;
              this.state = data.state;
              this._startHeartbeat();
              this._emitState();
              resolve();
            }
          };

          // 'peer-unavailable' means the broker confirmed no such host is registered
          // (real "not found"); other peer errors usually mean a network/WebRTC issue.
          const onPeerError = (err) => {
            if (settled) return;
            settled = true;
            if (err?.type === 'peer-unavailable') {
              reject(new Error('No game found with that code. Double-check the code with the host.'));
            } else {
              reject(new Error(`Could not connect to the host (${err?.type || 'network error'}). This can happen on restrictive networks or in some private-browsing modes — try a normal browser window or a different network.`));
            }
          };

          conn.on('open', () => {
            this._registerConnection(conn);
            conn.send({ t: 'join', name });
          });
          conn.on('data', onData);
          this.peer.on('error', onPeerError);
          conn.on('error', onPeerError);
          setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error('Timed out connecting to the host. This can happen on restrictive networks — try a different network or ask the host to check their connection.'));
            }
          }, JOIN_TIMEOUT_MS);
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

  isHost() {
    return !!this.state && this._currentHostId() === this.myId;
  }

  // ---------- Peer/connection plumbing ----------

  _openPeer(id) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, { config: { iceServers: ICE_SERVERS } });
      this.peer = peer;
      peer.once('open', () => resolve());
      peer.once('error', (err) => reject(err));
    });
  }

  _listenForConnections() {
    this.peer.on('connection', (conn) => {
      conn.on('open', () => this._registerConnection(conn));
    });
    this.peer.on('disconnected', () => {
      this.peer.reconnect();
    });
  }

  _registerConnection(conn) {
    if (this.connections.has(conn.peer)) return;
    this.connections.set(conn.peer, conn);
    this.lastSeen.set(conn.peer, Date.now());
    conn.on('data', (data) => this._onData(conn.peer, data));
    conn.on('close', () => this._onConnectionClosed(conn.peer));
    conn.on('error', () => this._onConnectionClosed(conn.peer));
  }

  _onConnectionClosed(peerId) {
    if (!this.connections.has(peerId)) return;
    this.connections.delete(peerId);
    this.lastSeen.delete(peerId);
    if (!this.state) return;

    const wasHost = this._currentHostId();
    if (this.state.players[peerId]) this.state.players[peerId].connected = false;
    const nowHost = this._currentHostId();

    if (nowHost === this.myId && wasHost !== this.myId) {
      this._onPromotedToHost();
      this.onEvent({ type: 'promotedToHost' });
    }
    this._emitState();
    if (nowHost === this.myId) this._broadcastState();
  }

  _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, conn] of Array.from(this.connections)) {
        try { conn.send({ t: 'ping' }); } catch { /* ignore */ }
        const seen = this.lastSeen.get(peerId) || 0;
        if (now - seen > HEARTBEAT_TIMEOUT_MS) {
          try { conn.close(); } catch { /* ignore */ }
          this._onConnectionClosed(peerId);
        }
      }
    }, HEARTBEAT_MS);
  }

  _send(peerId, msg) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) conn.send(msg);
  }

  _broadcast(msg, excludeId) {
    for (const [peerId, conn] of this.connections) {
      if (peerId !== excludeId && conn.open) conn.send(msg);
    }
  }

  _broadcastState(excludeId) {
    this._broadcast({ t: 'state', state: this.state }, excludeId);
  }

  _dispatch(action) {
    if (!this.state) return;
    if (this.isHost()) {
      this._applyAction(this.myId, action);
    } else {
      const hostId = this._currentHostId();
      if (hostId) this._send(hostId, { t: 'action', action });
    }
  }

  _currentHostId() {
    if (!this.state) return null;
    return this.state.seatOrder.find((id) => this.state.players[id]?.connected) || null;
  }

  _emitState() {
    this.onState(this.state, this.myId);
  }

  // ---------- Message handling ----------

  _onData(fromId, data) {
    this.lastSeen.set(fromId, Date.now());
    switch (data.t) {
      case 'ping':
        this._send(fromId, { t: 'pong' });
        break;
      case 'join':
        if (this.isHost()) this._handleJoin(fromId, data.name);
        break;
      case 'meshPeers':
        this._connectToMesh(data.peers);
        break;
      case 'state':
        this.state = data.state;
        this._emitState();
        break;
      case 'action':
        if (this.isHost()) this._applyAction(fromId, data.action);
        break;
      default:
        break;
    }
  }

  _connectToMesh(peerIds) {
    for (const id of peerIds) {
      if (id === this.myId || this.connections.has(id)) continue;
      const conn = this.peer.connect(id, { reliable: true });
      conn.on('open', () => this._registerConnection(conn));
    }
  }

  // ---------- Host-side game state management ----------

  _initHostState(code, name) {
    const board = generateBoard();
    this.state = {
      code,
      players: {
        [this.myId]: { id: this.myId, name, seat: 0, connected: true, board, wagered: [], marked: [CENTER_INDEX] },
      },
      seatOrder: [this.myId],
      started: false,
      pendingClaim: null,
    };
  }

  _handleJoin(newId, name) {
    if (this.state.started || this.state.players[newId]) return;
    const board = generateBoard();
    const seat = this.state.seatOrder.length;
    this.state.players[newId] = { id: newId, name, seat, connected: true, board, wagered: [], marked: [CENTER_INDEX] };
    this.state.seatOrder.push(newId);

    const existingPeers = Array.from(this.connections.keys()).filter((id) => id !== newId);
    this._send(newId, { t: 'welcome', state: this.state });
    this._send(newId, { t: 'meshPeers', peers: existingPeers });
    this._emitState();
    this._broadcastState(newId);
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
        ? action.indices.filter((i) => Number.isInteger(i) && i >= 0 && i < 25 && i !== CENTER_INDEX)
        : [];
      player.wagered = Array.from(new Set(indices)).slice(0, 5);
      this._emitState();
      this._broadcastState();
      return;
    }

    if (action.t === 'start') {
      if (fromId !== this._currentHostId()) return;
      state.started = true;
      this._emitState();
      this._broadcastState();
      return;
    }

    if (action.t === 'claim') {
      if (!state.started || state.pendingClaim) return;
      const index = action.index;
      if (!Number.isInteger(index) || index < 0 || index >= 25) return;
      if (player.marked.includes(index)) return;
      this._startClaim(fromId, index);
      return;
    }

    if (action.t === 'vote') {
      const pc = state.pendingClaim;
      if (!pc || pc.claimId !== action.claimId || fromId === pc.byId) return;
      pc.votes[fromId] = !!action.agree;
      this._emitState();
      this._broadcastState();
      this._maybeAutoResolve();
      return;
    }
  }

  _connectedCount() {
    return Object.values(this.state.players).filter((p) => p.connected).length;
  }

  _startClaim(fromId, index) {
    const state = this.state;
    const claimant = state.players[fromId];
    const text = claimant.board[index];
    const claimId = `${state.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.pendingClaim = {
      claimId,
      byId: fromId,
      text,
      votes: { [fromId]: true },
      totalPlayers: this._connectedCount(),
    };
    this._emitState();
    this._broadcastState();
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
        if (idx !== -1 && !p.marked.includes(idx)) p.marked.push(idx);
      }
    }

    this.state.pendingClaim = null;
    this.onEvent({ type: 'claimResolved', text: pc.text, approved });
    this._emitState();
    this._broadcastState();
  }
}
