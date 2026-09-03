import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEligibleTropeTexts } from '../data/tropes.js';
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
  const states = [];
  let state = null;
  let myId = null;
  const client = new GameClient({
    onState: (s, id) => {
      state = { ...s };
      states.push(structuredClone(s));
      myId = id;
    },
    onEvent: (evt) => events.push(evt),
  });
  return {
    client,
    events,
    states,
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('rejects a join attempt if the relay subscription never completes', async () => {
    vi.useFakeTimers();
    const guest = makeTrackedClient();
    const removeChannel = vi.fn();
    guest.client.supabase = {
      channel: () => ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      }),
      removeChannel,
    };

    const assertion = expect(guest.client.joinGame('ABCD', 'Bob')).rejects.toThrow(/could not connect to the relay/i);
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('rejects hosting if the relay subscription never completes', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    host.client.supabase = {
      channel: () => ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      }),
      removeChannel: vi.fn(),
    };

    const assertion = expect(host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25)).rejects.toThrow(
      /could not connect to the relay/i,
    );
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
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

  it('does not emit a terminal fully-voted claim as still pending before resolving', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();

    const terminalPendingClaims = host.states
      .map((state) => state.pendingClaim)
      .filter((claim) => claim && Object.keys(claim.votes).length >= claim.totalPlayers);
    expect(terminalPendingClaims).toEqual([]);
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

  it('deals the proposer a fresh board when a board swap is approved', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 40);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.setWager([1, 2]);
    await flush();
    host.client.startGame();
    await flush();

    const oldBoard = [...host.state.players[host.myId].board];
    const guestBoard = [...guest.state.players[guest.myId].board];

    host.client.proposeBoardSwap();
    await flush();
    expect(host.state.pendingClaim.kind).toBe('reroll');

    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();

    const newBoard = host.state.players[host.myId].board;
    expect(newBoard).toHaveLength(25);
    expect(new Set(newBoard).size).toBe(25);
    expect(newBoard).not.toEqual(oldBoard);
    expect(newBoard.every((text) => host.state.tropePool.includes(text))).toBe(true);
    // Only the proposer is re-dealt.
    expect(guest.state.players[guest.myId].board).toEqual(guestBoard);
    // Wagers pointed at the old layout, so they're cleared for re-placement.
    expect(host.state.players[host.myId].wagered).toEqual([]);
    expect(host.events.some((e) => e.type === 'claimResolved' && e.kind === 'reroll' && e.approved)).toBe(true);
  });

  it('keeps already-accepted tropes marked on a freshly dealt board', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    const acceptedText = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();
    expect(host.state.acceptedTropes).toContain(acceptedText);

    host.client.proposeBoardSwap();
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();

    const me = host.state.players[host.myId];
    expect(me.marked).toContain(me.board.indexOf(acceptedText));
  });

  it('leaves the board untouched when a board swap is voted down', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 40);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    const oldBoard = [...host.state.players[host.myId].board];
    host.client.proposeBoardSwap();
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, false);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.players[host.myId].board).toEqual(oldBoard);
  });

  it('ignores a board swap request before the game has started', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.proposeBoardSwap();
    await flush();
    expect(host.state.pendingClaim).toBeNull();
  });

  it('marks a replacement trope that the group had already accepted', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 40);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    // Treat every trope the swap could draw from as already accepted, so the
    // randomly-picked replacement is guaranteed to be one of them.
    host.client.state.acceptedTropes = [...getEligibleTropeTexts('horror', 'general')];
    const oldText = host.state.players[host.myId].board[0];

    host.client.proposeReplace(oldText, 'horror', 'general');
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();

    const me = host.state.players[host.myId];
    expect(me.board[0]).not.toBe(oldText);
    expect(me.marked).toContain(0);
  });
});

