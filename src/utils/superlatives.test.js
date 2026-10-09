import { describe, expect, it } from 'vitest';
import {
  getAllSuperlatives,
  getPlayerSuperlative,
  getPlayerSuperlatives,
  getSuperlativeMetrics,
  getBadgeProgress,
  createBadgeAchievementTracker,
} from './superlatives.js';

const gameState = { acceptedTropes: [], freeSpace: false, players: {} };
const player = { id: 'p1', board: Array.from({ length: 25 }, (_, index) => `Trope ${index}`), marked: [], wagered: [] };

const evidenceCases = [
  [
    'Most Thoughtful',
    { views: 3, submissions: 1, viewedTropeCount: 2 },
    { views: 10, submissions: 2, viewedTropeCount: 5 },
  ],
  ['Definition Detective', { viewedTropeCount: 3 }, { viewedTropeCount: 4 }],
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
  ['Board Cartographer', { viewedTropeCount: 2 }, { viewedTropeCount: 3 }],
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
  [
    'Brave Caller',
    { activityTracked: false, submissions: 1, views: 0 },
    { activityTracked: true, submissions: 1, views: 0 },
  ],
  ['Curious Mind', { viewedTropeCount: 7 }, { viewedTropeCount: 8 }],
  ['Blackout', { accepted: 24, playableSpaces: 25 }, { accepted: 25, playableSpaces: 25 }],
  ['Trope Scout', { acceptedProposals: 0 }, { acceptedProposals: 1 }],
  ['Scene Spotter', { acceptedProposals: 1 }, { acceptedProposals: 2 }],
  ['Scene Sleuth', { acceptedProposals: 4 }, { acceptedProposals: 5 }],
  ['Team Player', { otherApprovalVotes: 0 }, { otherApprovalVotes: 1 }],
  ['Watch Party MVP', { otherApprovalVotes: 7 }, { otherApprovalVotes: 8 }],
  ['Consensus Captain', { otherApprovalVotes: 14 }, { otherApprovalVotes: 15 }],
  ['Trope Explorer', { viewedTropeCount: 1 }, { viewedTropeCount: 2 }],
  ['Trope Librarian', { viewedTropeCount: 14 }, { viewedTropeCount: 15 }],
  ['Trope Scholar', { viewedTropeCount: 24 }, { viewedTropeCount: 25 }],
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
  it('shows accurate progress toward a stronger milestone', () => {
    const state = { ...gameState, players: { p1: player }, superlativeStats: { p1: { otherApprovalVotes: 2 } } };
    expect(getBadgeProgress(player, state)[0]).toMatchObject({ name: 'Consensus Builder', value: 2, target: 3 });
    const current = getPlayerSuperlatives([player], state).p1;
    expect(
      getBadgeProgress(player, state).every((goal) => {
        const definition = getAllSuperlatives().find((award) => award.id === goal.id);
        return (
          definition.stage > current.stage ||
          (definition.stage === current.stage && definition.priority > current.priority)
        );
      }),
    ).toBe(true);
  });

  it('includes stronger same-tier reading and wagering goals', () => {
    const reading = {
      ...gameState,
      players: { p1: player },
      superlativeStats: { p1: { viewedTropes: player.board.slice(0, 2) } },
    };
    expect(getBadgeProgress(player, reading)[0]).toMatchObject({ name: 'Board Cartographer', value: 2, target: 3 });
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

  it('offers starter milestones and no higher milestone after blackout', () => {
    expect(getBadgeProgress(player, gameState).map((goal) => goal.name)).toEqual([
      'Trope Scout',
      'Team Player',
      'Trope Explorer',
    ]);
    const evolved = { ...player, marked: Array.from({ length: 25 }, (_, index) => index) };
    expect(getBadgeProgress(evolved, { ...gameState, acceptedTropes: player.board, players: { p1: evolved } })).toEqual(
      [],
    );
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
    const state = { ...gameState, serverRevision: 1, players: { p1: player }, superlativeStats: { p1: {} } };
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

  it('provides at least 50 distinctions', () => {
    expect(getAllSuperlatives().length).toBeGreaterThanOrEqual(50);
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
    const award = getPlayerSuperlative({ ...player, marked: [0, 1, 2, 3] }, almostBingoState);
    expect(award.name).toBe('Bingo Chaser');
    expect(award.metrics.almostBingos).toBe(1);
  });

  it('recognizes the player closest to a total blackout', () => {
    const accepted = Array.from({ length: 24 }, (_, index) => `Trope ${index}`);
    const blackoutState = { ...gameState, acceptedTropes: accepted };
    const award = getPlayerSuperlative(
      { ...player, marked: Array.from({ length: 24 }, (_, index) => index) },
      blackoutState,
    );
    expect(award.name).toBe('Blackout Bound');
    expect(award.metrics.acceptedRatio).toBe(0.96);
  });

  it('assigns only qualified awards without inventing one for every player', () => {
    const players = [
      player,
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p3', marked: [0, 5, 10] },
    ];
    const state = { ...gameState, acceptedTropes: player.board.slice(0, 5) };
    const awards = Object.values(getPlayerSuperlatives(players, state));
    expect(new Set(awards.map((award) => award.id)).size).toBe(awards.length);
  });

  it('never awards a most-bingos distinction when the lead is tied', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4] },
    ];
    const awards = getPlayerSuperlatives(players, { ...gameState, acceptedTropes: player.board.slice(0, 5) });
    expect(Object.values(awards).some((award) => award.name === 'Pattern Hunter')).toBe(false);
    for (const award of Object.values(awards)) expect(award.qualifies(award.metrics)).toBe(true);
  });

  it('uses only shared activity metrics regardless of viewer-local statistics or player order', () => {
    const players = [
      { ...player, id: 'p1', seat: 0 },
      { ...player, id: 'p2', seat: 1 },
    ];
    const state = {
      ...gameState,
      superlativeStats: {
        p1: { views: 10, submissions: 2, viewedTropes: player.board.slice(0, 7) },
        p2: { views: 6, submissions: 2, viewedTropes: player.board.slice(0, 5) },
      },
    };
    const first = getPlayerSuperlatives(players, state, { p1: { views: 100 } });
    const second = getPlayerSuperlatives([...players].reverse(), state, { p2: { views: 100 } });
    expect(Object.fromEntries(Object.entries(first).map(([id, award]) => [id, award.name]))).toEqual(
      Object.fromEntries(Object.entries(second).map(([id, award]) => [id, award.name])),
    );
    expect(first.p1.name).toBe('Most Thoughtful');
    expect(first.p2.name).not.toBe('Most Thoughtful');
  });

  it('never fills missing awards with an unqualified distinction', () => {
    const players = Array.from({ length: 40 }, (_, index) => ({ ...player, id: `p${index}`, seat: index }));
    const awards = Object.values(getPlayerSuperlatives(players, gameState));
    expect(awards).toEqual([]);
  });

  it('reserves most-bingos recognition for a genuinely higher total', () => {
    const players = [
      { ...player, id: 'p1', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];
    const awards = getPlayerSuperlatives(players, { ...gameState, acceptedTropes: player.board.slice(0, 10) });
    expect(awards.p2.name).toBe('Double Feature');
    expect(awards.p1?.name).not.toBe('Pattern Hunter');
  });

  it('does not pick an arbitrary comparative reading winner when exploration ties', () => {
    const players = [
      { ...player, id: 'p1' },
      { ...player, id: 'p2' },
    ];
    const state = {
      ...gameState,
      superlativeStats: {
        p1: { views: 10, submissions: 2, viewedTropes: player.board.slice(0, 5) },
        p2: { views: 10, submissions: 2, viewedTropes: player.board.slice(0, 5) },
      },
    };
    expect(
      Object.values(getPlayerSuperlatives(players, state)).some((award) =>
        ['Most Thoughtful', 'Definition Detective', 'Curious Mind'].includes(award.name),
      ),
    ).toBe(false);
  });

  it('does not turn a first shared acceptance into badges for every board', () => {
    const players = [
      { ...player, id: 'p1', marked: [0] },
      { ...player, id: 'p2', marked: [0] },
    ];
    const state = { ...gameState, acceptedTropes: ['Trope 0'], superlativeMilestones: { p1: { firstAccepted: true } } };
    const awards = getPlayerSuperlatives(players, state);
    expect(Object.keys(awards)).toEqual(['p1']);
    expect(awards.p1.name).toBe('First Trope Accepted');
  });

  it('recognizes a truthful setup achievement before the movie has any acceptances', () => {
    expect(getPlayerSuperlatives([{ ...player, wagered: [0, 1, 2, 3, 4] }], gameState).p1.name).toBe('Full House');
    const state = { ...gameState, superlativeStats: { p1: { views: 20, viewedTropes: ['Trope 0'] } } };
    expect(getPlayerSuperlatives([player], state)).toEqual({});
    const setupReading = {
      ...gameState,
      superlativeStats: { p1: { views: 5, viewedTropes: player.board.slice(0, 5) } },
    };
    expect(getPlayerSuperlatives([{ ...player, wagered: [0, 1, 2, 3, 4] }], setupReading).p1.name).toBe('Full House');
  });

  it('allows every player to receive a genuinely earned non-comparative achievement', () => {
    const players = [
      { ...player, id: 'p1', wagered: [0, 1, 2, 3, 4] },
      { ...player, id: 'p2', wagered: [0, 1, 2, 3, 4] },
    ];
    const awards = getPlayerSuperlatives(players, gameState);
    expect(awards.p1.name).toBe('Full House');
    expect(awards.p2.name).toBe('Full House');
  });

  it('lets multiple-bingo and blackout achievements supersede lighter early badges, even at the end', () => {
    const evolved = { ...player, marked: Array.from({ length: 15 }, (_, index) => index), wagered: [0, 1, 2, 3, 4] };
    const state = {
      ...gameState,
      gameOver: true,
      acceptedTropes: player.board.slice(0, 15),
      superlativeMilestones: { p1: { firstBingo: true } },
    };
    expect(getPlayerSuperlative(evolved, state).name).toBe('Trophy Hunter');
    expect(
      getPlayerSuperlative(
        { ...player, marked: Array.from({ length: 25 }, (_, index) => index) },
        { ...state, acceptedTropes: player.board },
      ).name,
    ).toBe('Blackout');
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

  it('does not choose a most-thoughtful winner when genuine ratios tie despite different activity totals', () => {
    const state = {
      ...gameState,
      superlativeStats: {
        p1: { views: 8, submissions: 2, viewedTropes: player.board.slice(0, 6) },
        p2: { views: 12, submissions: 3, viewedTropes: player.board.slice(0, 9) },
      },
    };
    expect(
      Object.values(
        getPlayerSuperlatives(
          [
            { ...player, id: 'p1' },
            { ...player, id: 'p2' },
          ],
          state,
        ),
      ).some((award) => award.name === 'Most Thoughtful'),
    ).toBe(false);
  });

  it('does not boost a reading award by repeatedly reopening the same definitions', () => {
    const state = {
      ...gameState,
      superlativeStats: {
        p1: { views: 100, submissions: 2, viewedTropes: player.board.slice(0, 5) },
        p2: { views: 5, submissions: 2, viewedTropes: player.board.slice(0, 5) },
      },
    };
    expect(
      Object.values(
        getPlayerSuperlatives(
          [
            { ...player, id: 'p1' },
            { ...player, id: 'p2' },
          ],
          state,
        ),
      ).some((award) => award.name === 'Most Thoughtful'),
    ).toBe(false);
  });

  it.each([
    ['Trope Scout', 'Scene Spotter', 'Sharp Eye', 'Scene Sleuth', 'acceptedProposals', [1, 2, 3, 5]],
    ['Team Player', 'Consensus Builder', 'Watch Party MVP', 'Consensus Captain', 'otherApprovalVotes', [1, 3, 8, 15]],
  ])('upgrades %s through its earned progression', (first, second, third, fourth, metric, thresholds) => {
    const names = [first, second, third, fourth];
    for (let index = 0; index < thresholds.length; index++) {
      const state = { ...gameState, superlativeStats: { p1: { [metric]: thresholds[index] } } };
      expect(getPlayerSuperlatives([player], state).p1.name).toBe(names[index]);
    }
  });

  it('upgrades successful predictions and lets a complete blackout supersede them', () => {
    for (const [correct, name] of [
      [1, 'Right on Cue'],
      [3, 'Prediction Pro'],
      [5, 'Crystal Ball'],
    ]) {
      const state = { ...gameState, callStats: { p1: { made: correct, correct } } };
      expect(getPlayerSuperlatives([player], state).p1.name).toBe(name);
    }
    const state = { ...gameState, acceptedTropes: player.board, callStats: { p1: { correct: 5 } } };
    expect(
      getPlayerSuperlatives([{ ...player, marked: Array.from({ length: 25 }, (_, index) => index) }], state).p1.name,
    ).toBe('Blackout');
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
    const awards = getPlayerSuperlatives(players, state);
    expect(Object.keys(awards)).toHaveLength(6);
    expect(awards.p0.name).toBe('Trope Scout');
    for (const entry of players.slice(1, 6)) expect(awards[entry.id].name).toBe('Team Player');
    for (const entry of players.slice(6)) expect(awards[entry.id]).toBeUndefined();
  });

  it('upgrades exploration based on different definitions rather than repeated clicks', () => {
    for (const [count, name] of [
      [2, 'Trope Explorer'],
      [3, 'Board Cartographer'],
      [8, 'Curious Mind'],
      [15, 'Trope Librarian'],
      [25, 'Trope Scholar'],
    ]) {
      const state = {
        ...gameState,
        superlativeStats: { p1: { views: 100, viewedTropes: player.board.slice(0, count) } },
      };
      expect(getPlayerSuperlatives([player], state).p1.name).toBe(name);
      expect(getPlayerSuperlative(player, state).name).toBe(name);
    }
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
      const awards = getPlayerSuperlatives(evolved, state);
      expect(awards.p1.name).toBe(name);
      expect(awards.p2.name).toBe(name);
    }
  });

  it('keeps a stronger achievement when a lighter one is earned afterward', () => {
    const state = { ...gameState, superlativeStats: { p1: { acceptedProposals: 5, otherApprovalVotes: 1 } } };
    expect(getPlayerSuperlatives([player], state).p1.name).toBe('Scene Sleuth');
  });

  it('does not award prediction badges for unsuccessful or untracked calls', () => {
    const state = { ...gameState, callStats: { p1: { made: 20, correct: 0 } } };
    expect(getPlayerSuperlatives([player], state)).toEqual({});
    expect(getPlayerSuperlatives([player], gameState)).toEqual({});
  });
});
