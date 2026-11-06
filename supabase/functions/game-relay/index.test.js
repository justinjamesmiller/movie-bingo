// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => service }));
let handler;

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: () => 'test-value' },
    serve: (callback) => {
      handler = callback;
    },
  });
  await import('./index.js');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  service.auth.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
  service.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
});
afterEach(() => vi.restoreAllMocks());

function roomFixture({ host = false, status = 'active', expires = false, insertErrors = {} } = {}) {
  const board = Array.from({ length: 25 }, (_, index) => `Trope ${index}`);
  const state = {
    code: 'ABCD',
    rev: 0,
    serverRevision: 0,
    started: true,
    gameOver: false,
    freeSpace: false,
    genres: ['horror'],
    subgenreSelections: [],
    acceptedTropes: [],
    tropePool: board,
    players: {
      p1: { id: 'p1', name: 'Host', seat: 0, connected: true, avatar: '🎬', board, marked: [], wagered: [] },
      p2: {
        id: 'p2',
        name: 'Guest',
        seat: 1,
        connected: true,
        avatar: '🍿',
        board: [...board],
        marked: [],
        wagered: [],
      },
    },
    seatOrder: ['p1', 'p2'],
    hostIds: ['p1'],
  };
  const member = {
    room_code: 'ABCD',
    player_id: host ? 'p1' : 'p2',
    user_id: 'verified-user',
    is_host: host,
    status,
    last_seen_at: new Date().toISOString(),
  };
  const room = {
    code: 'ABCD',
    state,
    revision: 0,
    expires_at: new Date(Date.now() + (expires ? -1000 : 60000)).toISOString(),
    host_seen_at: new Date().toISOString(),
  };
  const updates = [];
  const inserts = [];
  const deletions = [];
  service.from.mockImplementation((table) => {
    const filters = {};
    let updating = false;
    const result = () => {
      if (updating) return { data: null, error: null };
      if (table === 'bingo_rooms') return { data: room, error: null };
      const matches =
        (!filters.user_id || filters.user_id === member.user_id) &&
        (!filters.player_id || filters.player_id === member.player_id);
      return { data: matches ? [member] : [], error: null };
    };
    const query = Object.assign(Promise.resolve().then(result), {
      select: () => query,
      eq(key, value) {
        filters[key] = value;
        return query;
      },
      update(values) {
        updating = true;
        updates.push({ table, values });
        return query;
      },
      async insert(values) {
        inserts.push({ table, values });
        return { data: null, error: insertErrors[table] || null };
      },
      delete() {
        updating = true;
        deletions.push({ table, filters });
        return query;
      },
      lt: () => query,
      async maybeSingle() {
        const value = result();
        return { ...value, data: Array.isArray(value.data) ? value.data[0] || null : value.data };
      },
    });
    return query;
  });
  const send = vi.fn().mockResolvedValue('ok');
  service.channel.mockReturnValue({
    subscribe(callback) {
      queueMicrotask(() => callback('SUBSCRIBED'));
    },
    send,
  });
  service.removeChannel.mockResolvedValue(undefined);
  return { room, member, send, updates, inserts, deletions };
}

function request(body, authorization = 'Bearer test-token', method = 'POST') {
  return new Request('http://localhost/game-relay', {
    method,
    headers: authorization ? { authorization } : {},
    ...(method === 'POST' && { body: JSON.stringify(body) }),
  });
}