describe('GameClient connection stability', () => {
  beforeEach(() => {
    resetFakeSupabase();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Sets up a started two-player game and hands back both tracked clients,
  // plus the host's saved session (the guest's join overwrites it in the
  // shared sessionStorage, so capture it while it's still the host's).
  async function twoPlayerGame() {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const hostSession = sessionStorage.getItem('movie-bingo-session');
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();
    return { host, guest, code, hostSession };
  }

  it('does not mark a peer disconnected the moment their connection drops', async () => {
    const { host, guest } = await twoPlayerGame();

    guest.client.channel.simulateDrop();
    await flush();

    expect(host.state.players[guest.myId].connected).toBe(true);
  });

  it('marks a peer disconnected only after the grace period elapses', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    const joined = guest.client.joinGame(code, 'Bob');
    await vi.advanceTimersByTimeAsync(50);
    await joined;

    guest.client.channel.simulateDrop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(host.state.players[guest.myId].connected).toBe(true);

    await vi.advanceTimersByTimeAsync(120000);
    expect(host.state.players[guest.myId].connected).toBe(false);
  });

  it('cancels a pending disconnect as soon as the peer is heard from again', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    const joined = guest.client.joinGame(code, 'Bob');
    await vi.advanceTimersByTimeAsync(50);
    await joined;

    guest.client.channel.simulateDrop();
    await vi.advanceTimersByTimeAsync(30000);

    // The guest comes back before the grace period is up.
    guest.client._checkConnection();
    await vi.advanceTimersByTimeAsync(200000);

    expect(host.state.players[guest.myId].connected).toBe(true);
  });

  it('restores a rejoining host to connected and back in charge', async () => {
    const { host, guest, hostSession } = await twoPlayerGame();
    const hostId = host.myId;

    // The host's phone drops out long enough for the guest to promote itself.
    host.client.channel.simulateDrop();
    guest.client._markDisconnected(hostId);
    await flush();
    expect(guest.state.players[hostId].connected).toBe(false);
    expect(guest.client.isHost()).toBe(true);

    sessionStorage.setItem('movie-bingo-session', hostSession);
    const returning = makeTrackedClient();
    await returning.client.rejoinGame();
    await flush();

    expect(returning.state.players[hostId].connected).toBe(true);
    expect(returning.client.isHost()).toBe(true);
    expect(guest.client.isHost()).toBe(false);
  });

  // The old failure mode: everyone else still considered the host connected, so
  // no client satisfied isHost() to answer, and the rejoin timed out.
  it('answers a host rejoin even while peers still consider that host connected', async () => {
    const { host, guest, hostSession } = await twoPlayerGame();
    const hostId = host.myId;

    host.client.channel.simulateDrop();
    await flush();
    expect(guest.state.players[hostId].connected).toBe(true);
    expect(guest.client.isHost()).toBe(false);

    sessionStorage.setItem('movie-bingo-session', hostSession);
    const returning = makeTrackedClient();
    await expect(returning.client.rejoinGame()).resolves.toBeUndefined();
    expect(returning.client.isHost()).toBe(true);
  });

  it('lets a disconnected player recover their same seat by using Join instead of Reconnect', async () => {
    const { host, guest, code } = await twoPlayerGame();
    const guestId = guest.myId;

    guest.client.channel.simulateDrop();
    host.client._markDisconnected(guestId);
    await flush();

    expect(host.state.players[guestId].connected).toBe(false);

    const returning = makeTrackedClient();
    returning.client.myId = guestId;
    const result = await returning.client.joinGame(code, 'Bob Back');
    await flush();

    expect(result).toEqual({ needsChoice: false });
    expect(returning.state.players[guestId].connected).toBe(true);
    expect(returning.state.players[guestId].name).toBe('Bob Back');
    expect(returning.myId).toBe(guestId);
  });

  it('offers disconnected seats when a returning player joins with a fresh client id', async () => {
    const { host, guest, code } = await twoPlayerGame();
    const guestId = guest.myId;

    guest.client.channel.simulateDrop();
    host.client._markDisconnected(guestId);
    await flush();

    const returning = makeTrackedClient();
    const result = await returning.client.joinGame(code, 'Bob Back');

    expect(result).toEqual({
      needsChoice: true,
      options: [{ id: guestId, name: 'Bob', seat: 1 }],
      allowNew: true,
      name: 'Bob Back',
    });
  });

  it('offers a seat whose disconnect is still in the grace period when someone joins', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    const joined = guest.client.joinGame(code, 'Bob');
    await vi.advanceTimersByTimeAsync(50);
    await joined;
    host.client.startGame();
    await vi.advanceTimersByTimeAsync(50);

    guest.client.channel.simulateDrop();
    await vi.advanceTimersByTimeAsync(50);
    expect(host.state.players[guest.myId].connected).toBe(true);

    const returning = makeTrackedClient();
    const joinAttempt = returning.client.joinGame(code, 'Bob Back');
    await vi.advanceTimersByTimeAsync(50);

    await expect(joinAttempt).resolves.toEqual({
      needsChoice: true,
      options: [{ id: guest.myId, name: 'Bob', seat: 1 }],
      allowNew: true,
      name: 'Bob Back',
    });
  });

  it('self-heals a seat wrongly reported as disconnected instead of needing a refresh', async () => {
    const { host, guest } = await twoPlayerGame();

    // A stale snapshot from the host claims the guest has dropped, even though
    // the guest is plainly still here and receiving it.
    host.client.state.players[guest.myId].connected = false;
    host.client._send({ t: 'state', state: host.client.state });
    await flush();

    expect(guest.state.players[guest.myId].connected).toBe(true);
    expect(host.state.players[guest.myId].connected).toBe(true);
  });

  it('settles on the lowest-seat player when two clients both believe they are host', async () => {
    const { host, guest } = await twoPlayerGame();

    // Force the split brain: the guest thinks the host is gone and has taken
    // over, while the host still believes it is in charge.
    guest.client.state.players[host.myId].connected = false;
    expect(guest.client.isHost()).toBe(true);
    expect(host.client.isHost()).toBe(true);

    guest.client._send({ t: 'state', state: guest.client.state });
    await flush();

    expect(host.client.isHost()).toBe(true);
    expect(guest.client.isHost()).toBe(false);
    expect(guest.state.players[host.myId].connected).toBe(true);
  });

  it('claims still resolve for both players after a drop and recovery', async () => {
    const { host, guest } = await twoPlayerGame();

    host.client.channel.simulateDrop();
    await flush();
    host.client._checkConnection();
    await flush();

    const text = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await flush();
    expect(guest.state.pendingClaim).not.toBeNull();

    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(guest.state.pendingClaim).toBeNull();
    expect(host.state.acceptedTropes).toContain(text);
    expect(guest.state.acceptedTropes).toContain(text);
  });
});

