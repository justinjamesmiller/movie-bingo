import { getAlmostCompletedLines, getCompletedLines } from './bingoLines.js';

const SUPERLATIVE_DEFINITIONS = [
  ['First Bingo', 'Completed a bingo line before anyone else.', (m) => m.firstBingo],
  ['First Trope Accepted', 'Had a trope accepted by the group before anyone else.', (m) => m.firstAccepted],
  ['First Wager Achieved', 'Had a wagered trope accepted before anyone else.', (m) => m.firstWagerHit],
  [
    'Blackout Bound',
    'Has at least 80% of playable board spaces accepted, putting a total blackout within reach.',
    (m) => m.acceptedRatio >= 0.8,
    (m) => m.acceptedRatio * 100,
  ],
  [
    'Most Almost-Bingos',
    'Has the most almost-bingo lines, with at least two lines one space away and at least five accepted tropes.',
    (m) => m.accepted >= 5 && m.almostBingos >= 2,
    (m) => m.almostBingos,
  ],
  [
    'Most Scattered Board',
    'Has at least five accepted tropes but no bingo, and is furthest from completing a line among those boards.',
    (m) => m.accepted >= 5 && !m.bingos,
  ],
  [
    'Bingo Chaser',
    'Has at least three accepted tropes and an incomplete line just one space away from bingo.',
    (m) => m.accepted >= 3 && m.nearestLineMissing === 1,
  ],
  ['Pattern Hunter', 'Completed at least two bingo lines.', (m) => m.bingos >= 2],
  [
    'Acceptance Magnet',
    'Has the most accepted tropes on their board, with at least six accepted spaces.',
    (m) => m.accepted >= 6,
  ],
  ['Wager Whisperer', 'Had at least two wagered tropes accepted.', (m) => m.wagerHits >= 2],
  [
    'Wager Architect',
    'Filled all five wager slots and has at least three of those wagers accepted.',
    (m) => m.wagers === 5 && m.wagerHits >= 3,
  ],
  [
    'Clean Sweep',
    'Every wagered trope was accepted, with at least three wagers placed.',
    (m) => m.wagers >= 3 && m.wagerHits === m.wagers,
  ],
  [
    'Wager In Progress',
    'Has at least two wager hits, with another wager still outstanding.',
    (m) => m.wagerHits >= 2 && m.wagerHits < m.wagers,
  ],
  [
    'Most Decisive',
    'Submitted more trope proposals than anyone else, with at least four proposals submitted.',
    (m) => m.submissions >= 4,
  ],
  [
    'Most Helpful',
    "Approved the most other players' claims, with at least five helpful votes.",
    (m) => m.otherApprovalVotes >= 5,
  ],
  [
    'Comeback Captain',
    'Had at least two proposals accepted after earlier rejections; this is the highest comeback count in the room.',
    (m) => m.acceptedAfterRejection >= 2,
    (m) => m.acceptedAfterRejection,
  ],
  [
    'Most Correct Calls',
    'Correctly predicted the most accepted tropes, with at least three correct calls.',
    (m) => m.correctCalls >= 3,
    (m) => m.correctCalls,
  ],
  [
    'Call Accuracy Ace',
    'Made at least five calls and got three right; this is the highest correct-call rate among eligible players.',
    (m) => m.callsMade >= 5 && m.correctCalls >= 3,
    (m) => (m.callsMade > 0 ? m.correctCalls / m.callsMade : 0),
  ],
  [
    'Wager Winner',
    'Landed at least three wagers and has the most successful wagers in the room.',
    (m) => m.wagerHits >= 3,
    (m) => m.wagerHits,
  ],
  [
    'Best Wager Rate',
    'Placed at least three wagers, hit at least two, and has the highest wager hit rate among eligible players.',
    (m) => m.wagers >= 3 && m.wagerHits >= 2,
    (m) => (m.wagers > 0 ? m.wagerHits / m.wagers : 0),
  ],
  [
    'Most Accepted Proposals',
    'Had at least four proposals accepted and led the room in accepted proposals.',
    (m) => m.acceptedProposals >= 4,
    (m) => m.acceptedProposals,
  ],
  [
    'Most Rejected Proposals',
    'Took at least three no-votes and received more rejected proposals than anyone else.',
    (m) => m.rejections >= 3,
    (m) => m.rejections,
  ],
  [
    'Row Captain',
    'Completed the most full rows, with at least one completed row.',
    (m) => m.completedRows >= 1,
    (m) => m.completedRows,
  ],
  [
    'Diagonal Dazzler',
    'Completed the most diagonal bingo lines, with at least one diagonal.',
    (m) => m.completedDiagonals >= 1,
    (m) => m.completedDiagonals,
  ],
  [
    'Corner Collector',
    'Got at least three board corners accepted and has more accepted corners than anyone else.',
    (m) => m.acceptedCorners >= 3,
    (m) => m.acceptedCorners,
  ],
  [
    'Consensus Builder',
    "Helped approve at least three other players' accepted trope claims.",
    (m) => m.otherApprovalVotes >= 3,
  ],
  [
    'Quiet Achiever',
    'Has at least five accepted tropes while making at most one proposal.',
    (m) => m.activityTracked && m.accepted >= 5 && m.submissions <= 1,
  ],
  ['Comeback Kid', 'Had a trope proposal accepted after an earlier rejection.', (m) => m.acceptedAfterRejection > 0],
  ['Hot Streak', 'Has the last three accepted tropes marked on their board.', (m) => m.recentHits >= 3],
  [
    'Marking Momentum',
    'Has the most accepted spaces on their board, with at least ten accepted spaces.',
    (m) => m.accepted >= 10,
  ],
  ['The Finisher', 'Finished the watch with at least one completed bingo line.', (m) => m.gameOver && m.bingos >= 1],
  ['Full House', 'Has all five wager slots filled.', (m) => m.wagers >= 5],
  ['Trophy Hunter', 'Completed at least three bingo lines in this watch.', (m) => m.bingos >= 3],
  [
    'Sharp Eye',
    'Had at least three of their own trope proposals accepted by the group.',
    (m) => m.acceptedProposals >= 3,
  ],
  [
    'Patient Player',
    'Has at least five accepted tropes without submitting a trope proposal.',
    (m) => m.activityTracked && m.accepted >= 5 && m.submissions === 0,
  ],
  [
    'Variety Champion',
    'Has at least seven accepted tropes spread across at least four rows and four columns.',
    (m) => m.accepted >= 7 && m.acceptedRows >= 4 && m.acceptedColumns >= 4,
  ],
  [
    'Unflappable',
    'Has at least three further tropes marked on their board after a rejected proposal.',
    (m) => m.marksAfterRejection >= 3,
  ],
  [
    'First Mover',
    'Started the first trope proposal of this watch, before anyone knew whether it would be accepted.',
    (m) => m.firstProposal,
  ],
  [
    'Last Word',
    'Proposed the final accepted trope of a finished watch containing at least five accepted tropes.',
    (m) => m.gameOver && m.totalAccepted >= 5 && m.lastAcceptedByMe,
  ],
  [
    'Blackout',
    'Has every playable trope on their board accepted.',
    (m) => m.playableSpaces > 0 && m.accepted === m.playableSpaces,
  ],
  ['Trope Scout', 'Had their first trope proposal accepted by the group.', (m) => m.acceptedProposals >= 1],
  ['Scene Spotter', 'Had at least two of their trope proposals accepted.', (m) => m.acceptedProposals >= 2],
  ['Scene Sleuth', 'Had at least five of their trope proposals accepted.', (m) => m.acceptedProposals >= 5],
  ['Team Player', "Helped approve another player's accepted trope claim.", (m) => m.otherApprovalVotes >= 1],
  [
    'Watch Party MVP',
    "Helped approve at least eight other players' accepted trope claims.",
    (m) => m.otherApprovalVotes >= 8,
  ],
  [
    'Consensus Captain',
    "Helped approve at least fifteen other players' accepted trope claims.",
    (m) => m.otherApprovalVotes >= 15,
  ],
  ['On a Roll', 'Has at least three accepted tropes on their board.', (m) => m.accepted >= 3],
  ['Scene Collector', 'Has at least eight accepted tropes on their board.', (m) => m.accepted >= 8],
  ['Bingo Buddy', 'Completed a bingo line in this watch.', (m) => m.bingos >= 1],
  ['Double Feature', 'Completed at least two bingo lines in this watch.', (m) => m.bingos >= 2],
  ['Lucky Pick', 'Had a wagered trope accepted by the group.', (m) => m.wagerHits >= 1],
  ['Right on Cue', 'Correctly called a trope before it was accepted.', (m) => m.correctCalls >= 1],
  ['Prediction Pro', 'Correctly called at least three tropes in this watch.', (m) => m.correctCalls >= 3],
  ['Crystal Ball', 'Correctly called at least five tropes in this watch.', (m) => m.correctCalls >= 5],
];

