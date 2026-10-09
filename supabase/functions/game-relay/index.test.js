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

function roomFixture({ host = false, status = 'active', expires = false } = {}) {
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
      delete() {
        updating = true;
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
  return { room, member, send, updates };
}

function request(body, authorization = 'Bearer test-token', method = 'POST') {
  return new Request('http://localhost/game-relay', {
    method,
    headers: authorization ? { authorization } : {},
    ...(method === 'POST' && { body: JSON.stringify(body) }),
  });
}

describe('game-relay deployed entrypoint', () => {
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
