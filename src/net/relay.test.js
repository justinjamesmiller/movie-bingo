import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFakeSupabase } from '../test/fakeSupabase.js';

vi.mock('@supabase/supabase-js', async () => {
  const fake = await import('../test/fakeSupabase.js');
  return { createClient: fake.createClient };
});

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost/fake');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');

const { GameClient } = await import('./relay.js');

// Broadcast delivery in the fake bus goes through a couple of chained
// microtasks (sender -> host -> back out to everyone), so give pending
// messages a few ticks to fully settle before asserting on state.
async function flush(times = 8) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Wraps a GameClient with a live-updating `state`/`events` view, populated
// from the same onState/onEvent callbacks the real UI layer would use.
function makeTrackedClient() {
  const events = [];
  let state = null;
  let myId = null;
  const client = new GameClient({
    onState: (s, id) => {
      state = { ...s };
      myId = id;
    },
    onEvent: (evt) => events.push(evt),
  });
  return {
    client,
    events,
    get state() {
      return state;
    },
    get myId() {
      return myId;
    },
  };
}

describe('GameClient', () => {
  beforeEach(() => {
    resetFakeSupabase();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hosts a new game with the host seated as player 0', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    expect(host.state.started).toBe(false);
    expect(host.state.gameOver).toBe(false);
    expect(Object.values(host.state.players)).toHaveLength(1);
    expect(host.state.players[host.myId].name).toBe('Alice');
    expect(host.state.players[host.myId].seat).toBe(0);
    expect(host.state.players[host.myId].board).toHaveLength(25);
  });

  it('lets a second player join pre-game and syncs both clients to 2 players', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    const guest = makeTrackedClient();
    const result = await guest.client.joinGame(code, 'Bob');

    expect(result).toEqual({ needsChoice: false });
    await flush();

    expect(Object.values(host.state.players)).toHaveLength(2);
    expect(Object.values(guest.state.players)).toHaveLength(2);
    expect(guest.state.players[guest.myId].name).toBe('Bob');
    expect(guest.state.players[guest.myId].seat).toBe(1);
  });

  it('rejects joining with a blank name', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await expect(guest.client.joinGame('ABCD', '   ')).rejects.toThrow(/enter your name/i);
  });

  it('lets a player set and clear wagers before the game starts', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    host.client.setWager([0, 1, 2]);
    await flush();
    expect(host.state.players[host.myId].wagered).toEqual([0, 1, 2]);

    host.client.setWager([]);
    await flush();
    expect(host.state.players[host.myId].wagered).toEqual([]);
  });

  it('caps wagers at 5 and ignores the free-space index', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], true, { horror: 50 }, 25);

    host.client.setWager([0, 1, 2, 3, 4, 5, 12]);
    await flush();
    const wagered = host.state.players[host.myId].wagered;
    expect(wagered).toHaveLength(5);
    expect(wagered).not.toContain(12);
  });

  it('starts the game and propagates started=true to every client', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();

    host.client.startGame();
    await flush();

    expect(host.state.started).toBe(true);
    expect(guest.state.started).toBe(true);
  });

  it('resolves a claim as approved once a majority votes yes, and marks it on every matching board', async () => {
    const host = makeTrackedClient();
    // totalTropes === board size means every player's board is the exact
    // same set of 25 texts (just shuffled), guaranteeing the claimed trope
    // exists on both boards -- makes the assertions deterministic.
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    const claimedText = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await flush();

    expect(host.state.pendingClaim).not.toBeNull();
    expect(host.state.pendingClaim.kind).toBe('mark');

    const claimId = host.state.pendingClaim.claimId;
    guest.client.vote(claimId, true);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.acceptedTropes).toContain(claimedText);
    const hostIdx = host.state.players[host.myId].board.indexOf(claimedText);
    const guestIdx = guest.state.players[guest.myId].board.indexOf(claimedText);
    expect(host.state.players[host.myId].marked).toContain(hostIdx);
    expect(guest.state.players[guest.myId].marked).toContain(guestIdx);
    expect(host.events.some((e) => e.type === 'claimResolved' && e.approved)).toBe(true);
  });

  it('resolves a claim as rejected when the majority votes no', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    host.client.claim(0);
    await flush();
    const claimId = host.state.pendingClaim.claimId;
    guest.client.vote(claimId, false);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.players[host.myId].marked).toEqual([]);
    expect(host.events.some((e) => e.type === 'claimResolved' && !e.approved)).toBe(true);
  });

  it('lets the claimant cancel their own pending claim', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    // With two connected players, the claimant's own auto-yes vote alone isn't a
    // majority yet, so the claim stays pending until it's explicitly cancelled.
    host.client.claim(0);
    await flush();
    const claimId = host.state.pendingClaim.claimId;
    host.client.cancelClaim(claimId);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(host.events.some((e) => e.type === 'claimCancelled')).toBe(true);
  });

  it("pre-marks a new mid-game joiner's board with tropes already accepted before they joined", async () => {
    const host = makeTrackedClient();
    // Single-genre, pool size == board size again for a fully deterministic
    // shared trope set across every player who joins.
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();

    const claimedText = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await flush(); // host is the only connected player, so majority is reached immediately

    expect(host.state.acceptedTropes).toContain(claimedText);

    const latecomer = makeTrackedClient();
    const joinResult = await latecomer.client.joinGame(code, 'Charlie');
    expect(joinResult).toEqual({ needsApproval: true });
    await flush();

    expect(host.state.pendingJoinRequest).toMatchObject({ name: 'Charlie' });
    host.client.approveJoinRequest();
    await flush();

    expect(latecomer.state).not.toBeNull();
    const latecomerIdx = latecomer.state.players[latecomer.myId].board.indexOf(claimedText);
    expect(latecomerIdx).toBeGreaterThanOrEqual(0);
    expect(latecomer.state.players[latecomer.myId].marked).toContain(latecomerIdx);
  });

  it('lets the host deny a mid-game join request without rotating the code', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();

    const latecomer = makeTrackedClient();
    const joinResult = await latecomer.client.joinGame(code, 'Eve');
    expect(joinResult).toEqual({ needsApproval: true });
    await flush();

    host.client.denyJoinRequest(false);
    await flush();

    expect(host.state.code).toBe(code);
    expect(host.state.pendingJoinRequest).toBeNull();
    expect(latecomer.events.some((e) => e.type === 'joinDenied')).toBe(true);
    expect(Object.values(host.state.players)).toHaveLength(1);
  });

  it('lets the host deny a mid-game join request AND rotate the game code', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();

    const latecomer = makeTrackedClient();
    await latecomer.client.joinGame(code, 'Eve');
    await flush();

    host.client.denyJoinRequest(true);
    await flush();

    expect(host.state.code).not.toBe(code);
    expect(latecomer.events.some((e) => e.type === 'joinDenied')).toBe(true);
  });

  it('rejects a second concurrent join request while one is already pending', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();

    const first = makeTrackedClient();
    const second = makeTrackedClient();
    await first.client.joinGame(code, 'Eve');
    await flush();
    const secondResultPromise = second.client.joinGame(code, 'Mallory');
    // Attach the rejection assertion in the same tick the promise is created so it's
    // never briefly "unhandled" while the fake bus delivers the rejection asynchronously.
    await expect(secondResultPromise).rejects.toThrow(/already waiting/i);
  });

  it('kicks a player and rotates the code, notifying the kicked player', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();

    host.client.kickPlayer(guest.myId);
    await flush();

    expect(host.state.code).not.toBe(code);
    expect(Object.values(host.state.players)).toHaveLength(1);
    expect(guest.events.some((e) => e.type === 'kicked')).toBe(true);
  });

  it('proposes and approves a mid-game wager change (add + remove) for only the proposer', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.setWager([0, 1]);
    await flush();
    host.client.startGame();
    await flush();

    host.client.proposeWagerChange([2], [0]);
    await flush();

    // Host is the only connected player, so their own auto-yes vote is
    // already a majority and the change resolves immediately.
    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.players[host.myId].wagered.sort()).toEqual([1, 2]);
  });

  it('rejects hosting without a name', async () => {
    const host = makeTrackedClient();
    await expect(host.client.hostGame('', ['horror'], [], false, { horror: 50 }, 25)).rejects.toThrow(
      /enter your name/i,
    );
  });

  it('falls back to a default genre when given an invalid genre selection', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['not-a-real-genre'], [], false, {}, 25);
    expect(host.state.genres).toEqual(['horror']);
  });
});