const leaderScores = {
  'First Bingo': (metrics) => Number(metrics.firstBingo),
  'First Trope Accepted': (metrics) => Number(metrics.firstAccepted),
  'First Wager Achieved': (metrics) => Number(metrics.firstWagerHit),
  'Most Almost-Bingos': (metrics) => metrics.almostBingos,
  'Most Scattered Board': (metrics) => metrics.nearestLineMissing,
  'Acceptance Magnet': (metrics) => metrics.accepted,
  'Most Decisive': (metrics) => metrics.submissions,
  'Most Helpful': (metrics) => metrics.otherApprovalVotes,
  'Comeback Captain': (metrics) => metrics.acceptedAfterRejection,
  'Most Correct Calls': (metrics) => metrics.correctCalls,
  'Call Accuracy Ace': (metrics) => (metrics.callsMade > 0 ? metrics.correctCalls / metrics.callsMade : 0),
  'Wager Winner': (metrics) => metrics.wagerHits,
  'Best Wager Rate': (metrics) => (metrics.wagers > 0 ? metrics.wagerHits / metrics.wagers : 0),
  'Most Accepted Proposals': (metrics) => metrics.acceptedProposals,
  'Most Rejected Proposals': (metrics) => metrics.rejections,
  'Row Captain': (metrics) => metrics.completedRows,
  'Diagonal Dazzler': (metrics) => metrics.completedDiagonals,
  'Corner Collector': (metrics) => metrics.acceptedCorners,
  'Marking Momentum': (metrics) => metrics.accepted,
  'First Mover': (metrics) => Number(metrics.firstProposal),
};

