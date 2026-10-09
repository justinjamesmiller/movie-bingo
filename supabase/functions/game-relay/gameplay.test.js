import { describe, expect, it, vi } from 'vitest';
import { executeGameplay } from './gameplay.js';

function fixture() {
  const state = {
    code: 'ABCD',
    rev: 0,
    serverRevision: 0,
    started: false,
    gameOver: false,
    players: {
      p1: {
        id: 'p1',
        seat: 0,
        connected: true,
        board: Array.from({ length: 25 }, (_, index) => `Trope ${index}`),
        marked: [],
        wagered: [],
      },
    },
    seatOrder: ['p1'],
    hostIds: ['p1'],
    acceptedTropes: [],
    tropePool: [],
  };
  const room = { state, revision: 0, expires_at: new Date(Date.now() + 60_000).toISOString() };
  const members = [{ player_id: 'p1', user_id: 'user-1', status: 'active', last_seen_at: new Date().toISOString() }];
  const counts = { roomReads: 0, memberReads: 0, presenceWrites: 0 };
  const service = {
    from(table) {
      let updating = false;
      const query = Object.assign(
        Promise.resolve().then(() => {
          if (updating) counts.presenceWrites++;
          else if (table === 'bingo_room_members') counts.memberReads++;
          return { data: updating ? null : members, error: null };
        }),
        {
          update() {
            updating = true;
            return query;
          },
          select() {
            return query;
          },
          eq() {
            return query;
          },
          async maybeSingle() {
            counts.roomReads++;
            return { data: room, error: null };
          },
        },
      );
      return query;
    },
    rpc: vi.fn(async (_, values) => ({
      data: {
        saved: true,
        state: { ...values.p_state, serverRevision: values.p_expected_revision + 1 },
        revision: values.p_expected_revision + 1,
      },
      error: null,
    })),
  };
  const broadcast = vi.fn().mockResolvedValue(undefined);
  const input = {
    service,
    broadcast,
    code: 'ABCD',
    playerId: 'p1',
    userId: 'user-1',
    action: { t: 'setWager', indices: [0] },
    initialRoom: room,
    report: vi.fn(),
  };
  return { input, service, broadcast, room, members, counts };
}

describe('gameplay request snapshot reuse', () => {
  it('uses durable action receipts and does not resend old outcome notifications on replay', async () => {
    const { input, service, room, broadcast } = fixture();
    input.requestId = '44444444-4444-4444-8444-444444444444';
    service.rpc.mockResolvedValue({
      data: { saved: true, replayed: true, state: room.state, revision: 3 },
      error: null,
    });
    const result = await executeGameplay(input);
    expect(result.body.replayed).toBe(true);
    expect(service.rpc).toHaveBeenCalledWith(
      'commit_bingo_action',
      expect.objectContaining({
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_action_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
  it('returns committed state instead of failing an already-saved action when delivery fails', async () => {
    const { input, broadcast, service } = fixture();
    broadcast.mockRejectedValue(new Error('Realtime unavailable'));
    const result = await executeGameplay(input);
    expect(result.status).toBe(200);
    expect(result.body.deliveryPending).toBe(true);
    expect(result.body.state.players.p1.wagered).toEqual([0]);
    expect(service.rpc).toHaveBeenCalledTimes(1);
  });
  it('reuses the already-loaded room, validates fresh membership, and commits before broadcasting', async () => {
    const { input, service, broadcast, counts } = fixture();
    const result = await executeGameplay(input);
    expect(result.status).toBe(200);
    expect(result.body.state.players.p1.wagered).toEqual([0]);
    expect(counts).toEqual({ roomReads: 0, memberReads: 1, presenceWrites: 1 });
    expect(service.rpc.mock.invocationCallOrder[0]).toBeLessThan(broadcast.mock.invocationCallOrder[0]);
  });

  it('loads a fresh room for callers without a request snapshot', async () => {
    const { input, counts } = fixture();
    delete input.initialRoom;
    expect((await executeGameplay(input)).status).toBe(200);
    expect(counts.roomReads).toBe(1);
  });

  it('starts membership reads while an independent room read is still in flight', async () => {
    const { input, service, room, counts } = fixture();
    delete input.initialRoom;
    let release;
    const delayed = new Promise((resolve) => {
      release = resolve;
    });
    const from = service.from.bind(service);
    vi.spyOn(service, 'from').mockImplementation((table) => {
      const query = from(table);
      if (table === 'bingo_rooms')
        query.maybeSingle = async () => {
          await delayed;
          return { data: room, error: null };
        };
      return query;
    });
    const request = executeGameplay(input);
    try {
      await vi.waitFor(() => expect(counts.memberReads).toBe(1));
      expect(service.rpc).not.toHaveBeenCalled();
    } finally {
      release();
    }
    expect((await request).status).toBe(200);
  });

  it('refetches after a conflict instead of caching a stale room across retries', async () => {
    const { input, service, room, counts } = fixture();
    const commit = service.rpc.getMockImplementation();
    service.rpc
      .mockImplementationOnce(async () => {
        room.revision = 1;
        room.state = { ...room.state, serverRevision: 1, acceptedTropes: ['Concurrent observation'] };
        return { data: { conflict: true }, error: null };
      })
      .mockImplementation(commit);
    const result = await executeGameplay(input);
    expect(result.body.state.acceptedTropes).toContain('Concurrent observation');
    expect(counts.roomReads).toBe(1);
    expect(counts.memberReads).toBe(2);
    expect(service.rpc.mock.calls[1][1].p_expected_revision).toBe(1);
  });

  it('does not bypass membership ownership when reusing a room', async () => {
    const { input, members, service, broadcast } = fixture();
    members[0].user_id = 'different-user';
    expect((await executeGameplay(input)).status).toBe(403);
    expect(service.rpc).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('rechecks membership after a conflict and stops if the seat was revoked', async () => {
    const { input, service, members, broadcast } = fixture();
    service.rpc.mockImplementationOnce(async () => {
      members[0].status = 'revoked';
      return { data: { conflict: true }, error: null };
    });
    expect((await executeGameplay(input)).status).toBe(403);
    expect(service.rpc).toHaveBeenCalledTimes(1);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('does not accept an expired request snapshot', async () => {
    const { input, room, service } = fixture();
    room.expires_at = new Date(Date.now() - 1).toISOString();
    expect((await executeGameplay(input)).status).toBe(410);
    expect(service.rpc).not.toHaveBeenCalled();
  });
});
