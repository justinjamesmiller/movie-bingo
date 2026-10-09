import { describe, expect, it } from 'vitest';
import {
  getAllSuperlatives,
  getPlayerAwards,
  getPlayerSuperlative,
  getPlayerSuperlatives,
  getLatestPlayerAwards,
  recordAwardTransitions,
  getSuperlativeMetrics,
  getBadgeProgress,
  createBadgeAchievementTracker,
} from './superlatives.js';

const gameState = { acceptedTropes: [], freeSpace: false, players: {} };
const player = { id: 'p1', board: Array.from({ length: 25 }, (_, index) => `Trope ${index}`), marked: [], wagered: [] };

const evidenceCases = [
  ['First Bingo', { firstBingo: false }, { firstBingo: true }],
  ['First Trope Accepted', { firstAccepted: false }, { firstAccepted: true }],
  ['First Wager Achieved', { firstWagerHit: false }, { firstWagerHit: true }],
  ['Blackout Bound', { acceptedRatio: 0.79 }, { acceptedRatio: 0.8 }],
  ['Most Almost-Bingos', { accepted: 5, almostBingos: 1 }, { accepted: 5, almostBingos: 2 }],
  ['Most Scattered Board', { accepted: 4, bingos: 0 }, { accepted: 5, bingos: 0 }],
  ['Bingo Chaser', { accepted: 2, nearestLineMissing: 1 }, { accepted: 3, nearestLineMissing: 1 }],
  ['Pattern Hunter', { bingos: 1 }, { bingos: 2 }],
  ['Acceptance Magnet', { accepted: 5 }, { accepted: 6 }],
  ['Wager Whisperer', { wagerHits: 1 }, { wagerHits: 2 }],
  ['Wager Architect', { wagers: 5, wagerHits: 2 }, { wagers: 5, wagerHits: 3 }],
  ['Clean Sweep', { wagers: 2, wagerHits: 2 }, { wagers: 3, wagerHits: 3 }],
  ['Wager In Progress', { wagers: 5, wagerHits: 1 }, { wagers: 5, wagerHits: 2 }],
  ['Most Decisive', { submissions: 3 }, { submissions: 4 }],
  ['Most Helpful', { otherApprovalVotes: 4 }, { otherApprovalVotes: 5 }],
  ['Comeback Captain', { acceptedAfterRejection: 1 }, { acceptedAfterRejection: 2 }],
  ['Most Correct Calls', { correctCalls: 2 }, { correctCalls: 3 }],
  ['Call Accuracy Ace', { callsMade: 5, correctCalls: 2 }, { callsMade: 5, correctCalls: 3 }],
  ['Wager Winner', { wagerHits: 2 }, { wagerHits: 3 }],
  ['Best Wager Rate', { wagers: 3, wagerHits: 1 }, { wagers: 3, wagerHits: 2 }],
  ['Most Accepted Proposals', { acceptedProposals: 3 }, { acceptedProposals: 4 }],
  ['Most Rejected Proposals', { rejections: 2 }, { rejections: 3 }],
  ['Row Captain', { completedRows: 0 }, { completedRows: 1 }],
  ['Diagonal Dazzler', { completedDiagonals: 0 }, { completedDiagonals: 1 }],
  ['Corner Collector', { acceptedCorners: 2 }, { acceptedCorners: 3 }],
  ['Consensus Builder', { approvalVotes: 20, otherApprovalVotes: 2 }, { otherApprovalVotes: 3 }],
  [
    'Quiet Achiever',
    { activityTracked: true, accepted: 4, submissions: 1 },
    { activityTracked: true, accepted: 5, submissions: 1 },
  ],
  ['Comeback Kid', { acceptedAfterRejection: 0 }, { acceptedAfterRejection: 1 }],
  ['Hot Streak', { recentHits: 2 }, { recentHits: 3 }],
  ['Marking Momentum', { accepted: 9 }, { accepted: 10 }],
  ['The Finisher', { gameOver: false, bingos: 1 }, { gameOver: true, bingos: 1 }],
  ['Full House', { wagers: 4 }, { wagers: 5 }],
  ['Trophy Hunter', { bingos: 2 }, { bingos: 3 }],
  ['Sharp Eye', { acceptedProposals: 2 }, { acceptedProposals: 3 }],
  [
    'Patient Player',
    { activityTracked: true, accepted: 4, submissions: 0 },
    { activityTracked: true, accepted: 5, submissions: 0 },
  ],
  [
    'Variety Champion',
    { accepted: 6, acceptedRows: 4, acceptedColumns: 4 },
    { accepted: 7, acceptedRows: 4, acceptedColumns: 4 },
  ],
  ['Unflappable', { marksAfterRejection: 2 }, { marksAfterRejection: 3 }],
  ['First Mover', { firstProposal: false }, { firstProposal: true }],
  [
    'Last Word',
    { gameOver: true, totalAccepted: 4, lastAcceptedByMe: true },
    { gameOver: true, totalAccepted: 5, lastAcceptedByMe: true },
  ],
  ['Blackout', { accepted: 24, playableSpaces: 25 }, { accepted: 25, playableSpaces: 25 }],
  ['Trope Scout', { acceptedProposals: 0 }, { acceptedProposals: 1 }],
  ['Scene Spotter', { acceptedProposals: 1 }, { acceptedProposals: 2 }],
  ['Scene Sleuth', { acceptedProposals: 4 }, { acceptedProposals: 5 }],
  ['Team Player', { otherApprovalVotes: 0 }, { otherApprovalVotes: 1 }],
  ['Watch Party MVP', { otherApprovalVotes: 7 }, { otherApprovalVotes: 8 }],
  ['Consensus Captain', { otherApprovalVotes: 14 }, { otherApprovalVotes: 15 }],
  ['On a Roll', { accepted: 2 }, { accepted: 3 }],
  ['Scene Collector', { accepted: 7 }, { accepted: 8 }],
  ['Bingo Buddy', { bingos: 0 }, { bingos: 1 }],
  ['Double Feature', { bingos: 1 }, { bingos: 2 }],
  ['Lucky Pick', { wagerHits: 0 }, { wagerHits: 1 }],
  ['Right on Cue', { correctCalls: 0 }, { correctCalls: 1 }],
  ['Prediction Pro', { correctCalls: 2 }, { correctCalls: 3 }],
  ['Crystal Ball', { correctCalls: 4 }, { correctCalls: 5 }],
];