const superlativeNames = new Set([
  'First Bingo',
  'First Trope Accepted',
  'First Wager Achieved',
  'Most Almost-Bingos',
  'Most Scattered Board',
  'Acceptance Magnet',
  'Most Decisive',
  'Most Helpful',
  'Comeback Captain',
  'Most Correct Calls',
  'Call Accuracy Ace',
  'Wager Winner',
  'Best Wager Rate',
  'Most Accepted Proposals',
  'Most Rejected Proposals',
  'Row Captain',
  'Diagonal Dazzler',
  'Corner Collector',
  'Marking Momentum',
  'First Mover',
]);

const awardStages = {
  Blackout: 8,
  'Blackout Bound': 7,
  'Trophy Hunter': 6,
  'The Finisher': 5,
  'Last Word': 5,
  'First Bingo': 4,
  'Pattern Hunter': 4,
  'Clean Sweep': 4,
  'Most Almost-Bingos': 3,
  'Most Scattered Board': 3,
  'Acceptance Magnet': 3,
  'Wager Architect': 3,
  'Sharp Eye': 3,
  'Comeback Kid': 3,
  'Hot Streak': 2,
  'Marking Momentum': 3,
  'Variety Champion': 3,
  Unflappable: 3,
  'First Trope Accepted': 2,
  'First Wager Achieved': 2,
  'Most Decisive': 2,
  'Most Helpful': 3,
  'Comeback Captain': 3,
  'Most Correct Calls': 3,
  'Call Accuracy Ace': 3,
  'Wager Winner': 3,
  'Best Wager Rate': 3,
  'Most Accepted Proposals': 3,
  'Most Rejected Proposals': 3,
  'Row Captain': 3,
  'Diagonal Dazzler': 3,
  'Corner Collector': 3,
  'Consensus Builder': 2,
  'Quiet Achiever': 2,
  'Patient Player': 2,
  'Bingo Chaser': 2,
  'Wager Whisperer': 2,
  'Wager In Progress': 2,
  'Full House': 2,
  'Scene Spotter': 2,
  'Watch Party MVP': 3,
  'Scene Collector': 3,
  'Right on Cue': 3,
  'Scene Sleuth': 4,
  'Consensus Captain': 4,
  'Bingo Buddy': 4,
  'Prediction Pro': 4,
  'Double Feature': 5,
  'Crystal Ball': 5,
};

