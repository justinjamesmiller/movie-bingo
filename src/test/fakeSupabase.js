// Minimal in-memory fake of the tiny slice of the @supabase/supabase-js
// Realtime API that relay.js actually uses (channel/on/subscribe/track/send/
// removeChannel), so GameClient instances can talk to each other inside
// tests without any real network. All `createClient()` calls share one
// module-level bus, mirroring how every real client ultimately talks through
// the same Supabase project -- call `resetFakeSupabase()` between tests.
const bus = new Map();
const rooms = new Map();
const members = new Map();
let nextUserId = 0;
let nextPlayerId = 0;
let serverGameplayEnabled = true;

function memberKey(code, playerId) {
  return `${code}:${playerId}`;
}

function findMember(code, userId, playerId) {
  const member = members.get(memberKey(code, playerId));
  return member?.userId === userId ? member : null;
}

function deliver(topic, payload, excluded) {
  for (const peer of bus.get(topic) || []) {
    if (peer === excluded) continue;
    const copy = structuredClone(payload);
    queueMicrotask(() => {
      for (const cb of peer._broadcastHandlers) cb({ payload: copy });
    });
  }
}

export function resetFakeSupabase() {
  bus.clear();
  rooms.clear();
  members.clear();
  nextUserId = 0;
  nextPlayerId = 0;
  serverGameplayEnabled = true;
}

export function setFakeServerGameplayEnabled(enabled) {
  serverGameplayEnabled = enabled;
}

export function setFakePlayerLastSeen(code, playerId, timestamp) {
  members.get(memberKey(code, playerId)).lastSeenAt = timestamp;
}

class FakeChannel {
  constructor(name, presenceKey, userId, isPrivate) {
    this.name = name;
    this.presenceKey = presenceKey;
    this.userId = userId;
    this.isPrivate = isPrivate;
    this.state = 'closed';
    this._broadcastHandlers = [];
    this._leaveHandlers = [];
  }

  on(type, filter, cb) {
    if (type === 'broadcast') this._broadcastHandlers.push(cb);
    else if (type === 'presence' && filter?.event === 'leave') this._leaveHandlers.push(cb);
    return this;
  }

  subscribe(cb) {
    if (this.isPrivate) {
      const code = this.name.slice('bingo-'.length);
      const authorized = [...members.values()].some(
        (member) => member.roomCode === code && member.userId === this.userId && member.status === 'active',
      );
      if (!authorized) {
        queueMicrotask(() => cb('CHANNEL_ERROR', new Error('Private channel membership required.')));
        return this;
      }
    }
    if (!bus.has(this.name)) bus.set(this.name, new Set());
    bus.get(this.name).add(this);
    this._statusCb = cb;
    queueMicrotask(() => {
      this.state = 'joined';
      cb('SUBSCRIBED');
    });
    return this;
  }

  // Re-emits a subscribe status on this same channel, the way realtime-js does
  // when the socket blips (CHANNEL_ERROR) and then rejoins (SUBSCRIBED).
  simulateStatus(status) {
    this.state = status === 'SUBSCRIBED' ? 'joined' : 'errored';
    this._statusCb?.(status);
  }

  track() {
    // Presence payload itself isn't asserted on in these tests.
  }

  presenceState() {
    const present = {};
    for (const peer of bus.get(this.name) || []) present[peer.presenceKey] = [{ id: peer.presenceKey }];
    return present;
  }

  // Simulates the transport dropping without an explicit removeChannel (what a
  // backgrounded phone or a flaky network actually does): peers see a presence
  // leave, and this channel stops sending and receiving.
  simulateDrop() {
    const peers = bus.get(this.name);
    this.state = 'closed';
    if (!peers) return;
    peers.delete(this);
    for (const peer of peers) {
      for (const cb of peer._leaveHandlers) cb({ key: this.presenceKey });
    }
  }

  send({ payload }) {
    const peers = bus.get(this.name);
    if (!peers || this.state !== 'joined') return;
    deliver(this.name, payload, this);
  }

  serverSend(payload) {
    deliver(this.name, payload, null);
  }
}