describe('superlatives', () => {
  it('shows independent progress toward the next unearned badge in each track', () => {
    const state = { ...gameState, players: { p1: player }, superlativeStats: { p1: { otherApprovalVotes: 2 } } };
    expect(getBadgeProgress(player, state)[0]).toMatchObject({ name: 'Consensus Builder', value: 2, target: 3 });
    expect(
      getBadgeProgress(player, state).every(
        (goal) =>
          !getAllSuperlatives()
            .find((award) => award.id === goal.id)
            .qualifies(getSuperlativeMetrics(player, state)),
      ),
    ).toBe(true);
  });

  it('does not offer explanation-view milestones and retains wager progress', () => {
    const reading = {
      ...gameState,
      players: { p1: player },
      superlativeStats: { p1: { views: 100, submissions: 2, viewedTropes: player.board } },
    };
    expect(getPlayerAwards([player], reading).p1.badges).toEqual([]);
    expect(getPlayerAwards([player], reading).p1.superlatives).toEqual([]);
    expect(getBadgeProgress(player, reading).some((goal) => goal.label === 'Different explanations explored')).toBe(
      false,
    );
    const tracker = createBadgeAchievementTracker();
    const live = {
      ...gameState,
      started: true,
      serverRevision: 1,
      players: { p1: player },
      superlativeStats: { p1: {} },
    };
    expect(tracker.update(live)).toEqual([]);
    live.serverRevision = 2;
    live.superlativeStats.p1 = { views: 100, submissions: 2, viewedTropes: player.board };
    expect(tracker.update(live)).toEqual([]);
    const wagerer = { ...player, wagered: [0, 1, 2, 3, 4], marked: [0] };
    const state = { ...gameState, players: { p1: wagerer }, acceptedTropes: ['Trope 0'] };
    expect(getBadgeProgress(wagerer, state)[0]).toMatchObject({ name: 'Wager Whisperer', value: 1, target: 2 });
    const sparse = { ...player, wagered: [0, 1], marked: [0, 1] };
    expect(
      getBadgeProgress(sparse, { ...state, players: { p1: sparse }, acceptedTropes: player.board.slice(0, 2) }).some(
        (goal) => goal.name === 'Clean Sweep',
      ),
    ).toBe(false);
  });

  it('offers starter milestones and stops completed badge tracks after blackout', () => {
    expect(getBadgeProgress(player, gameState).map((goal) => goal.name)).toEqual([
      'Trope Scout',
      'Team Player',
      'On a Roll',
    ]);
    const evolved = { ...player, marked: Array.from({ length: 25 }, (_, index) => index) };
    const progress = getBadgeProgress(evolved, {
      ...gameState,
      acceptedTropes: player.board,
      players: { p1: evolved },
    });
    expect(progress.some((goal) => goal.label === 'Accepted board spaces')).toBe(false);
  });

  it('baselines existing badges, announces new upgrades once, and survives code rotation', () => {
    const tracker = createBadgeAchievementTracker();
    const state = {
      ...gameState,
      code: 'ABCD',
      started: true,
      players: { p1: player },
      superlativeStats: { p1: { otherApprovalVotes: 1 } },
    };
    expect(tracker.update(state)).toEqual([]);
    state.superlativeStats.p1.otherApprovalVotes = 3;
    expect(tracker.update(state)).toEqual([
      expect.objectContaining({ playerId: 'p1', badgeName: 'Consensus Builder' }),
    ]);
    expect(tracker.update({ ...state, code: 'EFGH' })).toEqual([]);
    state.superlativeStats.p1.otherApprovalVotes = 1;
    expect(tracker.update(state)).toEqual([]);
    state.superlativeStats.p1.otherApprovalVotes = 3;
    expect(tracker.update(state)).toEqual([]);
  });

  it('waits for committed revisions instead of announcing optimistic or stale changes', () => {
    const tracker = createBadgeAchievementTracker();
    const state = {
      ...gameState,
      serverRevision: 1,
      started: true,
      players: { p1: player },
      superlativeStats: { p1: {} },
    };
    tracker.update(state);
    state.superlativeStats.p1.otherApprovalVotes = 1;
    expect(tracker.update(state)).toEqual([]);
    expect(tracker.update({ ...state, serverRevision: 0 })).toEqual([]);
    state.serverRevision = 2;
    expect(tracker.update(state)[0].badgeName).toBe('Team Player');
    expect(tracker.update(state)).toEqual([]);
  });

  it('silently seeds new seats and permits new achievements after a watch reset', () => {
    const tracker = createBadgeAchievementTracker();
    const state = { ...gameState, started: true, players: { p1: player }, superlativeStats: { p1: {} } };
    tracker.update(state);
    state.superlativeStats.p1.otherApprovalVotes = 1;
    expect(tracker.update(state)[0].badgeName).toBe('Team Player');
    state.players.p2 = { ...player, id: 'p2' };
    state.superlativeStats.p2 = { otherApprovalVotes: 8 };
    expect(tracker.update(state)).toEqual([]);
    tracker.update({ ...state, started: false, superlativeStats: {} });
    expect(tracker.update(state)[0].badgeName).toBe('Team Player');
  });

  it('does not announce a setup badge, then announces gameplay awards', () => {
    const tracker = createBadgeAchievementTracker();
    const setupPlayer = { ...player, wagered: [] };
    const state = {
      ...gameState,
      serverRevision: 1,
      started: false,
      players: { p1: setupPlayer },
      superlativeStats: { p1: {} },
    };
    expect(tracker.update(state)).toEqual([]);
    setupPlayer.wagered = [0, 1, 2, 3, 4];
    state.serverRevision = 2;
    expect(tracker.update(state)).toEqual([]);
    state.started = true;
    state.serverRevision = 3;
    expect(tracker.update(state)).toEqual([]);
    state.superlativeStats.p1.otherApprovalVotes = 1;
    state.serverRevision = 4;
    expect(tracker.update(state)).toContainEqual(expect.objectContaining({ badgeName: 'Team Player' }));
  });

  it('has an evidence-boundary check for every award', () => {
    expect(new Set(evidenceCases.map(([name]) => name))).toEqual(
      new Set(getAllSuperlatives().map((award) => award.name)),
    );
  });

  it.each(evidenceCases)('%s stays hidden until its evidence threshold is met', (name, insufficient, earned) => {
    const definition = getAllSuperlatives().find((award) => award.name === name);
    const baseline = getSuperlativeMetrics(player, gameState);
    expect(definition.qualifies({ ...baseline, ...insufficient })).toBe(false);
    expect(definition.qualifies({ ...baseline, ...earned })).toBe(true);
  });

  it('keeps the reduced award set free of browsing-only titles', () => {
    expect(getAllSuperlatives()).toHaveLength(54);
    expect(getAllSuperlatives().filter((award) => award.kind === 'superlative')).toHaveLength(20);
    expect(getAllSuperlatives().map((award) => award.name)).not.toEqual(
      expect.arrayContaining([
        'Most Thoughtful',
        'Definition Detective',
        'Board Cartographer',
        'Curious Mind',
        'Trope Explorer',
        'Trope Librarian',
        'Trope Scholar',
        'Brave Caller',
      ]),
    );
  });

  it('shows no distinction without evidence rather than giving a participation badge', () => {
    expect(getPlayerSuperlative(player, gameState)).toBeNull();
    expect(getPlayerSuperlatives([player], gameState)).toEqual({});
  });

  it('recognizes a bingo-based distinction', () => {
    const state = { ...gameState, acceptedTropes: ['Trope 0', 'Trope 1', 'Trope 2', 'Trope 3', 'Trope 4'] };
    const award = getPlayerSuperlative({ ...player, marked: [0, 1, 2, 3, 4] }, state, {}, { firstBingo: true });
    expect(['First Bingo', 'Pattern Hunter', 'The Finisher']).toContain(award.name);
  });

  it('recognizes a line that needs exactly one more accepted trope', () => {
    const almostBingoState = { ...gameState, acceptedTropes: ['Trope 0', 'Trope 1', 'Trope 2', 'Trope 3'] };
    const awards = getPlayerAwards([{ ...player, marked: [0, 1, 2, 3] }], almostBingoState).p1;
    expect(awards.badges.map((award) => award.name)).toContain('Bingo Chaser');
    expect(awards.badges.find((award) => award.name === 'Bingo Chaser').metrics.almostBingos).toBe(1);
  });

  it('recognizes the player closest to a total blackout', () => {
    const accepted = Array.from({ length: 24 }, (_, index) => `Trope ${index}`);
    const blackoutState = { ...gameState, acceptedTropes: accepted };
    const awards = getPlayerAwards(
      [{ ...player, marked: Array.from({ length: 24 }, (_, index) => index) }],
      blackoutState,
    ).p1;
    const award = awards.badges.find((entry) => entry.name === 'Blackout Bound');
    expect(award).toBeDefined();
    expect(award.metrics.acceptedRatio).toBe(0.96);
  });

  it('awards shared badges to every qualified player without inventing distinctions', () => {
    const players = [
      player,
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p3', marked: [0, 5, 10] },
    ];
    const state = { ...gameState, acceptedTropes: player.board.slice(0, 5) };
    const awards = getPlayerAwards(players, state);
    expect(awards.p2.badges.map((award) => award.name)).toContain('Bingo Buddy');
    expect(awards.p1.badges).toEqual([]);
    expect(awards.p3.badges).toEqual([]);
  });

  it('shares Pattern Hunter when players tie, but awards no first-bingo superlative', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];
    const awards = getPlayerAwards(players, { ...gameState, acceptedTropes: player.board.slice(0, 10) });
    for (const id of ['p1', 'p2']) {
      expect(awards[id].badges.map((award) => award.name)).toContain('Pattern Hunter');
      expect(awards[id].superlatives.some((award) => award.name === 'First Bingo')).toBe(false);
    }
  });

  it('never fills missing awards with an unqualified distinction', () => {
    const players = Array.from({ length: 40 }, (_, index) => ({ ...player, id: `p${index}`, seat: index }));
    const awards = getPlayerAwards(players, gameState);
    expect(Object.values(awards).every(({ badges, superlatives }) => !badges.length && !superlatives.length)).toBe(
      true,
    );
  });

  it('reserves most-bingos recognition for a genuinely higher total', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];
    const awards = getPlayerAwards(players, { ...gameState, acceptedTropes: player.board.slice(0, 10) });
    expect(awards.p2.badges.map((award) => award.name)).toEqual(
      expect.arrayContaining(['Double Feature', 'Pattern Hunter']),
    );
    expect(awards.p1.badges.map((award) => award.name)).not.toContain('Pattern Hunter');
  });

  it('does not pick an arbitrary almost-bingo superlative winner when tied', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 5, 6, 7, 8] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 5, 6, 7, 8] },
    ];
    const state = { ...gameState, acceptedTropes: players[0].board.slice(0, 9) };
    expect(
      Object.values(getPlayerSuperlatives(players, state))
        .flat()
        .some((award) => award.name === 'Most Almost-Bingos'),
    ).toBe(false);
  });

  it('does not turn a first shared acceptance into badges for every board', () => {
    const players = [
      { ...player, id: 'p1', marked: [0] },
      { ...player, id: 'p2', marked: [0] },
    ];
    const state = { ...gameState, acceptedTropes: ['Trope 0'], superlativeMilestones: { p1: { firstAccepted: true } } };
    const awards = getPlayerAwards(players, state);
    expect(awards.p1.superlatives.map((award) => award.name)).toContain('First Trope Accepted');
    expect(awards.p2.superlatives.map((award) => award.name)).not.toContain('First Trope Accepted');
  });

  it('recognizes a truthful setup achievement before the movie has any acceptances', () => {
    expect(
      getPlayerAwards([{ ...player, wagered: [0, 1, 2, 3, 4] }], gameState).p1.badges.map((award) => award.name),
    ).toContain('Full House');
    const state = { ...gameState, superlativeStats: { p1: { views: 20, viewedTropes: ['Trope 0'] } } };
    expect(getPlayerAwards([player], state).p1.superlatives).toEqual([]);
    const setupReading = {
      ...gameState,
      superlativeStats: { p1: { views: 5, viewedTropes: player.board.slice(0, 5) } },
    };
    expect(
      getPlayerAwards([{ ...player, wagered: [0, 1, 2, 3, 4] }], setupReading).p1.badges.map((award) => award.name),
    ).toContain('Full House');
  });

  it('allows every player to receive a genuinely earned non-comparative achievement', () => {
    const players = [
      { ...player, id: 'p1', wagered: [0, 1, 2, 3, 4] },
      { ...player, id: 'p2', wagered: [0, 1, 2, 3, 4] },
    ];
    const awards = getPlayerAwards(players, gameState);
    expect(awards.p1.badges.map((award) => award.name)).toContain('Full House');
    expect(awards.p2.badges.map((award) => award.name)).toContain('Full House');
  });

  it('lets multiple-bingo and blackout achievements supersede lighter early badges, even at the end', () => {
    const evolved = { ...player, marked: Array.from({ length: 15 }, (_, index) => index), wagered: [0, 1, 2, 3, 4] };
    const state = {
      ...gameState,
      gameOver: true,
      acceptedTropes: player.board.slice(0, 15),
      superlativeMilestones: { p1: { firstBingo: true } },
    };
    const awards = getPlayerAwards([evolved], state).p1;
    expect(awards.superlatives.map((award) => award.name)).toContain('First Bingo');
    expect(awards.badges.map((award) => award.name)).toEqual(
      expect.arrayContaining(['Pattern Hunter', 'Trophy Hunter']),
    );
    const blackoutAwards = getPlayerAwards([{ ...player, marked: Array.from({ length: 25 }, (_, index) => index) }], {
      ...state,
      acceptedTropes: player.board,
    }).p1.badges;
    expect(blackoutAwards.map((award) => award.name)).toContain('Blackout');
    expect(blackoutAwards.map((award) => award.name)).not.toContain('Blackout Bound');
  });

  it('only awards Last Word to the proposer, at the end of a sufficiently established watch', () => {
    const state = {
      ...gameState,
      gameOver: true,
      acceptedTropes: player.board.slice(0, 5),
      acceptedTropeProposers: { 'Trope 4': ['p1'] },
    };
    const definition = getAllSuperlatives().find((award) => award.name === 'Last Word');
    expect(definition.qualifies(getSuperlativeMetrics(player, state))).toBe(true);
    expect(definition.qualifies(getSuperlativeMetrics({ ...player, id: 'p2' }, state))).toBe(false);
    expect(definition.qualifies(getSuperlativeMetrics(player, { ...state, gameOver: false }))).toBe(false);
  });

  it('does not invent accepted-board evidence from marked but unaccepted spaces or the free space', () => {
    const metrics = getSuperlativeMetrics(
      { ...player, marked: [0, 1, 2, 3, 4, 12] },
      { ...gameState, freeSpace: true },
    );
    expect(metrics.accepted).toBe(0);
    expect(metrics.bingos).toBe(0);
    expect(metrics.almostBingos).toBe(0);
    expect(getPlayerSuperlative({ ...player, marked: [12] }, { ...gameState, freeSpace: true })).toBeNull();
  });

  it('moves a dynamic superlative when the sole almost-bingo leader changes', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 5, 6, 7, 8] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13] },
    ];
    const state = {
      ...gameState,
      acceptedTropes: players[1].board.slice(0, 19),
      players: Object.fromEntries(players.map((entry) => [entry.id, entry])),
    };
    expect(getPlayerAwards(players, state).p2.superlatives.map((award) => award.name)).toContain('Most Almost-Bingos');
    expect(getPlayerAwards(players, state).p1.superlatives.map((award) => award.name)).not.toContain(
      'Most Almost-Bingos',
    );

    players[0].marked = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18];
    state.players.p1 = players[0];
    const next = getPlayerAwards(players, state);
    expect(next.p1.superlatives.map((award) => award.name)).toContain('Most Almost-Bingos');
    expect(next.p2.superlatives.map((award) => award.name)).not.toContain('Most Almost-Bingos');
  });

  it('allows players to share badges while holding a distinct exclusive superlative', () => {
    const first = {
      ...player,
      id: 'p1',
      wagered: [0, 1, 2, 14, 20],
      marked: [...Array(14).keys(), 15, 16, 17, 18],
    };
    const second = { ...player, id: 'p2', wagered: [0, 1, 2, 14, 20], marked: [...Array(10).keys()] };
    const acceptedIndexes = [...Array(14).keys(), 15, 16, 17, 18];
    const state = {
      ...gameState,
      players: { p1: first, p2: second },
      acceptedTropes: acceptedIndexes.map((i) => player.board[i]),
    };
    const awards = getPlayerAwards([first, second], state);

    expect(awards.p1.superlatives.map((award) => award.name)).toContain('Most Almost-Bingos');
    expect(awards.p2.superlatives.map((award) => award.name)).not.toContain('Most Almost-Bingos');
    for (const id of ['p1', 'p2']) {
      expect(awards[id].badges.map((award) => award.name)).toEqual(
        expect.arrayContaining(['Wager Architect', 'Pattern Hunter']),
      );
    }
  });

  it('selects the most recently earned current badge and superlative', () => {
    const wagerer = { ...player, wagered: [0, 1, 2, 3, 4] };
    const state = {
      ...gameState,
      players: { p1: wagerer },
      superlativeStats: { p1: { acceptedProposals: 1 } },
      superlativeMilestones: { p1: { firstAccepted: true } },
      acceptedTropes: ['Trope 0'],
      awardHistory: { p1: { 'full-house': 100, 'trope-scout': 200, 'first-trope-accepted': 150 } },
    };
    expect(getLatestPlayerAwards([wagerer], state).p1).toMatchObject({
      badge: { name: 'Trope Scout' },
      superlative: { name: 'First Trope Accepted' },
    });
  });

  it('records newly qualified awards once and keeps their shared timestamps stable', () => {
    const wagerer = { ...player, wagered: [0, 1, 2, 3, 4] };
    const before = { ...gameState, players: { p1: wagerer }, acceptedTropes: [] };
    const after = { ...before, awardHistory: {} };
    recordAwardTransitions(before, after, 100);
    expect(after.awardHistory.p1['full-house']).toBe(100);
    recordAwardTransitions(after, after, 200);
    expect(after.awardHistory.p1['full-house']).toBe(100);
  });

  it('awards Blackout Bound to every player who reaches the threshold', () => {
    const players = [
      { ...player, id: 'p1', marked: [...Array(20).keys()] },
      { ...player, id: 'p2', marked: [...Array(20).keys()] },
    ];
    const state = { ...gameState, acceptedTropes: player.board.slice(0, 20) };
    const awards = getPlayerAwards(players, state);
    for (const id of ['p1', 'p2']) {
      expect(awards[id].badges.map((award) => award.name)).toContain('Blackout Bound');
    }
  });

  it('does not award badges or superlatives for browsing even with many proposal views', () => {
    const state = {
      ...gameState,
      superlativeStats: {
        p1: { views: 100, submissions: 2, viewedTropes: player.board.slice(0, 5) },
        p2: { views: 5, submissions: 2, viewedTropes: player.board.slice(0, 5) },
      },
    };
    const players = [
      { ...player, id: 'p1' },
      { ...player, id: 'p2' },
    ];
    const awards = getPlayerAwards(players, state);
    for (const id of ['p1', 'p2']) {
      expect(awards[id].badges).toEqual([]);
      expect(awards[id].superlatives).toEqual([]);
      expect(
        getBadgeProgress(
          players.find((entry) => entry.id === id),
          state,
        ).map((goal) => goal.label),
      ).not.toContain('Different explanations explored');
    }
  });

  it.each([
    ['Trope Scout', 'Scene Spotter', 'Sharp Eye', 'Scene Sleuth', 'acceptedProposals', [1, 2, 3, 5]],
    ['Team Player', 'Consensus Builder', 'Watch Party MVP', 'Consensus Captain', 'otherApprovalVotes', [1, 3, 8, 15]],
  ])('upgrades %s through its earned progression', (first, second, third, fourth, metric, thresholds) => {
    const names = [first, second, third, fourth];
    for (let index = 0; index < thresholds.length; index++) {
      const state = { ...gameState, superlativeStats: { p1: { [metric]: thresholds[index] } } };
      const earned = getPlayerAwards([player], state).p1.badges.map((award) => award.name);
      expect(earned).toContain(names[index]);
      if (index > 0) expect(earned).not.toContain(names[index - 1]);
    }
  });

  it('upgrades successful predictions and lets a complete blackout supersede them', () => {
    for (const [correct, name] of [
      [1, 'Right on Cue'],
      [3, 'Prediction Pro'],
      [5, 'Crystal Ball'],
    ]) {
      const state = { ...gameState, callStats: { p1: { made: correct, correct } } };
      expect(getPlayerAwards([player], state).p1.badges.map((award) => award.name)).toContain(name);
    }
    const state = { ...gameState, acceptedTropes: player.board, callStats: { p1: { correct: 5 } } };
    expect(
      getPlayerAwards([{ ...player, marked: Array.from({ length: 25 }, (_, index) => index) }], state).p1.badges.map(
        (award) => award.name,
      ),
    ).toContain('Blackout');
  });

  it('offers more ten-player awards for real contributions without awarding idle players', () => {
    const players = Array.from({ length: 10 }, (_, index) => ({ ...player, id: `p${index}`, seat: index }));
    const state = {
      ...gameState,
      superlativeStats: Object.fromEntries(
        players
          .slice(0, 6)
          .map((entry, index) => [entry.id, index === 0 ? { acceptedProposals: 1 } : { otherApprovalVotes: 1 }]),
      ),
    };
    const awards = getPlayerAwards(players, state);
    expect(awards.p0.badges.map((award) => award.name)).toContain('Trope Scout');
    for (const entry of players.slice(1, 6))
      expect(awards[entry.id].badges.map((award) => award.name)).toContain('Team Player');
    for (const entry of players.slice(6)) expect(awards[entry.id].badges).toEqual([]);
  });

  it('upgrades ordinary bingo achievements without requiring an exclusive lead', () => {
    const players = [
      { ...player, id: 'p1' },
      { ...player, id: 'p2' },
    ];
    for (const [count, name] of [
      [5, 'Bingo Buddy'],
      [10, 'Double Feature'],
      [15, 'Trophy Hunter'],
      [20, 'Blackout Bound'],
      [25, 'Blackout'],
    ]) {
      const state = { ...gameState, acceptedTropes: player.board.slice(0, count) };
      const evolved = players.map((entry) => ({
        ...entry,
        marked: Array.from({ length: count }, (_, index) => index),
      }));
      const awards = getPlayerAwards(evolved, state);
      expect(awards.p1.badges.map((award) => award.name)).toContain(name);
      expect(awards.p2.badges.map((award) => award.name)).toContain(name);
    }
  });

  it('retains badges from multiple achievement tracks simultaneously', () => {
    const state = { ...gameState, superlativeStats: { p1: { acceptedProposals: 5, otherApprovalVotes: 1 } } };
    expect(getPlayerAwards([player], state).p1.badges.map((award) => award.name)).toEqual(
      expect.arrayContaining(['Scene Sleuth', 'Team Player']),
    );
  });

  it('does not award prediction badges for unsuccessful or untracked calls', () => {
    const state = { ...gameState, callStats: { p1: { made: 20, correct: 0 } } };
    expect(getPlayerSuperlatives([player], state)).toEqual({});
    expect(getPlayerSuperlatives([player], gameState)).toEqual({});
  });
});