const definitions = SUPERLATIVE_DEFINITIONS.map(([name, description, qualifies, score], index) => ({
  id: name.toLowerCase().replaceAll(' ', '-'),
  name,
  description,
  qualifies,
  score: score || (() => 1),
  leaderScore: leaderScores[name],
  kind: superlativeNames.has(name) ? 'superlative' : 'badge',
  stage: awardStages[name] || 1,
  priority: SUPERLATIVE_DEFINITIONS.length - index,
}));

function nearestLineMissing(marked) {
  const markedSet = new Set(marked);
  const lines = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col))
    .concat(Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)))
    .concat([
      [0, 6, 12, 18, 24],
      [4, 8, 12, 16, 20],
    ]);
  const missing = lines
    .map((line) => line.filter((index) => !markedSet.has(index)).length)
    .filter((count) => count > 0);
  return Math.min(5, ...missing);
}

export function getSuperlativeMetrics(
  player,
  gameState,
  personalStats = gameState.superlativeStats?.[player.id] || {},
  milestones = gameState.superlativeMilestones?.[player.id] || {},
) {
  const acceptedIndexes = player.board.reduce((indexes, text, index) => {
    if (
      player.marked.includes(index) &&
      (gameState.acceptedTropes.includes(text) || (gameState.freeSpace && index === 12))
    ) {
      indexes.push(index);
    }
    return indexes;
  }, []);
  const accepted = player.board.filter(
    (text, index) => player.marked.includes(index) && gameState.acceptedTropes.includes(text),
  ).length;
  const playableSpaces = player.board.length - (gameState.freeSpace ? 1 : 0);
  const bingos = getCompletedLines(acceptedIndexes).length;
  const rows = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col));
  const diagonals = [
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];
  const wagerHits = player.wagered.filter(
    (index) => acceptedIndexes.includes(index) && (!gameState.freeSpace || index !== 12),
  ).length;
  return {
    accepted,
    playableSpaces,
    totalAccepted: gameState.acceptedTropes.length,
    gameOver: !!gameState.gameOver,
    acceptedRatio: playableSpaces > 0 ? accepted / playableSpaces : 0,
    marked: player.marked.filter((index) => !gameState.freeSpace || index !== 12).length,
    bingos,
    completedRows: rows.filter((line) => line.every((index) => acceptedIndexes.includes(index))).length,
    completedDiagonals: diagonals.filter((line) => line.every((index) => acceptedIndexes.includes(index))).length,
    acceptedCorners: [0, 4, 20, 24].filter((index) => acceptedIndexes.includes(index)).length,
    almostBingos: getAlmostCompletedLines(acceptedIndexes).length,
    wagers: player.wagered.length,
    wagerHits,
    nearestLineMissing: nearestLineMissing(acceptedIndexes),
    views: personalStats.views || 0,
    submissions: personalStats.submissions || 0,
    rejections: personalStats.rejections || 0,
    approvalVotes: personalStats.approvalVotes || 0,
    otherApprovalVotes: personalStats.otherApprovalVotes || 0,
    acceptedProposals: personalStats.acceptedProposals || 0,
    correctCalls: gameState.callStats?.[player.id]?.correct || 0,
    callsMade: gameState.callStats?.[player.id]?.made || 0,
    acceptedAfterRejection: personalStats.acceptedAfterRejection || 0,
    marksAfterRejection: personalStats.marksAfterRejection || 0,
    viewedTropeCount: new Set(personalStats.viewedTropes || []).size,
    activityTracked: Object.keys(personalStats).length > 0,
    acceptedRows: new Set(
      acceptedIndexes.filter((index) => !gameState.freeSpace || index !== 12).map((index) => Math.floor(index / 5)),
    ).size,
    acceptedColumns: new Set(
      acceptedIndexes.filter((index) => !gameState.freeSpace || index !== 12).map((index) => index % 5),
    ).size,
    recentHits: gameState.acceptedTropes.slice(-3).filter((text) => {
      const index = player.board.indexOf(text);
      return index !== -1 && player.marked.includes(index);
    }).length,
    lastAcceptedByMe: !!gameState.acceptedTropeProposers?.[gameState.acceptedTropes.at(-1)]?.includes(player.id),
    firstProposal: !!milestones.firstProposal && !milestones.firstProposalTied,
    firstBingo: !!milestones.firstBingo && !milestones.firstBingoTied,
    firstAccepted: !!milestones.firstAccepted && !milestones.firstAcceptedTied,
    firstWagerHit: !!milestones.firstWagerHit && !milestones.firstWagerHitTied,
  };
}