describe('GameClient session recovery', () => {
  beforeEach(() => {
    resetFakeSupabase();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('falls back to the localStorage backup when the tab-scoped session is gone', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    // Closing and reopening the tab wipes sessionStorage but not localStorage.
    sessionStorage.clear();

    expect(GameClient.getSavedSession()).toMatchObject({ name: 'Alice', myId: host.myId });
  });

  it('revives the game from the local snapshot when nobody is left to answer', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    const claimedText = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(host.state.acceptedTropes).toContain(claimedText);

    // Everyone steps away: the only client is torn down entirely.
    host.client.destroy();
    resetFakeSupabase();

    const returning = makeTrackedClient();
    const rejoin = returning.client.rejoinGame();
    await vi.advanceTimersByTimeAsync(11000);
    await expect(rejoin).resolves.toBeUndefined();

    expect(returning.state.code).toBe(code);
    expect(returning.state.started).toBe(true);
    expect(returning.state.acceptedTropes).toContain(claimedText);
    expect(returning.state.players[returning.myId].marked).toContain(0);
    expect(returning.client.isHost()).toBe(true);
    expect(returning.events.some((e) => e.type === 'gameRestored')).toBe(true);
  });

  it('still reports the game as gone when there is no snapshot to revive', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.destroy();
    resetFakeSupabase();
    localStorage.removeItem('movie-bingo-snapshot');

    const returning = makeTrackedClient();
    // Attach the rejection expectation before advancing timers so it's never
    // momentarily an unhandled rejection.
    const assertion = expect(returning.client.rejoinGame()).rejects.toThrow(/may have ended/i);
    await vi.advanceTimersByTimeAsync(11000);
    await assertion;
    expect(GameClient.getSavedSession()).toBeNull();
  });

  it('lets a stale returning client be corrected by the live game instead of rolling it back', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    // A snapshot taken before the game started, replayed by a client that
    // thinks it is still pre-game.
    const stale = structuredClone(guest.client.state);
    stale.started = false;
    stale.rev = 0;

    guest.client._send({ t: 'state', state: stale });
    await flush();

    expect(host.state.started).toBe(true);
    expect(guest.state.started).toBe(true);
  });

  it('drops a snapshot that belongs to a different game code', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    expect(GameClient.getSavedSnapshot('ZZZZ')).toBeNull();
  });

  it('forgets the snapshot when a player deliberately leaves', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.leaveGame();
    expect(GameClient.getSavedSnapshot()).toBeNull();
    expect(GameClient.getSavedSession()).toBeNull();
  });
});