export function createClient() {
  const identity = { user: null };
  return {
    auth: {
      currentUserId() {
        return identity.user?.id;
      },
      setTestUserId(id) {
        identity.user = { id };
      },
      async getSession() {
        return { data: { session: identity.user ? { user: identity.user } : null }, error: null };
      },
      async signInAnonymously() {
        identity.user = { id: `user-${++nextUserId}` };
        return { data: { user: identity.user }, error: null };
      },
    },
    functions: {
      async invoke(name, options) {
        const result = await this._invoke(name, options);
        if (serverGameplayEnabled && result.data) result.data.gameplayMode = 'server';
        return result;
      },
      async _invoke(_name, { body }) {
        const userId = identity.user?.id;
        if (!userId) return { data: null, error: new Error('Auth session required.') };
        const { operation, code, playerId } = body;
        if (operation === 'create') {
          if (rooms.has(code)) return { data: { error: 'Code already exists.' }, error: null };
          if (
            body.hostRecoveryPassword != null &&
            body.hostRecoveryPassword !== '' &&
            (typeof body.hostRecoveryPassword !== 'string' || body.hostRecoveryPassword.length < 2)
          ) {
            return { data: { error: 'Use a host recovery password between 2 and 128 characters.' }, error: null };
          }
          const state = structuredClone(body.state);
          state.serverRevision = 0;
          rooms.set(code, {
            state,
            revision: 0,
            hostSeenAt: Date.now(),
            hostRecoveryPlayerId: body.hostRecoveryPassword ? playerId : null,
            hostRecoveryPassword: body.hostRecoveryPassword || null,
            recoveryAttempts: 0,
          });
          members.set(memberKey(code, playerId), {
            roomCode: code,
            playerId,
            userId,
            isHost: true,
            status: 'active',
            lastSeenAt: Date.now(),
          });
          return { data: { playerId, revision: 0 }, error: null };
        }
        if (operation === 'set-host-recovery-password') {
          const room = rooms.get(code);
          const member = findMember(code, userId, playerId);
          if (!member?.isHost || member.status !== 'active' || !room) {
            return { data: { error: 'An active host seat is required.' }, error: null };
          }
          if (typeof body.password !== 'string' || body.password.length < 2 || body.password.length > 128) {
            return { data: { error: 'Use a host recovery password between 2 and 128 characters.' }, error: null };
          }
          room.hostRecoveryPlayerId = playerId;
          room.hostRecoveryPassword = body.password;
          room.recoveryAttempts = 0;
          return { data: { ok: true }, error: null };
        }
        if (operation === 'join') {
          const room = rooms.get(code);
          if (!room) return { data: { error: 'Game not found.' }, error: null };
          if (body.hostRecoveryPassword) {
            room.recoveryAttempts += 1;
            if (room.recoveryAttempts > 5) {
              return { data: { error: 'Too many recovery attempts.' }, error: null };
            }
            if (
              body.hostRecoveryPassword !== room.hostRecoveryPassword ||
              !room.hostRecoveryPlayerId ||
              !room.state.hostIds?.includes(room.hostRecoveryPlayerId)
            ) {
              return { data: { error: 'The host recovery password is incorrect or is not configured.' }, error: null };
            }
            const player = room.state.players[room.hostRecoveryPlayerId];
            if (!player || (player.connected && Date.now() - room.hostSeenAt < 60_000)) {
              return { data: { error: 'The original host still appears connected.' }, error: null };
            }
            const member = members.get(memberKey(code, room.hostRecoveryPlayerId));
            if (!member?.isHost) return { data: { error: 'Host seat cannot be recovered.' }, error: null };
            member.userId = userId;
            member.status = 'active';
            player.connected = true;
            if (typeof body.name === 'string' && body.name.trim()) player.name = body.name.trim().slice(0, 20);
            room.revision += 1;
            room.state.serverRevision = room.revision;
            room.state.rev = (room.state.rev || 0) + 1;
            room.hostSeenAt = Date.now();
            room.recoveryAttempts = 0;
            return {
              data: {
                playerId: room.hostRecoveryPlayerId,
                isHost: true,
                status: 'active',
                revision: room.revision,
                state: structuredClone(room.state),
                recovered: true,
              },
              error: null,
            };
          }
          if (!body.newSeat && body.requestedPlayerId) {
            const existing = findMember(code, userId, body.requestedPlayerId);
            if (existing) {
              return {
                data: {
                  playerId: existing.playerId,
                  isHost: existing.isHost,
                  status: existing.status,
                  needsApproval: existing.status === 'pending',
                  state: existing.status === 'active' ? room.state : undefined,
                },
                error: null,
              };
            }
          }
          if (room.state.started && room.state.pendingJoinRequest) {
            return { data: { error: 'Someone else is already waiting to join.' }, error: null };
          }
          const id =
            (!body.newSeat && body.requestedPlayerId) ||
            `p${(++nextPlayerId).toString(36)}${Date.now().toString(36).slice(-4)}`;
          if (members.has(memberKey(code, id)))
            return { data: { error: 'Player ID already belongs to another user.' }, error: null };
          const pending = !!room.state.started && !body.newSeat;
          const member = {
            roomCode: code,
            playerId: id,
            userId,
            isHost: false,
            status: pending ? 'pending' : 'active',
            lastSeenAt: Date.now(),
          };
          members.set(memberKey(code, id), member);
          if (pending) {
            const hostChannel = [...(bus.get(`bingo-${code}`) || [])].find((channel) =>
              [...members.values()].some(
                (entry) =>
                  entry.roomCode === code &&
                  entry.playerId === channel.presenceKey &&
                  entry.isHost &&
                  entry.userId === channel.userId,
              ),
            );
            hostChannel?.serverSend({ t: 'join', from: id, name: body.name || 'Player', forceNew: true, sender: id });
            return { data: { playerId: id, isHost: false, status: 'pending', needsApproval: true }, error: null };
          }
          return { data: { playerId: id, isHost: false, status: 'active' }, error: null };
        }
        if (operation === 'join-status') {
          const member = findMember(code, userId, playerId);
          if (!member) return { data: { status: 'revoked' }, error: null };
          const room = rooms.get(code);
          if (member.status !== 'active') return { data: { status: member.status }, error: null };
          const expiresAt = room?.state?.sessionExpiresAt;
          if (room?.state?.gameOver || (Number.isFinite(expiresAt) && expiresAt <= Date.now())) {
            return { data: { status: 'expired', expiresAt }, error: null };
          }
          return { data: { status: room ? 'active' : 'revoked', state: room?.state, expiresAt }, error: null };
        }
        if (operation === 'cancel-join') {
          const member = findMember(code, userId, playerId);
          if (member?.status === 'pending') member.status = 'revoked';
          return { data: { ok: true }, error: null };
        }
        if (operation === 'claim-seat') {
          const current = findMember(code, userId, playerId);
          const former = members.get(memberKey(code, body.seatId));
          const room = rooms.get(code);
          if (
            !current ||
            !former ||
            former.userId !== userId ||
            former.isHost ||
            room?.state.players?.[body.seatId]?.connected
          ) {
            return { data: { error: 'Seat cannot be reclaimed.' }, error: null };
          }
          members.delete(memberKey(code, playerId));
          members.delete(memberKey(code, body.seatId));
          former.playerId = body.seatId;
          former.status = 'active';
          members.set(memberKey(code, body.seatId), former);
          return { data: { playerId: body.seatId }, error: null };
        }
        if (operation === 'heartbeat') {
          const member = findMember(code, userId, playerId);
          if (!member || member.status !== 'active')
            return { data: { error: 'Active membership required.' }, error: null };
          member.lastSeenAt = Date.now();
          const room = rooms.get(code);
          if (room && member.isHost) room.hostSeenAt = Date.now();
          if (
            room?.state.pendingClaim?.expiresAt <= Date.now() ||
            room?.state.pendingBoardRecovery?.expiresAt <= Date.now()
          ) {
            const { applyServerGameAction } = await import('../net/relay.js');
            const result = applyServerGameAction(room.state, playerId, { t: 'settleClaim' });
            room.revision += 1;
            result.state.serverRevision = room.revision;
            room.state = result.state;
            for (const entry of members.values()) {
              if (entry.roomCode === code && room.state.lastBoardRecovery?.sourceId === entry.playerId)
                entry.status = 'revoked';
            }
            deliver(`bingo-${code}`, { t: 'state', state: room.state, sender: 'pserver' }, null);
            for (const message of result.messages) deliver(`bingo-${code}`, { ...message, sender: 'pserver' }, null);
          }
          return { data: { ok: true }, error: null };
        }
        if (operation === 'leave') {
          const member = findMember(code, userId, playerId);
          if (member) members.delete(memberKey(code, playerId));
          return { data: { ok: true }, error: null };
        }
        if (operation === 'publish') {
          const member = findMember(code, userId, playerId);
          const room = rooms.get(code);
          const message = body.message;
          if (!member || !room) return { data: { error: 'Membership required.' }, error: null };
          const isSnapshot = ['state', 'welcome', 'migrate'].includes(message?.t);
          if (isSnapshot && !member.isHost) return { data: { error: 'Host authorization required.' }, error: null };
          if (
            isSnapshot &&
            (body.expectedRevision !== room.revision || message.state?.serverRevision !== body.expectedRevision)
          ) {
            deliver(
              `bingo-${code}`,
              { t: 'stateConflict', state: structuredClone(room.state), sender: playerId },
              null,
            );
            return {
              data: { conflict: true, revision: room.revision, state: structuredClone(room.state), code },
              error: null,
            };
          }

          if (message?.t === 'action') {
            const hostActions = [
              'start',
              'reset',
              'gameOver',
              'resumeGame',
              'updateSessionLifetime',
              'updateMovie',
              'addHost',
              'resignHost',
              'kick',
              'approveJoin',
              'denyJoin',
              'proposeProfileChange',
              'restoreDisconnectedBoard',
              'requestBoardRecovery',
              'cancelBoardRecovery',
            ];
            if (hostActions.includes(message.action?.t) && !member.isHost) {
              return { data: { error: 'Host authorization required.' }, error: null };
            }
            const { applyServerGameAction, SERVER_GAMEPLAY_ACTIONS } = await import('../net/relay.js');
            if (serverGameplayEnabled && SERVER_GAMEPLAY_ACTIONS.has(message.action?.t)) {
              if (member.status !== 'active') return { data: { error: 'Active membership required.' }, error: null };
              member.lastSeenAt = Date.now();
              const snapshot = structuredClone(room.state);
              for (const player of Object.values(snapshot.players)) {
                const entry = members.get(memberKey(code, player.id));
                player.connected =
                  entry?.status === 'active' && Date.now() - (entry.lastSeenAt ?? Date.now()) < 120_000;
              }
              const result = applyServerGameAction(snapshot, playerId, message.action, message.viewBatch);
              room.revision += 1;
              result.state.serverRevision = room.revision;
              result.state.rev = (room.state.rev || 0) + 1;
              room.state = result.state;
              for (const entry of members.values()) {
                if (entry.roomCode === code && room.state.lastBoardRecovery?.sourceId === entry.playerId)
                  entry.status = 'revoked';
              }
              deliver(`bingo-${code}`, { t: 'state', state: room.state, sender: 'pserver' }, null);
              for (const event of result.messages) deliver(`bingo-${code}`, { ...event, sender: 'pserver' }, null);
              return {
                data: { ok: true, state: structuredClone(room.state), revision: room.revision, code },
                error: null,
              };
            }
            message.from = playerId;
          } else if (isSnapshot) {
            room.revision += 1;
            const committedState = structuredClone(message.state);
            committedState.serverRevision = room.revision;
            committedState.rev = Math.max(committedState.rev || 0, room.state.rev + 1);
            room.state = committedState;
            room.hostSeenAt = Date.now();
            for (const other of members.values()) {
              if (other.roomCode !== code) continue;
              other.isHost = !!committedState.hostIds?.includes(other.playerId);
              if (committedState.players?.[other.playerId]) other.status = 'active';
              else if (
                committedState.lastBoardRecovery?.sourceId === other.playerId ||
                (other.status === 'pending' && committedState.pendingJoinRequest?.id !== other.playerId)
              )
                other.status = 'revoked';
            }
            message.state = committedState;
            if (message.t === 'welcome') {
              const joined = members.get(memberKey(code, message.to));
              if (joined) joined.status = 'active';
            }
            if (message.t === 'migrate') {
              rooms.delete(code);
              rooms.set(message.newCode, room);
              for (const entry of members.values()) {
                if (entry.roomCode !== code) continue;
                members.delete(memberKey(code, entry.playerId));
                entry.roomCode = message.newCode;
                members.set(memberKey(message.newCode, entry.playerId), entry);
              }
            }
          } else if (!member.isHost && !['join', 'rejoin', 'reaction'].includes(message?.t)) {
            return { data: { error: 'Host authorization required.' }, error: null };
          }
          const outgoing = { ...message, sender: playerId };
          deliver(`bingo-${code}`, outgoing, null);
          if (message?.t === 'joinRejected') {
            const target = members.get(memberKey(code, message.to));
            if (target) target.status = 'revoked';
          }
          return {
            data: {
              ok: true,
              ...(isSnapshot && {
                revision: room.revision,
                state: structuredClone(room.state),
                code: message.state.code,
              }),
            },
            error: null,
          };
        }
        return { data: { error: `Unsupported operation: ${operation}` }, error: null };
      },
    },
    channel(name, config) {
      const presenceKey = config?.config?.presence?.key;
      return new FakeChannel(name, presenceKey, identity.user?.id, config?.config?.private === true);
    },
    removeChannel(channel) {
      channel.state = 'closed';
      const peers = bus.get(channel.name);
      if (!peers) return;
      peers.delete(channel);
      for (const peer of peers) {
        for (const cb of peer._leaveHandlers) cb({ key: channel.presenceKey });
      }
    },
  };
}