export function getPlayerSuperlative(player, gameState, personalStats, milestones) {
  const metrics = getSuperlativeMetrics(player, gameState, personalStats, milestones);
  const award = definitions
    .filter((definition) => definition.kind === 'superlative' && definition.qualifies(metrics))
    .sort((a, b) => b.stage - a.stage || b.score(metrics) - a.score(metrics) || b.priority - a.priority)[0];
  return award ? { ...award, metrics } : null;
}

function superlativeCandidates(players, gameState) {
  const candidates = players.map((player) => {
    const metrics = getSuperlativeMetrics(player, gameState);
    return {
      player,
      metrics,
      eligible: definitions
        .filter((definition) => definition.kind === 'superlative' && definition.qualifies(metrics))
        .sort((a, b) => b.stage - a.stage || b.score(metrics) - a.score(metrics) || b.priority - a.priority),
    };
  });
  for (const candidate of candidates) {
    candidate.eligible = candidate.eligible.filter(
      (definition) =>
        !definition.leaderScore ||
        candidates.every(
          (other) =>
            other === candidate ||
            !definition.qualifies(other.metrics) ||
            definition.leaderScore(candidate.metrics) > definition.leaderScore(other.metrics),
        ),
    );
  }
  return candidates;
}

export function getPlayerSuperlatives(players, gameState) {
  const candidates = superlativeCandidates(players, gameState);
  return Object.fromEntries(
    candidates
      .filter(({ eligible }) => eligible.length)
      .map(({ player, metrics, eligible }) => [player.id, eligible.map((award) => ({ ...award, metrics }))]),
  );
}

export function getPlayerAwards(players, gameState) {
  const superlatives = getPlayerSuperlatives(players, gameState);
  const progressionNames = new Set(progressTracks.flatMap((track) => track.goals.map(([name]) => name)));
  return Object.fromEntries(
    players.map((player) => {
      const metrics = getSuperlativeMetrics(player, gameState);
      const badges = progressTracks.flatMap((track) => {
        const qualified = track.goals.filter(([name, , available]) => {
          const definition = definitions.find((entry) => entry.name === name);
          return definition.qualifies(metrics) && (!available || available(metrics));
        });
        const highest = qualified[qualified.length - 1];
        const definition = highest && definitions.find((entry) => entry.name === highest[0]);
        return definition ? [{ ...definition, metrics }] : [];
      });
      badges.push(
        ...definitions
          .filter(
            (definition) =>
              definition.kind === 'badge' && !progressionNames.has(definition.name) && definition.qualifies(metrics),
          )
          .map((badge) => ({ ...badge, metrics })),
      );
      badges.sort((a, b) => b.stage - a.stage || b.score(metrics) - a.score(metrics) || b.priority - a.priority);
      return [player.id, { badges, superlatives: superlatives[player.id] || [] }];
    }),
  );
}