describe('game-relay deployed entrypoint', () => {
  it('creates a room and registers its host using the verified identity', async () => {
    const { room, inserts } = roomFixture({ host: true });
    const sessionExpiresAt = Date.now() + 120_000;
    const response = await handler(
      request({
        operation: 'create',
        code: 'ABCD',
        playerId: 'p1',
        state: { ...room.state, sessionExpiresAt },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ playerId: 'p1', revision: 0 });
    expect(inserts).toEqual([
      {
        table: 'bingo_rooms',
        values: expect.objectContaining({
          code: 'ABCD',
          state: expect.objectContaining({ serverRevision: 0 }),
          expires_at: new Date(sessionExpiresAt).toISOString(),
          host_recovery_password_hash: null,
        }),
      },
      {
        table: 'bingo_room_members',
        values: { room_code: 'ABCD', player_id: 'p1', user_id: 'verified-user', is_host: true, status: 'active' },
      },
    ]);
  });

  it.each([
    ['bingo_rooms', 409, 'Could not create that game code.'],
    ['bingo_room_members', 500, 'Could not register the host seat.'],
  ])('handles a failed %s insert without leaving a partial room', async (table, status, error) => {
    const { room, inserts, deletions } = roomFixture({ insertErrors: { [table]: { message: 'Insert failed' } } });
    const response = await handler(request({ operation: 'create', code: 'ABCD', playerId: 'p1', state: room.state }));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error });
    if (table === 'bingo_rooms') {
      expect(inserts).toHaveLength(1);
      expect(deletions).toEqual([]);
    } else {
      expect(deletions).toEqual([{ table: 'bingo_rooms', filters: { code: 'ABCD' } }]);
    }
  });

  it.each([false, true])('registers a new seat with approval required only during play: %s', async (started) => {
    const { room, inserts, send } = roomFixture();
    room.state.started = started;
    const response = await handler(request({ operation: 'join', code: 'ABCD', name: 'New player', newSeat: true }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ isHost: false, needsApproval: started, status: started ? 'pending' : 'active' });
    expect(inserts).toEqual([
      {
        table: 'bingo_room_members',
        values: {
          room_code: 'ABCD',
          player_id: result.playerId,
          user_id: 'verified-user',
          is_host: false,
          status: started ? 'pending' : 'active',
        },
      },
    ]);
    if (started) {
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ t: 'join', from: result.playerId, name: 'New player', forceNew: true }),
        }),
      );
    } else {
      expect(send).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['ended', 410, 'That game has ended.'],
    ['full', 409, 'This game is full.'],
    ['host-absent', 409, 'No authorized host is currently connected.'],
    ['join-pending', 409, 'Someone else is already waiting to join.'],
  ])('rejects a new join when the room is %s without registering a seat', async (condition, status, error) => {
    const { room, inserts } = roomFixture();
    if (condition === 'ended') room.state.gameOver = true;
    if (condition === 'full') {
      for (let index = 2; index < 32; index++) room.state.players[`p${index + 1}`] = { id: `p${index + 1}` };
    }
    if (condition === 'host-absent') room.host_seen_at = new Date(Date.now() - 61_000).toISOString();
    if (condition === 'join-pending') room.state.pendingJoinRequest = { id: 'p3', name: 'Waiting' };
    const response = await handler(request({ operation: 'join', code: 'ABCD', newSeat: true }));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error });
    expect(inserts).toEqual([]);
    expect(service.channel).not.toHaveBeenCalled();
  });

  it('removes a pending membership when its join request cannot be delivered', async () => {
    const { send, inserts, deletions } = roomFixture();
    send.mockRejectedValue(new Error('Realtime unavailable'));
    const response = await handler(request({ operation: 'join', code: 'ABCD', newSeat: true }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: 'Realtime unavailable' });
    expect(deletions).toContainEqual({
      table: 'bingo_room_members',
      filters: { room_code: 'ABCD', player_id: inserts[0].values.player_id },
    });
  });

  it.each([
    [null, 200],
    ['host_still_connected', 409],
    ['not_recoverable', 404],
    ['host_seat_missing', 404],
    ['password_changed', 409],
  ])('returns the atomic host recovery outcome %s', async (error, status) => {
    const { room, updates, send } = roomFixture({ host: true });
    const configured = await handler(
      request({ operation: 'set-host-recovery-password', code: 'ABCD', playerId: 'p1', password: 'test-password' }),
    );
    expect(configured.status).toBe(200);
    Object.assign(room, updates.find((update) => update.table === 'bingo_rooms').values);
    service.rpc.mockImplementation(async (name) => {
      if (name === 'consume_bingo_relay_request') return { data: { allowed: true }, error: null };
      if (name === 'consume_bingo_host_recovery_attempt') return { data: true, error: null };
      return { data: error ? { error } : { state: room.state, revision: 1 }, error: null };
    });
    const response = await handler(
      request({ operation: 'recover-host', code: 'ABCD', password: 'test-password', name: 'Returning host' }),
    );
    expect(response.status).toBe(status);
    expect(service.rpc).toHaveBeenCalledWith('recover_bingo_host', {
      p_code: 'ABCD',
      p_player_id: 'p1',
      p_user_id: 'verified-user',
      p_name: 'Returning host',
      p_expected_password_hash: room.host_recovery_password_hash,
    });
    if (error) {
      expect(await response.json()).toHaveProperty('error', expect.any(String));
      expect(send).not.toHaveBeenCalled();
    } else {
      expect(await response.json()).toMatchObject({ playerId: 'p1', isHost: true, status: 'active', revision: 1 });
      expect(send).toHaveBeenCalledOnce();
    }
  });

  it.each([
    ['wrong-password', 403],
    ['malformed-verifier', 403],
    ['attempts-exhausted', 429],
    ['attempt-service-failed', 500],
  ])('does not attempt a host transfer when recovery fails: %s', async (failure, status) => {
    const { room, updates } = roomFixture({ host: true });
    const configured = await handler(
      request({ operation: 'set-host-recovery-password', code: 'ABCD', playerId: 'p1', password: 'test-password' }),
    );
    expect(configured.status).toBe(200);
    Object.assign(room, updates.find((update) => update.table === 'bingo_rooms').values);
    if (failure === 'malformed-verifier') room.host_recovery_password_hash = 'invalid-verifier';
    service.rpc.mockImplementation(async (name) =>
      name === 'consume_bingo_relay_request'
        ? { data: { allowed: true }, error: null }
        : {
            data: failure !== 'attempts-exhausted',
            error: failure === 'attempt-service-failed' ? { message: 'Unavailable' } : null,
          },
    );
    const response = await handler(
      request({
        operation: 'recover-host',
        code: 'ABCD',
        password: failure === 'wrong-password' ? 'wrong-password' : 'test-password',
      }),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toHaveProperty('error', expect.any(String));
    expect(service.rpc.mock.calls.some(([name]) => name === 'recover_bingo_host')).toBe(false);
    expect(service.channel).not.toHaveBeenCalled();
  });

  it('allows only the original host to configure a hashed recovery password', async () => {
    roomFixture();
    expect(
      (
        await handler(
          request({ operation: 'set-host-recovery-password', code: 'ABCD', playerId: 'p2', password: 'xy' }),
        )
      ).status,
    ).toBe(403);
    const { updates } = roomFixture({ host: true });
    const response = await handler(
      request({ operation: 'set-host-recovery-password', code: 'ABCD', playerId: 'p1', password: 'xy' }),
    );
    expect(response.status).toBe(200);
    const saved = updates.find((update) => update.table === 'bingo_rooms').values;
    expect(saved.host_recovery_password_hash).toMatch(/^pbkdf2-sha256\$310000\$/);
    expect(saved.host_recovery_password_hash).not.toBe('xy');
    expect(saved).not.toHaveProperty('password');
  });

  it('refuses recovery of a known seat by a different authenticated identity', async () => {
    roomFixture();
    service.auth.getUser.mockResolvedValue({ data: { user: { id: 'different-user' } }, error: null });
    const response = await handler(
      request({ operation: 'join', code: 'ABCD', requestedPlayerId: 'p2', newSeat: false }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: 'That player seat belongs to another authenticated identity.',
    });
  });

  it('returns the existing authorized seat without creating a duplicate', async () => {
    roomFixture();
    const response = await handler(
      request({ operation: 'join', code: 'ABCD', requestedPlayerId: 'p2', newSeat: false }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      playerId: 'p2',
      status: 'active',
      isHost: false,
      state: { code: 'ABCD' },
    });
  });
  it.each(['pending', 'revoked'])('does not expose a room snapshot for %s session status', async (status) => {
    roomFixture({ status });
    const response = await handler(request({ operation: 'join-status', code: 'ABCD', playerId: 'p2' }));
    expect(await response.json()).toMatchObject({ status });
    expect(service.from).toHaveBeenCalledTimes(1);
  });

  it('uses the atomic seat RPC with the verified identity and maps denied transfers', async () => {
    service.rpc.mockImplementation(async (name) =>
      name === 'consume_bingo_relay_request'
        ? { data: { allowed: true }, error: null }
        : { data: { error: 'membership_required' }, error: null },
    );
    const response = await handler(request({ operation: 'claim-seat', code: 'ABCD', playerId: 'p2', seatId: 'p3' }));
    expect(response.status).toBe(403);
    expect(service.rpc).toHaveBeenCalledWith('claim_bingo_seat', {
      p_code: 'ABCD',
      p_user_id: 'verified-user',
      p_current_id: 'p2',
      p_seat_id: 'p3',
    });
    expect(service.from).not.toHaveBeenCalled();
  });

  it('maps budget service failure to 503 and never touches rooms', async () => {
    service.rpc.mockRejectedValue(new Error('Budget unavailable'));
    expect((await handler(request({ operation: 'join', code: 'ABCD' }))).status).toBe(503);
    expect(service.from).not.toHaveBeenCalled();
  });
  it.each(['start', 'reset', 'kick', 'requestBoardRecovery'])(
    'denies guest host-only action %s at the real endpoint',
    async (type) => {
      roomFixture();
      const action =
        type === 'kick'
          ? { t: type, targetId: 'p1' }
          : type === 'requestBoardRecovery'
            ? { t: type, sourceId: 'p1', targetId: 'p2', timeoutSeconds: 10 }
            : type === 'reset'
              ? {
                  t: type,
                  genres: ['horror'],
                  subgenreSelections: [],
                  freeSpace: false,
                  generalPercents: {},
                  totalTropes: 25,
                }
              : { t: type };
      const response = await handler(
        request({ operation: 'publish', code: 'ABCD', playerId: 'p2', message: { t: 'action', from: 'p1', action } }),
      );
      expect(response.status).toBe(403);
      expect(service.rpc).toHaveBeenCalledTimes(1);
      expect(service.channel).not.toHaveBeenCalled();
    },
  );

  it('rejects forged player identity and guest state snapshots', async () => {
    const { room } = roomFixture();
    const forged = await handler(
      request({ operation: 'publish', code: 'ABCD', playerId: 'p1', message: { t: 'reaction', emoji: '😂' } }),
    );
    expect(forged.status).toBe(403);
    const snapshot = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p2',
        expectedRevision: 0,
        message: { t: 'state', state: room.state },
      }),
    );
    expect(snapshot.status).toBe(403);
  });

  it.each(['pending', 'revoked'])('denies non-active %s seat gameplay', async (status) => {
    roomFixture({ status });
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p2',
        message: { t: 'action', action: { t: 'claim', index: 0 } },
      }),
    );
    expect(response.status).toBe(403);
    expect(service.channel).not.toHaveBeenCalled();
  });

  it('derives a reaction sender from membership rather than the payload', async () => {
    const { send } = roomFixture();
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p2',
        message: { t: 'reaction', from: 'p1', sender: 'p1', emoji: '😂' },
      }),
    );
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ from: 'p2', sender: 'p2' }) }),
    );
  });

  it.each([false, true])('returns authorized session status with room expiry %s', async (expires) => {
    roomFixture({ expires });
    const response = await handler(request({ operation: 'join-status', code: 'ABCD', playerId: 'p2' }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe(expires ? 'expired' : 'active');
  });

  it('returns a competing authoritative snapshot instead of broadcasting a stale host save', async () => {
    const { room, send } = roomFixture({ host: true });
    const committed = { ...room.state, serverRevision: 2, acceptedTropes: ['Trope 0'] };
    service.rpc.mockImplementation(async (name) =>
      name === 'consume_bingo_relay_request'
        ? { data: { allowed: true }, error: null }
        : { data: { conflict: true, revision: 2, state: committed, code: 'ABCD' }, error: null },
    );
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p1',
        expectedRevision: 0,
        message: { t: 'state', state: room.state },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ conflict: true, revision: 2, state: committed });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ t: 'stateConflict', state: committed }),
      }),
    );
  });

  it('executes guest gameplay through the deployed endpoint and commits the resulting state', async () => {
    const { room, send } = roomFixture();
    const requestId = '77777777-7777-4777-8777-777777777777';
    room.state.started = false;
    service.rpc.mockImplementation(async (name, values) =>
      name === 'consume_bingo_relay_request'
        ? { data: { allowed: true }, error: null }
        : { data: { saved: true, revision: 1, state: { ...values.p_state, serverRevision: 1 } }, error: null },
    );
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p2',
        requestId,
        message: { t: 'action', action: { t: 'setWager', indices: [0, 1] } },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: { players: { p1: { wagered: [] }, p2: { wagered: [0, 1] } }, serverRevision: 1 },
    });
    expect(service.rpc).toHaveBeenCalledWith(
      'commit_bingo_action',
      expect.objectContaining({
        p_code: 'ABCD',
        p_player_id: 'p2',
        p_user_id: 'verified-user',
        p_request_id: requestId,
      }),
    );
    expect(send).toHaveBeenCalled();
  });

  it('allows a host state commit and returns committed state even if realtime delivery fails', async () => {
    const { room, send } = roomFixture({ host: true });
    service.rpc.mockImplementation(async (name, values) =>
      name === 'consume_bingo_relay_request'
        ? { data: { allowed: true }, error: null }
        : {
            data: { saved: true, revision: 1, code: 'ABCD', state: { ...values.p_state, serverRevision: 1 } },
            error: null,
          },
    );
    send.mockRejectedValue(new Error('Realtime unavailable'));
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p1',
        expectedRevision: 0,
        message: { t: 'state', state: room.state },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, revision: 1, deliveryPending: true });
  });
  it('serves preflight without authentication and rejects unsupported methods', async () => {
    expect((await handler(request(null, null, 'OPTIONS'))).status).toBe(200);
    expect((await handler(request(null, null, 'GET'))).status).toBe(405);
    expect(service.auth.getUser).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid JWTs before touching budgets or room data', async () => {
    expect((await handler(request({ operation: 'join', code: 'ABCD' }, null))).status).toBe(401);
    service.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } });
    expect((await handler(request({ operation: 'join', code: 'ABCD' }))).status).toBe(401);
    expect(service.rpc).not.toHaveBeenCalled();
    expect(service.from).not.toHaveBeenCalled();
  });

  it('uses the verified identity for limits and stops exhausted budgets before room work', async () => {
    service.rpc.mockResolvedValue({ data: { allowed: false, retry_after_seconds: 60 }, error: null });
    const response = await handler(request({ operation: 'join', code: 'ABCD' }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_relay_request', {
      p_user_id: 'verified-user',
      p_operation: 'join',
    });
    expect(service.from).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads at the real endpoint rather than executing operations', async () => {
    const response = await handler(
      request({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p1',
        message: { t: 'action', action: { t: 'vote', claimId: 'claim', agree: 'yes' } },
      }),
    );
    expect(response.status).toBe(400);
    expect(service.from).not.toHaveBeenCalled();
  });
});
