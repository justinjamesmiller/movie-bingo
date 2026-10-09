import { getAlmostCompletedLines, getCompletedLines } from './bingoLines.js';

export const SUPERLATIVE_DEFINITIONS = [
  [
    'Most Thoughtful',
    'Has the highest distinct-explanation-to-proposal ratio among players with at least two proposals and five different tropes explored, exploring at least twice as many different tropes as proposals.',
    (m) => m.submissions >= 2 && m.viewedTropeCount >= 5 && m.viewedTropeCount >= m.submissions * 2,
  ],
  [
    'Definition Detective',
    'Explored the most different trope explanations, with at least four different tropes opened.',
    (m) => m.viewedTropeCount >= 4,
  ],
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
  [
    'Pattern Hunter',
    'Completed more bingo lines than anyone else, with at least two completed lines.',
    (m) => m.bingos >= 2,
  ],
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
  ['Board Cartographer', 'Opened explanations for at least three different tropes.', (m) => m.viewedTropeCount >= 3],
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
    'Brave Caller',
    'Submitted a trope proposal before opening any trope explanations. Bold move!',
    (m) => m.activityTracked && m.submissions > 0 && m.views === 0,
  ],
  ['Curious Mind', 'Explored at least eight different trope explanations.', (m) => m.viewedTropeCount >= 8],
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
  ['Trope Explorer', 'Opened explanations for at least two different tropes.', (m) => m.viewedTropeCount >= 2],
  ['Trope Librarian', 'Explored explanations for at least fifteen different tropes.', (m) => m.viewedTropeCount >= 15],
  [
    'Trope Scholar',
    'Explored explanations for at least twenty-five different tropes.',
    (m) => m.viewedTropeCount >= 25,
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
  'Most Thoughtful': (metrics) => (metrics.submissions > 0 ? metrics.viewedTropeCount / metrics.submissions : 0),
  'Definition Detective': (metrics) => metrics.viewedTropeCount,
  'First Bingo': (metrics) => Number(metrics.firstBingo),
  'First Trope Accepted': (metrics) => Number(metrics.firstAccepted),
  'First Wager Achieved': (metrics) => Number(metrics.firstWagerHit),
  'Most Almost-Bingos': (metrics) => metrics.almostBingos,
  'Most Scattered Board': (metrics) => metrics.nearestLineMissing,
  'Pattern Hunter': (metrics) => metrics.bingos,
  'Acceptance Magnet': (metrics) => metrics.accepted,
  'Most Decisive': (metrics) => metrics.submissions,
  'Marking Momentum': (metrics) => metrics.accepted,
  'First Mover': (metrics) => Number(metrics.firstProposal),
};

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
  'Most Thoughtful': 2,
  'Most Decisive': 2,
  'Consensus Builder': 2,
  'Quiet Achiever': 2,
  'Patient Player': 2,
  'Curious Mind': 2,
  'Bingo Chaser': 2,
  'Wager Whisperer': 2,
  'Wager In Progress': 2,
  'Full House': 2,
  'Scene Spotter': 2,
  'Watch Party MVP': 3,
  'Trope Librarian': 3,
  'Scene Collector': 3,
  'Right on Cue': 3,
  'Scene Sleuth': 4,
  'Consensus Captain': 4,
  'Trope Scholar': 4,
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
    .filter((definition) => definition.qualifies(metrics))
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
        .filter((definition) => definition.qualifies(metrics))
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
  const assignments = {};
  const used = new Set();

  // Reserve rare/earned distinctions first, so a later player cannot consume
  // the only fitting award for someone with a stronger claim to it.
  candidates
    .sort(
      (a, b) =>
        a.eligible.length - b.eligible.length ||
        (a.player.seat || 0) - (b.player.seat || 0) ||
        (a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0),
    )
    .forEach(({ player, metrics, eligible }) => {
      const strongest = eligible[0];
      const award =
        eligible.find(
          (definition) =>
            definition.stage === strongest?.stage &&
            definition.score(metrics) === strongest.score(metrics) &&
            !used.has(definition.id),
        ) || strongest;
      if (!award) return;
      used.add(award.id);
      assignments[player.id] = { ...award, metrics };
    });

  return assignments;
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
    metric: 'viewedTropeCount',
    label: 'Different explanations explored',
    goals: [
      ['Trope Explorer', 2],
      ['Board Cartographer', 3],
      ['Curious Mind', 8],
      ['Trope Librarian', 15],
      ['Trope Scholar', 25],
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

export function getBadgeProgress(player, gameState, currentAward) {
  const metrics = getSuperlativeMetrics(player, gameState);
  const current =
    currentAward === undefined
      ? getPlayerSuperlatives(
          Object.values(gameState.players || {}).length ? Object.values(gameState.players) : [player],
          gameState,
        )[player.id]
      : currentAward;
  return progressTracks
    .flatMap((track, index) => {
      const goal = track.goals.find(([name, , available]) => {
        const definition = definitions.find((entry) => entry.name === name);
        const stronger =
          !current ||
          definition.stage > current.stage ||
          (definition.stage === current.stage &&
            definition.score(metrics) >= current.score(metrics) &&
            definition.priority > current.priority);
        return stronger && (!available || available(metrics)) && !definition.qualifies(metrics);
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
  let watchVersion = 0;
  let previousRevision;
  return {
    get watchVersion() {
      return watchVersion;
    },
    reset() {
      initialized = false;
      seen = new Map();
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
        watchVersion += 1;
      }
      const players = Object.values(state.players);
      const candidates = superlativeCandidates(players, state);
      const awards = getPlayerSuperlatives(players, state);
      const achievements = [];
      for (const { player, eligible } of candidates) {
        const previous = seen.get(player.id);
        const award = awards[player.id];
        if (initialized && !reset && previous && award && !previous.has(award.id)) {
          achievements.push({
            playerId: player.id,
            name: player.name,
            avatar: player.avatar,
            badgeId: award.id,
            badgeName: award.name,
            stage: award.stage,
          });
        }
        const remembered = previous || new Set();
        for (const definition of eligible) remembered.add(definition.id);
        seen.set(player.id, remembered);
      }
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