export function recordAwardTransitions(previousState, state, timestamp = Date.now()) {
  const players = Object.values(state.players || {});
  const current = getPlayerAwards(players, state);
  const previous = previousState ? getPlayerAwards(Object.values(previousState.players || {}), previousState) : {};
  const logicalTimestamp = Number.isSafeInteger(state.serverRevision)
    ? state.serverRevision
    : Number.isSafeInteger(state.rev)
      ? state.rev
      : timestamp;
  for (const player of players) {
    const playerAwards = current[player.id] || { badges: [], superlatives: [] };
    const currentAwards = [...playerAwards.badges, ...playerAwards.superlatives];
    if (!currentAwards.length) continue;
    state.awardHistory ||= {};
    const history = (state.awardHistory[player.id] ||= {});
    const oldAwards = previous[player.id] || { badges: [], superlatives: [] };
    const oldIds = new Set([...oldAwards.badges, ...oldAwards.superlatives].map((award) => award.id));
    for (const award of currentAwards) {
      if (
        !Number.isFinite(history[award.id]) ||
        (previousState && !oldIds.has(award.id) && logicalTimestamp > history[award.id])
      ) {
        history[award.id] = logicalTimestamp;
      }
    }
  }
  return state;
}

function latestAward(awards, history) {
  return [...awards].sort(
    (first, second) =>
      (history[second.id] || 0) - (history[first.id] || 0) ||
      second.stage - first.stage ||
      second.score(second.metrics) - first.score(first.metrics) ||
      second.priority - first.priority,
  )[0];
}

export function getLatestPlayerAwards(players, gameState) {
  const awards = getPlayerAwards(players, gameState);
  return Object.fromEntries(
    players.map((player) => {
      const playerAwards = awards[player.id] || { badges: [], superlatives: [] };
      const history = gameState.awardHistory?.[player.id] || {};
      return [
        player.id,
        {
          badge: latestAward(playerAwards.badges, history),
          superlative: latestAward(playerAwards.superlatives, history),
        },
      ];
    }),
  );
}

const progressTracks = [
  {
    metric: 'acceptedProposals',
    label: 'Accepted proposals',
    goals: [
      ['Trope Scout', 1],
      ['Scene Spotter', 2],
      ['Sharp Eye', 3],
      ['Scene Sleuth', 5],
    ],
  },
  {
    metric: 'otherApprovalVotes',
    label: 'Helpful approvals',
    goals: [
      ['Team Player', 1],
      ['Consensus Builder', 3],
      ['Watch Party MVP', 8],
      ['Consensus Captain', 15],
    ],
  },
  {
    metric: 'accepted',
    label: 'Accepted board spaces',
    goals: [
      ['On a Roll', 3],
      ['Scene Collector', 8],
      ['Blackout Bound', (metrics) => Math.ceil(metrics.playableSpaces * 0.8)],
      ['Blackout', (metrics) => metrics.playableSpaces],
    ],
  },
  {
    metric: 'bingos',
    label: 'Completed bingo lines',
    goals: [
      ['Bingo Buddy', 1],
      ['Double Feature', 2],
      ['Trophy Hunter', 3],
    ],
  },
  { metric: 'wagers', label: 'Wagers placed', goals: [['Full House', 5]] },
  {
    metric: 'wagerHits',
    label: 'Successful wagers',
    goals: [
      ['Lucky Pick', 1],
      ['Wager Whisperer', 2],
      ['Wager Architect', 3, (metrics) => metrics.wagers === 5],
      ['Clean Sweep', (metrics) => metrics.wagers, (metrics) => metrics.wagers >= 3],
    ],
  },
  {
    metric: 'correctCalls',
    label: 'Correct predictions',
    goals: [
      ['Right on Cue', 1],
      ['Prediction Pro', 3],
      ['Crystal Ball', 5],
    ],
  },
];

