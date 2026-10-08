import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFakeSupabase } from '../test/fakeSupabase.js';
import { getPlayerSuperlatives, getSuperlativeMetrics } from '../utils/superlatives.js';

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

async function waitForRelayEvent(client, type) {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (client.events.some((event) => event.type === type)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await flush(2);
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
    get authUserId() {
      return client.supabase.auth.currentUserId();
    },
    setAuthUserId(id) {
      client.supabase.auth.setTestUserId(id);
    },
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

  it('recovers the original host board and permissions with a recovery password', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const originalHostId = host.myId;
    const originalBoard = [...host.state.players[originalHostId].board];
    host.client.setHostRecoveryPassword('long secure recovery phrase');
    host.client.startGame();
    await flush();
    host.client.state.players[originalHostId].connected = false;
    await host.client._send({ t: 'state', state: host.client.state });
    await flush();

    const returning = makeTrackedClient();
    await expect(returning.client.joinGame(code, 'Alice on new device', 'incorrect recovery phrase')).rejects.toThrow(
      /incorrect/i,
    );
    await expect(
      returning.client.joinGame(code, 'Alice on new device', 'long secure recovery phrase'),
    ).resolves.toEqual({ needsChoice: false });
    await flush();

    expect(returning.myId).toBe(originalHostId);
    expect(returning.client.isHost()).toBe(true);
    expect(returning.state.players[originalHostId]).toMatchObject({
      name: 'Alice on new device',
      connected: true,
      board: originalBoard,
    });
    await host.client._send({ t: 'state', state: host.client.state });
    expect(host.events.some((event) => event.type === 'relayError')).toBe(true);
  });

  it('recovers the original host seat and board with the server-verified recovery password', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const hostId = host.myId;
    const originalBoard = [...host.state.players[hostId].board];
    host.client.setHostRecoveryPassword('long secure recovery phrase');
    host.client.startGame();
    await flush();

    host.client.state.players[hostId].connected = false;
    await host.client._send({ t: 'state', state: host.client.state });
    await flush();

    const returning = makeTrackedClient();
    await expect(returning.client.joinGame(code, 'Alice new device', 'incorrect recovery phrase')).rejects.toThrow(
      /incorrect/i,
    );
    const result = await returning.client.joinGame(code, 'Alice new device', 'long secure recovery phrase');
    await flush();

    expect(result).toEqual({ needsChoice: false });
    expect(returning.client.isHost()).toBe(true);
    expect(returning.myId).toBe(hostId);
    expect(returning.state.players[hostId]).toMatchObject({
      name: 'Alice new device',
      connected: true,
      board: originalBoard,
    });
    await host.client._send({ t: 'state', state: host.client.state });
    expect(host.events.some((event) => event.type === 'relayError')).toBe(true);
  });

  it('ignores malformed relay payloads and prototype-like action player ids', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const originalState = host.client.state;

    expect(() => host.client._onMessage(null)).not.toThrow();
    expect(() => host.client._onMessage([])).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'state', sender: 'pattacker', state: { rev: 100, players: {}, seatOrder: [] } }),
    ).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'migrate', sender: 'pattacker', newCode: 'WXYZ', state: null }),
    ).not.toThrow();
    host.client._pendingJoin = { resolve: vi.fn() };
    expect(() =>
      host.client._onMessage({
        t: 'welcome',
        sender: 'pattacker',
        to: host.myId,
        state: { players: {}, seatOrder: [] },
      }),
    ).not.toThrow();
    host.client._pendingJoin = null;
    expect(() =>
      host.client._onMessage({
        t: 'action',
        sender: 'pattacker',
        from: 'toString',
        action: { t: 'claim', index: 0 },
      }),
    ).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'join', sender: 'pattacker', from: '__proto__', name: 'Intruder' }),
    ).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'join', sender: 'pattacker', from: 'toString', name: 'Intruder' }),
    ).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'rejoin', sender: 'pattacker', from: 'toString', name: 'Intruder' }),
    ).not.toThrow();
    expect(() =>
      host.client._onMessage({ t: 'resolved', approvedBy: {}, missedCalls: {}, wagerFreedIds: {} }),
    ).not.toThrow();
    expect(() => host.client._onPeerLeft('toString')).not.toThrow();
    expect(() => host.client._notePeerAlive('toString')).not.toThrow();
    expect(() => host.client._markDisconnected('toString')).not.toThrow();

    expect(host.client.state).toBe(originalState);
    expect(host.client.state.pendingClaim).toBeNull();
    expect(Object.keys(host.client.state.players)).toEqual([host.myId]);
    expect(Object.prototype.toString.connected).toBeUndefined();
  });

  it('sanitizes malformed join and profile names without changing the existing profile', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    expect(() => host.client._handleJoin('pattacker', { trim: 'not a function' })).not.toThrow();
    expect(host.state.players.pattacker.name).toBe('Player');
    expect(() => host.client._handleRejoin(host.myId, { trim: 'not a function' })).not.toThrow();
    expect(() =>
      host.client._applyAction(host.myId, { t: 'changeName', name: { trim: 'not a function' } }),
    ).not.toThrow();
    expect(host.state.players[host.myId].name).toBe('Alice');
  });

  it('limits inbound message bursts per sender, then allows messages after the window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);

    for (let index = 0; index < 61; index++) {
      host.client._onMessage({ t: 'reaction', sender: 'pattacker', from: 'pattacker', emoji: '🔥' });
    }
    expect(host.events.filter((event) => event.type === 'reaction')).toHaveLength(60);

    host.client._onMessage({ t: 'reaction', sender: 'pattacker', from: 'pattacker', emoji: '💥' });
    expect(host.events.filter((event) => event.type === 'reaction')).toHaveLength(60);
    Date.now.mockReturnValue(11_000);
    host.client._onMessage({ t: 'reaction', sender: 'pattacker', from: 'pattacker', emoji: '🔥' });
    expect(host.events.filter((event) => event.type === 'reaction')).toHaveLength(61);
  });

  it('filters malformed claim offers, reactions, and rejection notices', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const choice = vi.fn();
    host.client._pendingJoin = { choice };
    host.client._onMessage({
      t: 'claimOffer',
      sender: 'pattacker',
      to: host.myId,
      options: [
        { id: '__proto__', name: 'Invalid', avatar: '🍿', seat: 0 },
        { id: 'pformer', name: 'Former player', avatar: '🍿', seat: 1 },
      ],
      allowNew: true,
    });
    expect(choice).toHaveBeenCalledWith([{ id: 'pformer', name: 'Former player', avatar: '🍿', seat: 1 }], true);
    host.client._pendingJoin = null;

    host.client._onMessage({ t: 'reaction', sender: 'pattacker', from: 'pattacker', emoji: '💥' });
    host.client._onMessage({ t: 'reaction', sender: 'pattacker', from: 'pattacker', emoji: '🔥' });
    host.client._onMessage({ t: 'proposalRejected', sender: 'pattacker', to: host.myId, message: 'x'.repeat(500) });

    expect(host.events.filter((event) => event.type === 'reaction')).toEqual([
      { type: 'reaction', from: 'pattacker', emoji: '🔥' },
    ]);
    expect(host.events.find((event) => event.type === 'proposalRejected').message).toHaveLength(240);
  });

  it('replicates superlative activity and outcomes so every player derives the same awards', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    const [first, second] = host.state.players[host.myId].board;
    host.client.recordTropeView(first);
    host.client.recordTropeView(second);
    host.client.recordTropeView(first);
    guest.client.recordTropeView(first);
    guest.client.recordTropeView('Not in the pool');
    await flush();
    expect(host.state.superlativeStats[host.myId]).toMatchObject({ views: 3, viewedTropes: [first, second] });
    expect(host.state.superlativeStats[guest.myId]).toMatchObject({ views: 1, viewedTropes: [first] });
    expect(guest.state.superlativeStats).toEqual(host.state.superlativeStats);

    host.client.startGame();
    await flush();
    host.client.claim(0);
    await flush();
    expect(guest.state.superlativeMilestones[host.myId]).toMatchObject({ firstProposal: true });
    expect(host.state.acceptedTropes).toEqual([]);
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(host.state.superlativeMilestones[host.myId]).toMatchObject({
      firstAccepted: true,
      firstAcceptedTied: false,
    });
    expect(host.state.superlativeStats[guest.myId].approvalVotes).toBe(1);
    expect(host.state.superlativeStats[guest.myId].otherApprovalVotes).toBe(1);
    expect(host.state.superlativeStats[host.myId].otherApprovalVotes).toBe(0);
    expect(host.state.superlativeStats[host.myId].acceptedProposals).toBe(1);
    expect(guest.state.acceptedTropeProposers[first]).toEqual([host.myId]);

    guest.client.proposeAccept(second);
    await flush();
    host.client.vote(host.state.pendingClaim.claimId, false);
    await flush();
    expect(host.state.superlativeStats[guest.myId].rejections).toBe(1);
    guest.client.proposeAccept(second);
    await flush();
    host.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(host.state.superlativeStats[guest.myId]).toMatchObject({
      submissions: 2,
      acceptedAfterRejection: 1,
      marksAfterRejection: 1,
      acceptedProposals: 1,
    });
    expect(guest.state.superlativeStats).toEqual(host.state.superlativeStats);
    expect(guest.state.superlativeMilestones).toEqual(host.state.superlativeMilestones);
    const names = (state) =>
      Object.fromEntries(
        Object.entries(getPlayerSuperlatives(Object.values(state.players), state)).map(([id, award]) => [
          id,
          award.name,
        ]),
      );
    expect(names(host.state)).toEqual(names(guest.state));
    const snapshot = GameClient.getSavedSnapshot(code);
    expect(snapshot.state.superlativeStats).toEqual(host.state.superlativeStats);
    expect(snapshot.state.superlativeMilestones).toEqual(host.state.superlativeMilestones);
    expect(snapshot.state.acceptedTropeProposers).toEqual(host.state.acceptedTropeProposers);
    host.client.resetGame(['horror'], [], false, { horror: 50 }, 25);
    await flush();
    expect(host.state.superlativeStats).toEqual({});
    expect(guest.state.superlativeMilestones).toEqual({});
    expect(guest.state.acceptedTropeProposers).toEqual({});
  });

  it('does not award exclusive first-bingo or first-wager milestones to simultaneous winners', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.state.players[guest.myId].board = [...host.state.players[host.myId].board];
    host.client.setWager([0]);
    host.client.startGame();
    await flush();
    host.client.state.players[guest.myId].wagered = [0];
    for (const index of [0, 1, 2, 3, 4]) {
      host.client.claim(index);
      await flush();
      guest.client.vote(host.state.pendingClaim.claimId, true);
      await flush();
    }
    for (const player of Object.values(host.state.players)) {
      const metrics = getSuperlativeMetrics(player, host.state);
      expect(metrics.bingos).toBe(1);
      expect(metrics.firstBingo).toBe(false);
      expect(metrics.firstWagerHit).toBe(false);
    }
    expect(
      Object.values(getPlayerSuperlatives(Object.values(host.state.players), host.state)).some((award) =>
        ['First Bingo', 'First Wager Achieved', 'Pattern Hunter'].includes(award.name),
      ),
    ).toBe(false);
    expect(guest.state.superlativeMilestones).toEqual(host.state.superlativeMilestones);
  });

  it('records both simultaneous bingo lines again after the completing trope is undone and reaccepted', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    const marked = [1, 2, 3, 4, 5, 10, 15, 20];
    host.client.state.players[host.myId].marked = marked;
    host.client.state.acceptedTropes = marked.map((index) => host.state.players[host.myId].board[index]);

    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    const original = host.state.bingoEvents.filter((event) => event.playerId === host.myId);
    expect(original.map((event) => event.count)).toEqual([1, 2]);
    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(getSuperlativeMetrics(host.state.players[host.myId], host.state).bingos).toBe(0);
    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    const events = host.state.bingoEvents.filter((event) => event.playerId === host.myId);
    expect(events).toHaveLength(4);
    expect(events.slice(-2).map((event) => event.count)).toEqual([1, 2]);
    expect(new Set(events.map((event) => event.id)).size).toBe(4);
    expect(guest.state.bingoEvents).toEqual(host.state.bingoEvents);
  });

  it('records a different newly completed line even when its bingo total matches a historical total', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    const player = host.client.state.players[host.myId];
    player.marked = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    host.client.state.acceptedTropes = player.marked.map((index) => player.board[index]);
    host.client.state.bingoEvents = [{ id: 'old-first-row', playerId: host.myId, count: 1, ts: 0 }];
    host.client.claim(0);
    await flush();
    expect(getSuperlativeMetrics(player, host.state).bingos).toBe(0);
    host.client.claim(9);
    await flush();
    expect(getSuperlativeMetrics(player, host.state).bingos).toBe(1);
    expect(host.state.bingoEvents).toHaveLength(2);
    expect(host.state.bingoEvents.at(-1)).toMatchObject({ playerId: host.myId, count: 1 });
    expect(host.state.bingoEvents.at(-1).id).not.toBe('old-first-row');
  });

  it('shares explicitly selected optional trope presets in the game pool and snapshots', async () => {
    const host = makeTrackedClient();
    const chosen = ['A continuity error', 'Unconvincing visual effects'];
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25, chosen);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    expect(guest.state.tropePool).toEqual(expect.arrayContaining(chosen));
    expect(GameClient.getSavedSnapshot(code).state.tropePool).toEqual(expect.arrayContaining(chosen));
    expect(guest.state.tropePool).not.toContain('A woman is called a bitch');
  });

  it('queues different observations, merges duplicates and keeps sanitized scene context', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    const [first, second, third] = host.state.players[host.myId].board;
    host.client.claim(0, { note: '  Kitchen scene  ', timestamp: '12:34' });
    await flush();
    guest.client.proposeAccept(second, { note: 'B'.repeat(300), timestamp: 'wrong' });
    await flush();
    host.client.claim(1, { note: 'Same observation', timestamp: '00:12:35' });
    guest.client.proposeAccept(third);
    await flush();
    expect(host.state.pendingClaim.text).toBe(first);
    expect(host.state.pendingClaim.sceneContexts[0]).toMatchObject({ note: 'Kitchen scene', timestamp: '12:34' });
    expect(guest.state.claimQueue).toHaveLength(2);
    expect(host.state.claimQueue[0].proposedBy).toEqual([guest.myId, host.myId]);
    expect(host.state.claimQueue[0].sceneContexts[0].note).toHaveLength(240);
    expect(host.state.claimQueue[0].sceneContexts[0].timestamp).toBe('');
    guest.client.withdrawQueuedClaim(host.state.claimQueue[1].id);
    await flush();
    expect(host.state.claimQueue).toHaveLength(1);
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(host.state.acceptedTropes).toEqual(expect.arrayContaining([first, second]));
    expect(host.state.claimQueue).toEqual([]);
    expect(host.state.claimHistory).toHaveLength(2);
    expect(guest.state.claimHistory).toEqual(host.state.claimHistory);
    expect(GameClient.getSavedSnapshot(code).state.claimHistory[0].sceneContexts[0].note).toBe('Kitchen scene');
  });

  it('advances queued proposals on cancellation and rejects overflowing submissions visibly', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    host.client.claim(0);
    await flush();
    for (const index of [1, 2, 3, 4, 5, 6]) guest.client.proposeAccept(host.state.players[host.myId].board[index]);
    await flush();
    expect(host.state.claimQueue).toHaveLength(5);
    expect(guest.events.some((event) => event.type === 'proposalRejected')).toBe(true);
    const next = host.state.claimQueue[0].text;
    host.client.cancelClaim(host.state.pendingClaim.claimId);
    await flush();
    expect(guest.state.pendingClaim.text).toBe(next);
    expect(guest.state.claimQueue).toHaveLength(4);
    host.client.resetGame(['horror'], [], false, { horror: 50 }, 25);
    await flush();
    expect(guest.state.claimQueue).toEqual([]);
    expect(guest.state.claimHistory).toEqual([]);
  });

  it('retains a disconnected players queued observation and does not let others withdraw it', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    host.client.claim(0);
    await flush();
    guest.client.proposeAccept(host.state.players[host.myId].board[1]);
    await flush();
    const queueId = host.state.claimQueue[0].id;
    host.client.withdrawQueuedClaim(queueId);
    await flush();
    expect(host.state.claimQueue).toHaveLength(1);
    guest.client.destroy();
    host.client.state.players[guest.myId].connected = false;
    host.client.cancelClaim(host.state.pendingClaim.claimId);
    await flush();
    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.claimQueue[0].id).toBe(queueId);
    host.client.state.players[guest.myId].connected = true;
    host.client._drainClaimQueue();
    await flush();
    expect(host.state.pendingClaim.byId).toBe(guest.myId);
  });

  it('keeps the reconnect avatar in sync with profile changes', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    expect(GameClient.getSavedSession().avatar).toBe(host.state.players[host.myId].avatar);
    host.client.changeAvatar('🍿');
    await flush();
    expect(GameClient.getSavedSession()).toMatchObject({ name: 'Alice', avatar: '🍿' });
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
    const originalSupabase = guest.client.supabase;
    guest.client.supabase = {
      ...originalSupabase,
      channel: () => ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      }),
      removeChannel,
      functions: {
        async invoke(_name, { body }) {
          if (body.operation === 'join')
            return { data: { playerId: body.requestedPlayerId, status: 'active' }, error: null };
          return originalSupabase.functions.invoke(_name, { body });
        },
      },
    };

    const assertion = expect(guest.client.joinGame('ABCD', 'Bob')).rejects.toThrow(/could not connect to the relay/i);
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('rejects hosting if the relay subscription never completes', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const originalSupabase = host.client.supabase;
    host.client.supabase = {
      ...originalSupabase,
      channel: () => ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      }),
      removeChannel: vi.fn(),
      functions: {
        async invoke(_name, { body }) {
          if (body.operation === 'create') return { data: { playerId: body.playerId }, error: null };
          return originalSupabase.functions.invoke(_name, { body });
        },
      },
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

  it('shares and snapshots successful callers, clearing their markers on undo and reset', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    const text = host.state.players[host.myId].board[0];
    host.client.toggleCall(text);
    guest.client.toggleCall(text);
    await flush();
    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    const expected = [host.myId, guest.myId].map((id) => {
      const player = host.state.players[id];
      return { id, name: player.name, avatar: player.avatar };
    });
    expect(host.state.acceptedCalls[text]).toEqual(expected);
    expect(guest.state.acceptedCalls[text]).toEqual(expected);
    expect(GameClient.getSavedSnapshot(code).state.acceptedCalls[text]).toEqual(expected);
    expect(host.state.calls[host.myId]).toBeUndefined();
    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(guest.state.acceptedCalls[text]).toBeUndefined();
    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(guest.state.acceptedCalls[text]).toBeUndefined();
    host.client.resetGame(['horror'], [], false, { horror: 50 }, 25);
    await flush();
    expect(host.state.acceptedCalls).toEqual({});
    expect(guest.state.acceptedCalls).toEqual({});
  });

  it('removes a successful-call association when the accepted trope is replaced', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    const text = host.state.players[host.myId].board[0];
    host.client.toggleCall(text);
    host.client.claim(0);
    await flush();
    expect(host.state.acceptedCalls[text]).toHaveLength(1);
    host.client._applyReplacement({ oldText: text, affectedIds: [host.myId] }, 'A fresh replacement');
    expect(host.state.acceptedCalls[text]).toBeUndefined();
  });

  it('tracks a call, lets the player withdraw it, and records a correct call on approval', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();
    const text = host.state.players[host.myId].board[0];

    host.client.toggleCall(text);
    await flush();
    expect(host.state.calls[host.myId]).toBe(text);
    expect(host.state.callStats[host.myId].made).toBe(1);

    host.client.toggleCall(text);
    await flush();
    expect(host.state.calls[host.myId]).toBeUndefined();
    expect(host.state.callHistory[host.myId]).toEqual([expect.objectContaining({ text, status: 'withdrawn' })]);

    host.client.toggleCall(text);
    host.client.claim(0);
    await flush();
    expect(host.state.calls[host.myId]).toBeUndefined();
    expect(host.state.callStats[host.myId]).toMatchObject({ made: 2, correct: 1 });
    expect(host.state.callHistory[host.myId].map((entry) => entry.status)).toEqual(['withdrawn', 'scored']);
  });

  it('replicates and snapshots changed, scored, and replaced calls, then clears history on reset', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    const [first, second, third] = host.state.players[host.myId].board;
    host.client.toggleCall(first);
    host.client.toggleCall(second);
    await flush();
    expect(guest.state.callHistory[host.myId].map((call) => call.status)).toEqual(['changed', 'active']);
    host.client.claim(1);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(guest.state.callHistory[host.myId][1]).toMatchObject({ text: second, status: 'scored' });
    host.client.claim(1);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, true);
    await flush();
    expect(host.state.callHistory[host.myId][1].status).toBe('scored');
    host.client.toggleCall(third);
    host.client._applyReplacement({ oldText: third, affectedIds: [host.myId] }, 'Replacement trope');
    await host.client._send({ t: 'state', state: host.client.state });
    await flush();
    expect(guest.state.callHistory[host.myId][2]).toMatchObject({ text: third, status: 'replaced' });
    expect(GameClient.getSavedSnapshot(code).state.callHistory).toEqual(host.state.callHistory);
    host.client.resetGame(['horror'], [], false, { horror: 50 }, 25);
    await flush();
    expect(host.state.callHistory).toEqual({});
    expect(guest.state.callHistory).toEqual({});
  });

  it('notifies every missed caller on acceptance while preserving calls until they choose to drop them', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    const winner = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await winner.client.joinGame(code, 'Carol');
    host.client.startGame();
    await flush();
    const [hostCall, guestCall, accepted] = host.state.players[host.myId].board;
    host.client.toggleCall(hostCall);
    guest.client.toggleCall(guestCall);
    winner.client.toggleCall(accepted);
    await flush();

    winner.client.claim(winner.state.players[winner.myId].board.indexOf(accepted));
    await flush();
    host.client.vote(host.state.pendingClaim.claimId, true);
    await flush();

    for (const participant of [host, guest, winner]) {
      const event = participant.events.findLast((entry) => entry.type === 'claimResolved');
      expect(event.missedCalls).toEqual(
        expect.arrayContaining([
          { playerId: host.myId, text: hostCall },
          { playerId: guest.myId, text: guestCall },
        ]),
      );
      expect(event.missedCalls).toHaveLength(2);
      expect(participant.state.calls[host.myId]).toBe(hostCall);
      expect(participant.state.calls[guest.myId]).toBe(guestCall);
      expect(participant.state.calls[winner.myId]).toBeUndefined();
      expect(participant.state.callStats[winner.myId].correct).toBe(1);
    }

    host.client.toggleCall(hostCall);
    await flush();
    expect(guest.state.calls[host.myId]).toBeUndefined();
    expect(guest.state.calls[guest.myId]).toBe(guestCall);
  });

  it('does not flag missed calls for rejected claims or approved unmarks', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    host.client.toggleCall(host.state.players[host.myId].board[0]);
    host.client.claim(1);
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, false);
    await flush();
    expect(guest.events.findLast((entry) => entry.type === 'claimResolved').missedCalls).toEqual([]);

    host.client.claim(1);
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();
    host.client.claim(1);
    await flush();
    guest.client.vote(guest.state.pendingClaim.claimId, true);
    await flush();
    expect(guest.events.findLast((entry) => entry.type === 'claimResolved')).toMatchObject({
      kind: 'unmark',
      approved: true,
      missedCalls: [],
    });
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

    expect(host.events.filter((event) => event.type === 'relayError')).toEqual([]);
    expect(host.state.started).toBe(true);
    expect(guest.state.started).toBe(true);
  });

  it('shares cached IMDb details from setup, snapshots them, and preserves them on host updates', async () => {
    const host = makeTrackedClient();
    const movie = {
      title: 'Example Show',
      year: '2024',
      type: 'series',
      poster: 'https://example.com/poster.jpg',
      imdbID: 'tt1234',
      director: 'A Director',
      actors: 'An Actor',
      genres: ['drama'],
      unmapped: [],
      subgenreSelections: [{ genre: 'drama', subgenre: 'family-drama' }],
    };
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25, [], {}, {}, movie);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    expect(guest.state.movie).toEqual(movie);
    expect(GameClient.getSavedSnapshot(code).state.movie).toEqual(movie);
    guest.client.updateMovie({ title: 'Unauthorized title', poster: null });
    await flush();
    expect(host.state.movie.title).toBe('Example Show');
    host.client.updateMovie({ ...movie, title: 'Updated Show' });
    await flush();
    expect(guest.state.movie).toMatchObject({ ...movie, title: 'Updated Show' });
    host.client.updateMovie({ title: 'Manual title', poster: null });
    await flush();
    expect(guest.state.movie).toMatchObject({
      title: 'Manual title',
      poster: null,
      imdbID: null,
      director: null,
      actors: null,
      genres: [],
    });
  });

  it('updates movie theme metadata without changing the active board configuration', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const originalBoard = [...host.state.players[host.myId].board];

    host.client.updateMovie({
      title: 'Example Show',
      type: 'series',
      genres: ['drama', 'tv'],
      subgenreSelections: [{ genre: 'drama', subgenre: 'family-drama' }],
    });
    await flush();

    expect(host.state.movie).toMatchObject({
      title: 'Example Show',
      themeGenres: ['drama', 'tv'],
      themeSubgenreSelections: [{ genre: 'drama', subgenre: 'family-drama' }],
    });
    expect(host.state.genres).toEqual(['horror']);
    expect(host.state.players[host.myId].board).toEqual(originalBoard);
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
    const hostResolved = host.events.find((e) => e.type === 'claimResolved' && e.approved);
    const guestResolved = guest.events.find((e) => e.type === 'claimResolved' && e.approved);
    expect(hostResolved.approvedBy.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    expect(guestResolved.approvedBy.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    const aliceAvatar = host.state.players[host.myId].avatar;
    const bobAvatar = host.state.players[guest.myId].avatar;
    expect(hostResolved.approvedBy).toEqual([
      { id: host.myId, name: 'Alice', avatar: aliceAvatar },
      { id: guest.myId, name: 'Bob', avatar: bobAvatar },
    ]);
    expect(guestResolved.approvedBy).toEqual(hostResolved.approvedBy);
    expect(host.state.activityLog.at(-1).text).toContain(`Approved by ${aliceAvatar} Alice and ${bobAvatar} Bob.`);
    const recordedText = host.state.activityLog.at(-1).text;
    guest.client.changeAvatar(bobAvatar === '🎬' ? '🍿' : '🎬');
    await flush();
    expect(host.state.activityLog.at(-1).text).toBe(recordedText);
  });

  it('shares anonymous decline rationale totals with every player after a rejected claim', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, false, 'Not clear enough');
    await flush();

    const hostResult = host.events.find((event) => event.type === 'claimResolved' && !event.approved);
    const guestResult = guest.events.find((event) => event.type === 'claimResolved' && !event.approved);
    expect(hostResult.disagreeRationaleCounts).toEqual({ 'Not clear enough': 1 });
    expect(guestResult.disagreeRationaleCounts).toEqual({ 'Not clear enough': 1 });
    expect(hostResult.disagreeRationaleCounts).not.toHaveProperty(guest.myId);
    const entry = host.state.activityLog.at(-1);
    expect(entry.text).toContain(`${host.state.players[host.myId].avatar} Alice proposed "${hostResult.text}"`);
    expect(entry.text).toContain('did not reach majority approval. Reasons: Not clear enough (1).');
    expect(entry.text).not.toContain('Bob');
    expect(guest.state.activityLog.at(-1)).toEqual(entry);
    expect(host.state.acceptedTropes).not.toContain(hostResult.text);
  });

  it.each([
    ['mark', false, 'as happened'],
    ['mark', true, 'as a custom trope'],
    ['unmark', false, 'unmarking'],
    ['replace', false, 'replacing'],
  ])('logs unaccepted %s proposals (custom: %s) with no supplied reasons', async (kind, custom, wording) => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    const text = host.state.players[host.myId].board[0];
    host.client._startClaim(host.myId, text, kind, { custom });
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, false);
    await flush();
    const entry = host.state.activityLog.at(-1);
    expect(entry.text).toContain(wording);
    expect(entry.text).toContain(`"${text}"`);
    expect(entry.text).toContain('did not reach majority approval. No decline reasons were provided.');
    expect(guest.state.activityLog.at(-1)).toEqual(entry);
  });

  it('logs a trope proposal that times out without enough votes as unaccepted, not declined by a voter', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    host.client.startGame();
    await flush();
    host.client.claim(0);
    await flush();
    host.client._resolveClaim(host.state.pendingClaim.claimId);
    await flush();
    expect(host.state.activityLog.at(-1).text).toContain(
      'did not reach majority approval. No decline reasons were provided.',
    );
    expect(guest.state.activityLog.at(-1)).toEqual(host.state.activityLog.at(-1));
    expect(host.state.acceptedTropes).toEqual([]);
  });

  it('keeps a submitted vote and its anonymous rationale immutable', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    const third = makeTrackedClient();
    await third.client.joinGame(code, 'Charlie');
    await flush();
    host.client.startGame();
    await flush();

    host.client.claim(0);
    await flush();
    const claimId = host.state.pendingClaim.claimId;
    guest.client.vote(claimId, false, 'Not on screen');
    guest.client.vote(claimId, true);
    await flush();

    expect(host.state.pendingClaim.votes[guest.myId]).toBe(false);
    expect(host.state.pendingClaim.disagreeRationaleCounts).toEqual({ 'Not on screen': 1 });
    expect(host.state.pendingClaim.disagreeRationaleCounts).not.toHaveProperty(guest.myId);
    third.client.vote(claimId, false);
    await flush();

    const result = host.events.find((event) => event.type === 'claimResolved' && !event.approved);
    expect(result.disagreeRationaleCounts).toEqual({ 'Not on screen': 1 });
  });

  it('sends an empty rationale summary when a claim is declined without reasons', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    host.client.claim(0);
    await flush();
    guest.client.vote(host.state.pendingClaim.claimId, false);
    await flush();

    const result = host.events.find((event) => event.type === 'claimResolved' && !event.approved);
    expect(result.disagreeRationaleCounts).toEqual({});
  });

  it('only counts swap-specific rationales on a trope swap vote', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    const third = makeTrackedClient();
    await third.client.joinGame(code, 'Charlie');
    await flush();
    host.client.startGame();
    await flush();

    host.client.proposeReplace(host.state.players[host.myId].board[0], 'horror', 'general');
    await flush();
    const claimId = host.state.pendingClaim.claimId;
    guest.client.vote(claimId, false, 'Not on screen');
    third.client.vote(claimId, false, 'It could still happen');
    await flush();

    const result = host.events.find((event) => event.type === 'claimResolved' && !event.approved);
    expect(result.disagreeRationaleCounts).toEqual({ 'It could still happen': 1 });
  });

  it('merges simultaneous proposals for the same trope as automatic approvals', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    const hostText = host.state.players[host.myId].board[0];
    const guestIndex = guest.state.players[guest.myId].board.indexOf(hostText);
    host.client.claim(0);
    await flush();
    guest.client.claim(guestIndex);
    await flush();

    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.acceptedTropes).toContain(hostText);
    const resolved = host.events.find((event) => event.type === 'claimResolved' && event.approved);
    expect(resolved.proposedBy).toEqual([host.myId, guest.myId]);
    expect(host.state.activityLog.some((entry) => entry.text.includes('also proposed'))).toBe(true);
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
    await waitForRelayEvent(latecomer, 'joinApproved');

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
    await waitForRelayEvent(latecomer, 'joinDenied');

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
    await waitForRelayEvent(latecomer, 'joinDenied');

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

  it('does not allow an accepted trope to be proposed for replacement', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 40);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.startGame();
    await flush();

    const oldText = host.state.players[host.myId].board[0];
    host.client.state.acceptedTropes = [oldText];

    host.client.proposeReplace(oldText, 'horror', 'general');
    await flush();
    expect(host.state.pendingClaim).toBeNull();
    expect(host.state.pendingReplacement).toBeNull();
  });

  it('rejects a stale concurrent co-host snapshot and restores the committed winner', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    host.client.addHost(guest.myId);
    await flush();

    const expectedRevision = host.client.state.serverRevision;
    expect(guest.client.state.serverRevision).toBe(expectedRevision);
    const winningState = structuredClone(host.client.state);
    winningState.players[host.myId].name = 'Alice concurrent update';
    const staleState = structuredClone(guest.client.state);
    staleState.players[guest.myId].name = 'Bob stale update';

    const [winningResult, staleResult] = await Promise.all([
      host.client._send({ t: 'state', state: winningState }),
      guest.client._send({ t: 'state', state: staleState }),
    ]);
    await flush();

    expect(winningResult).toMatchObject({ ok: true, revision: expectedRevision + 1 });
    expect(staleResult).toBeNull();
    expect(guest.events.some((event) => event.type === 'stateConflict')).toBe(true);
    expect(host.client.state.players[host.myId].name).toBe('Alice concurrent update');
    expect(host.client.state.players[guest.myId].name).toBe('Bob');
    expect(guest.client.state).toEqual(host.client.state);
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

    // The host drops, but the authenticated guest does not inherit host rights.
    host.client.channel.simulateDrop();
    guest.client._markDisconnected(hostId);
    await flush();
    expect(guest.state.players[hostId].connected).toBe(false);
    expect(guest.client.isHost()).toBe(false);

    sessionStorage.setItem('movie-bingo-session', hostSession);
    const returning = makeTrackedClient();
    returning.setAuthUserId(host.authUserId);
    await returning.client.rejoinGame();
    await flush();

    expect(returning.state.players[hostId].connected).toBe(true);
    expect(returning.client.isHost()).toBe(true);
    expect(guest.client.isHost()).toBe(false);
  });

  it('restores an active claim prompt when a player reconnects mid-vote', async () => {
    const { host, guest } = await twoPlayerGame();
    const text = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await flush();
    expect(host.state.pendingClaim?.text).toBe(text);

    guest.client.destroy();
    const returning = makeTrackedClient();
    returning.setAuthUserId(guest.authUserId);
    await returning.client.rejoinGame();

    expect(returning.state.pendingClaim?.text).toBe(text);
    expect(returning.state.pendingClaim?.kind).toBe('mark');
    expect(returning.state.pendingClaim?.votes[host.myId]).toBe(true);
  });

  it('keeps the same channel when realtime-js rejoins it by itself after a blip', async () => {
    const { host } = await twoPlayerGame();
    const channel = host.client.channel;
    vi.useFakeTimers();

    channel.simulateStatus('CHANNEL_ERROR');
    expect(host.events.at(-1)).toEqual({ type: 'connectionStatus', status: 'disconnected' });
    expect(host.client._reconnectTimer).not.toBeNull();

    channel.simulateStatus('SUBSCRIBED');
    expect(host.events.at(-1)).toEqual({ type: 'connectionStatus', status: 'connected' });
    expect(host.client._reconnectTimer).toBeNull();

    await vi.advanceTimersByTimeAsync(30000);
    expect(host.client.channel).toBe(channel);
  });

  it('can pause automatic reconnect attempts and resume them on demand', async () => {
    const host = makeTrackedClient();
    host.client.state = { players: { [host.client.myId]: { id: host.client.myId } } };
    host.client.code = 'ABCD';
    host.client.channel = { state: 'closed' };
    host.client._reconnect = vi.fn();

    vi.useFakeTimers();
    host.client._scheduleReconnect();
    expect(host.client._reconnectTimer).not.toBeNull();
    host.client.cancelReconnect();
    expect(host.client._reconnectTimer).toBeNull();

    await vi.advanceTimersByTimeAsync(20000);
    expect(host.client._reconnectTimer).toBeNull();

    host.client.retryReconnect();
    expect(host.client._reconnect).toHaveBeenCalledOnce();
    expect(host.client._reconnectPaused).toBe(false);
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
    returning.setAuthUserId(host.authUserId);
    await expect(returning.client.rejoinGame()).resolves.toBeUndefined();
    expect(returning.client.isHost()).toBe(true);
  });

  it('clears reconnect data for every player when the host ends the game', async () => {
    const { host, guest } = await twoPlayerGame();

    host.client.declareGameOver();
    await flush();

    expect(host.state.gameOver).toBe(true);
    expect(guest.state.gameOver).toBe(true);
    expect(GameClient.getSavedSession()).toBeNull();
    expect(GameClient.getSavedSnapshot()).toBeNull();
  });

  it('restarts the session expiry countdown when the host updates its lifetime', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const previousExpiry = host.state.sessionExpiresAt;

    host.client.updateSessionLifetime(true, 168);

    expect(host.state.sessionExtended).toBe(true);
    expect(host.state.sessionLifetimeHours).toBe(168);
    expect(host.state.sessionExpiresAt).toBeGreaterThan(previousExpiry);
  });

  it('lets the host resume an ended game for after-credits tropes', async () => {
    const { host, guest } = await twoPlayerGame();

    host.client.declareGameOver();
    await flush();
    expect(host.state.gameOver).toBe(true);
    expect(GameClient.getSavedSession()).toBeNull();

    host.client.resumeGame();
    await flush();

    expect(host.state.gameOver).toBe(false);
    expect(guest.state.gameOver).toBe(false);
    expect(host.events.some((event) => event.type === 'gameResumed')).toBe(true);
    expect(guest.events.some((event) => event.type === 'gameResumed')).toBe(true);
    expect(host.state.activityLog.at(-1).text).toBe('▶️ The game was resumed for extra tropes.');
    expect(GameClient.getSavedSession()).toMatchObject({ code: host.state.code });
    expect(GameClient.getSavedSnapshot(host.state.code)?.state.gameOver).toBe(false);

    host.client.claim(0);
    await flush();
    expect(host.state.pendingClaim).not.toBeNull();
    expect(guest.state.pendingClaim?.kind).toBe('mark');
  });

  it('lets a host add another connected player as a host', async () => {
    const { host, guest } = await twoPlayerGame();

    host.client.addHost(guest.myId);
    await flush();

    expect(host.client.isHost()).toBe(true);
    expect(guest.client.isHost()).toBe(true);
    expect(guest.state.hostIds).toEqual([host.myId, guest.myId]);
    expect(guest.events).toContainEqual(
      expect.objectContaining({ type: 'hostAdded', byName: 'Alice', byAvatar: host.state.players[host.myId].avatar }),
    );
  });

  it('lets a host resign while another host remains', async () => {
    const { host, guest } = await twoPlayerGame();
    host.client.addHost(guest.myId);
    await flush();

    host.client.resignHost();
    await flush();

    expect(host.client.isHost()).toBe(false);
    expect(guest.client.isHost()).toBe(true);
    expect(guest.state.hostIds).toEqual([guest.myId]);
  });

  it('lets a newly added host add another host', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const firstGuest = makeTrackedClient();
    await firstGuest.client.joinGame(code, 'Bob');
    const secondGuest = makeTrackedClient();
    await secondGuest.client.joinGame(code, 'Charlie');
    await flush();

    host.client.addHost(firstGuest.myId);
    await flush();
    firstGuest.client.addHost(secondGuest.myId);
    await flush();

    expect(secondGuest.state.hostIds).toEqual([host.myId, firstGuest.myId, secondGuest.myId]);
    expect(secondGuest.client.isHost()).toBe(true);
  });

  it('applies a host-proposed profile change only when the target accepts it', async () => {
    const { host, guest } = await twoPlayerGame();

    host.client.proposeProfileChange(guest.myId, 'Robert', '🎬');
    await flush();
    expect(guest.state.pendingProfileChanges[guest.myId]).toMatchObject({
      name: 'Robert',
      avatar: '🎬',
      proposedBy: 'Alice',
    });
    expect(guest.state.players[guest.myId].name).toBe('Bob');

    guest.client.respondToProfileChange(true);
    await flush();
    expect(host.state.players[guest.myId]).toMatchObject({ name: 'Robert', avatar: '🎬' });
    expect(host.state.pendingProfileChanges[guest.myId]).toBeUndefined();
  });

  it('leaves a player profile unchanged when they decline a host proposal', async () => {
    const { host, guest } = await twoPlayerGame();
    const originalProfile = {
      name: host.state.players[guest.myId].name,
      avatar: host.state.players[guest.myId].avatar,
    };

    host.client.proposeProfileChange(guest.myId, 'Robert', '🎬');
    await flush();
    guest.client.respondToProfileChange(false);
    await flush();

    expect(host.state.players[guest.myId]).toMatchObject(originalProfile);
    expect(host.state.pendingProfileChanges[guest.myId]).toBeUndefined();
  });

  it('allows a non-coordinator host to perform host-only actions', async () => {
    const { host, guest } = await twoPlayerGame();
    host.client.addHost(guest.myId);
    await flush();

    guest.client.resetGame(['comedy'], [], false, { comedy: 50 }, 25);
    await flush();

    expect(host.state.genres).toEqual(['comedy']);
    expect(guest.state.genres).toEqual(['comedy']);
    expect(host.state.started).toBe(false);
  });

  it('does not overwrite a co-host snapshot committed first at the same server revision', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    const observer = makeTrackedClient();
    await observer.client.joinGame(code, 'Casey');
    await flush();
    expect(observer.client.channel?.state).toBe('joined');
    expect(observer.myId).not.toBe(guest.myId);
    const observerMessages = vi.spyOn(observer.client, '_onMessage');
    host.client.addHost(guest.myId);
    await flush();
    const expectedRevision = host.client.state.serverRevision;
    expect(guest.client.state.serverRevision).toBe(expectedRevision);

    host.client.state.players[host.myId].name = 'Winning host snapshot';
    const staleGuestSnapshot = structuredClone(guest.client.state);
    staleGuestSnapshot.players[guest.myId].name = 'Stale co-host snapshot';
    const [winner, stale] = await Promise.all([
      host.client._send({ t: 'state', state: host.client.state }),
      guest.client._send({ t: 'state', state: staleGuestSnapshot }),
    ]);
    await flush();

    expect(winner).toMatchObject({ ok: true, revision: expectedRevision + 1 });
    expect(stale).toBeNull();
    expect(observerMessages).toHaveBeenCalledWith(expect.objectContaining({ t: 'stateConflict' }));
    expect(guest.events.some((event) => event.type === 'stateConflict')).toBe(true);
    expect(observer.events).toContainEqual({ type: 'stateConflict' });
    expect(host.state.players[host.myId].name).toBe('Winning host snapshot');
    expect(host.state.players[guest.myId].name).toBe('Bob');
    expect(guest.state).toEqual(host.state);
    expect(observer.state).toEqual(host.state);
  });

  it('records completed marathon scores when the host resets a started game', async () => {
    const host = makeTrackedClient();
    await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    await flush();
    host.client.state.acceptedTropes = [host.client.state.players[host.myId].board[0]];
    host.client.state.players[host.myId].marked = [0];

    host.client.resetGame(['horror'], [], false, { horror: 50 }, 25, [], {}, {}, null);
    await flush();

    expect(host.state.marathon.watches).toHaveLength(1);
    expect(host.state.marathon.watches[0].players[0]).toMatchObject({
      id: host.myId,
      tropes: 1,
      bingos: 0,
      wagerHits: 0,
    });
    expect(host.state.marathon.watches[0].players[0]).not.toHaveProperty('points');
    expect(host.state.started).toBe(false);
  });

  it('does not allow the final host to resign', async () => {
    const { host } = await twoPlayerGame();

    host.client.resignHost();
    await flush();

    expect(host.state.hostIds).toEqual([host.myId]);
    expect(host.client.isHost()).toBe(true);
  });

  it('restores a disconnected board onto a new seat and removes the abandoned seat', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Host', ['horror'], [], false, { horror: 50 }, 25);
    const oldPlayer = makeTrackedClient();
    await oldPlayer.client.joinGame(code, 'Casey');
    const replacement = makeTrackedClient();
    await replacement.client.joinGame(code, 'Casey');
    await flush();
    host.client.startGame();
    await flush();

    const oldId = oldPlayer.myId;
    const newId = replacement.myId;
    const oldSeat = host.state.players[oldId];
    const newSeat = host.state.players[newId];
    oldSeat.connected = false;
    oldSeat.marked = [0, 4];
    oldSeat.wagered = [3];
    host.client.state.calls[oldId] = oldSeat.board[5];
    host.client.state.callStats[oldId] = { made: 2, correct: 1 };
    host.client.state.callHistory[oldId] = [
      { id: 'old-scored', text: oldSeat.board[0], status: 'scored' },
      { id: 'old-active', text: oldSeat.board[5], status: 'active' },
    ];
    host.client.state.acceptedCalls[oldSeat.board[0]] = [{ id: oldId, name: oldSeat.name, avatar: oldSeat.avatar }];
    const originalBoard = [...oldSeat.board];
    const replacementName = newSeat.name;
    const replacementAvatar = newSeat.avatar;

    host.client.restoreDisconnectedBoard(newId, oldId);
    await flush();

    expect(host.state.players[oldId]).toBeUndefined();
    expect(host.state.seatOrder).not.toContain(oldId);
    expect(host.state.players[newId]).toMatchObject({
      name: replacementName,
      avatar: replacementAvatar,
      board: originalBoard,
      marked: [0, 4],
      wagered: [3],
    });
    expect(host.state.calls[newId]).toBe(originalBoard[5]);
    expect(host.state.calls[oldId]).toBeUndefined();
    expect(host.state.callStats[newId]).toEqual({ made: 2, correct: 1 });
    expect(host.state.callHistory[newId].map((call) => call.status)).toEqual(['scored', 'active']);
    expect(host.state.callHistory[oldId]).toBeUndefined();
    expect(host.state.acceptedCalls[originalBoard[0]][0].id).toBe(newId);
  });

  it('uses Reconnect, not a new Join, to reclaim a disconnected seat', async () => {
    const { host, guest } = await twoPlayerGame();
    const guestId = guest.myId;

    guest.client.channel.simulateDrop();
    host.client._markDisconnected(guestId);
    await flush();

    expect(host.state.players[guestId].connected).toBe(false);

    const returning = makeTrackedClient();
    returning.setAuthUserId(guest.authUserId);
    returning.client.myId = guestId;
    await returning.client.rejoinGame();
    await flush();

    expect(returning.state.players[guestId].connected).toBe(true);
    expect(returning.state.players[guestId].name).toBe('Bob');
    expect(returning.myId).toBe(guestId);
  });

  it('does not let a new Join reuse a fabricated occupied player ID', async () => {
    const { host, guest, code } = await twoPlayerGame();
    const attacker = makeTrackedClient();
    attacker.client.myId = host.myId;

    const result = await attacker.client.joinGame(code, 'Impersonator');
    await flush();

    expect(result.needsApproval).toBe(true);
    expect(attacker.myId).not.toBe(host.myId);
    expect(host.state.players[host.myId].name).toBe('Alice');
    expect(guest.state.players[guest.myId].name).toBe('Bob');
    expect(host.state.pendingJoinRequest.id).toBe(attacker.myId);
  });

  it('rejoins a disconnected seat only for the same authenticated player identity', async () => {
    const { host, guest } = await twoPlayerGame();
    const guestId = guest.myId;

    guest.client.channel.simulateDrop();
    host.client._markDisconnected(guestId);
    await flush();

    const returning = makeTrackedClient();
    returning.setAuthUserId(guest.authUserId);
    returning.client.myId = guestId;
    await returning.client.rejoinGame();
    await flush();

    expect(returning.state.players[guestId].connected).toBe(true);
    expect(returning.state.players[guestId].name).toBe('Bob');
  });

  it('creates a separate seat when two tabs share the same Auth identity', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const secondTab = makeTrackedClient();
    secondTab.setAuthUserId(host.authUserId);

    await expect(secondTab.client.joinGame(code, 'Bob in another tab')).resolves.toEqual({ needsChoice: false });
    await flush();

    expect(secondTab.myId).not.toBe(host.myId);
    expect(Object.keys(host.state.players)).toHaveLength(2);
    expect(host.state.players[secondTab.myId].name).toBe('Bob in another tab');
    expect(secondTab.state.serverRevision).toBe(host.state.serverRevision);
    expect(secondTab.state.players).toEqual(host.state.players);
    expect(host.state.players[secondTab.myId].avatar).toBe(secondTab.state.players[secondTab.myId].avatar);

    secondTab.client.changeAvatar('👽');
    await flush();
    expect(host.state.players[secondTab.myId].avatar).toBe('👽');
    expect(secondTab.state.players[secondTab.myId].avatar).toBe('👽');
  });

  it('reconnects the same authenticated seat during the disconnect grace period', async () => {
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
    returning.setAuthUserId(guest.authUserId);
    returning.client.myId = guest.myId;
    const joinAttempt = returning.client.rejoinGame();
    await vi.advanceTimersByTimeAsync(50);

    await expect(joinAttempt).resolves.toBeUndefined();
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

  it('rejects state publication by a non-host even when the client fabricates a higher revision', async () => {
    const { host, guest } = await twoPlayerGame();

    // A local snapshot claiming the host is gone must not grant guest authority.
    guest.client.state.players[host.myId].connected = false;
    expect(guest.client.isHost()).toBe(false);
    expect(host.client.isHost()).toBe(true);

    await guest.client._send({ t: 'state', state: guest.client.state });
    await flush();

    expect(host.client.isHost()).toBe(true);
    expect(guest.client.isHost()).toBe(false);
    expect(host.state.players[host.myId].connected).toBe(true);
    expect(guest.events.some((event) => event.type === 'relayError')).toBe(true);
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

  it('restores the server-authoritative room when nobody is left connected', async () => {
    vi.useFakeTimers();
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    host.client.startGame();
    const claimedText = host.state.players[host.myId].board[0];
    host.client.claim(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(host.state.acceptedTropes).toContain(claimedText);

    // The host disconnects, while the server retains the last trusted state.
    host.client.destroy();

    const returning = makeTrackedClient();
    returning.setAuthUserId(host.authUserId);
    const rejoin = returning.client.rejoinGame();
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
    stale.gameOver = true;
    stale.rev = Number.MAX_SAFE_INTEGER;

    await guest.client._send({ t: 'state', state: stale });
    await flush();

    expect(host.state.started).toBe(true);
    expect(host.state.gameOver).toBe(false);
    expect(guest.state.started).toBe(true);
    expect(guest.events.some((event) => event.type === 'relayError')).toBe(true);
  });

  it('rejects host-only actions forged by a guest using the host player id', async () => {
    const host = makeTrackedClient();
    const code = await host.client.hostGame('Alice', ['horror'], [], false, { horror: 50 }, 25);
    const guest = makeTrackedClient();
    await guest.client.joinGame(code, 'Bob');
    await flush();
    const originalGenres = [...host.state.genres];

    await guest.client._send({
      t: 'action',
      from: host.myId,
      action: { t: 'reset', genres: ['comedy'], subgenreSelections: [], freeSpace: false },
    });
    await flush();

    expect(host.state.genres).toEqual(originalGenres);
    expect(guest.events.some((event) => event.type === 'relayError')).toBe(true);
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