export function getBadgeProgress(player, gameState) {
  const metrics = getSuperlativeMetrics(player, gameState);
  return progressTracks
    .flatMap((track, index) => {
      const goal = track.goals.find(([name, , available]) => {
        const definition = definitions.find((entry) => entry.name === name);
        return definition.kind === 'badge' && (!available || available(metrics)) && !definition.qualifies(metrics);
      });
      if (!goal) return [];
      const [name, threshold] = goal;
      const target = typeof threshold === 'function' ? threshold(metrics) : threshold;
      if (target <= 0) return [];
      const definition = definitions.find((entry) => entry.name === name);
      const value = Math.max(0, Math.min(target, metrics[track.metric] || 0));
      return [
        {
          id: definition.id,
          name,
          description: definition.description,
          kind: definition.kind,
          stage: definition.stage,
          label: track.label,
          value,
          target,
          fraction: value / target,
          order: index,
        },
      ];
    })
    .sort(
      (first, second) => second.fraction - first.fraction || first.stage - second.stage || first.order - second.order,
    )
    .slice(0, 3);
}

export function createBadgeAchievementTracker() {
  let initialized = false;
  let previousStarted = false;
  let previousWatch = 0;
  let seen = new Map();
  let previousSuperlativeOwners = new Map();
  let previousPlayerIds = new Set();
  let watchVersion = 0;
  let previousRevision;
  return {
    get watchVersion() {
      return watchVersion;
    },
    reset() {
      initialized = false;
      seen = new Map();
      previousSuperlativeOwners = new Map();
      previousPlayerIds = new Set();
    },
    update(state) {
      if (
        initialized &&
        Number.isSafeInteger(state.serverRevision) &&
        Number.isSafeInteger(previousRevision) &&
        state.serverRevision <= previousRevision
      )
        return [];
      previousRevision = state.serverRevision;
      const watch = state.marathon?.watches?.length || 0;
      const reset = initialized && (watch !== previousWatch || (previousStarted && !state.started));
      if (reset) {
        seen = new Map();
        previousSuperlativeOwners = new Map();
        previousPlayerIds = new Set();
        watchVersion += 1;
      }
      const players = Object.values(state.players);
      const awards = getPlayerAwards(players, state);
      const achievements = [];
      const currentSuperlativeOwners = new Map();
      for (const player of players) {
        const previous = seen.get(player.id);
        const remembered = previous || new Set();
        for (const award of awards[player.id].badges) {
          if (state.started && initialized && !reset && previous && !previous.has(award.id)) {
            achievements.push({
              playerId: player.id,
              name: player.name,
              avatar: player.avatar,
              badgeId: award.id,
              badgeName: award.name,
              awardKind: 'badge',
              stage: award.stage,
            });
          }
          remembered.add(award.id);
        }
        seen.set(player.id, remembered);
        for (const award of awards[player.id].superlatives) {
          currentSuperlativeOwners.set(award.id, player);
        }
      }
      for (const [awardId, player] of currentSuperlativeOwners) {
        if (
          state.started &&
          initialized &&
          !reset &&
          previousPlayerIds.has(player.id) &&
          previousSuperlativeOwners.get(awardId) !== player.id
        ) {
          const award = awards[player.id].superlatives.find((entry) => entry.id === awardId);
          achievements.push({
            playerId: player.id,
            name: player.name,
            avatar: player.avatar,
            badgeId: award.id,
            badgeName: award.name,
            awardKind: 'superlative',
            stage: award.stage,
          });
        }
      }
      previousSuperlativeOwners = new Map(
        [...currentSuperlativeOwners].map(([awardId, player]) => [awardId, player.id]),
      );
      previousPlayerIds = new Set(players.map((player) => player.id));
      initialized = true;
      previousWatch = watch;
      previousStarted = !!state.started;
      return achievements.sort(
        (first, second) => (state.players[first.playerId].seat || 0) - (state.players[second.playerId].seat || 0),
      );
    },
  };
}

export function getAllSuperlatives() {
  return definitions;
}
