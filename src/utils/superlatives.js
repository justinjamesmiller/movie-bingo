import { getAlmostCompletedLines, getCompletedLines } from './bingoLines.js';

export const SUPERLATIVE_DEFINITIONS = [
  [
    'Most Thoughtful',
    'Read trope explanations more often than submitting them.',
    (m) => m.views > m.submissions * 1.5 && m.views >= 2,
  ],
  ['Definition Detective', 'Opened the most trope explanations.', (m) => m.views >= 1],
  ['First Bingo', 'Completed a bingo line before anyone else.', (m) => m.firstBingo],
  ['First Trope Accepted', 'Had a trope accepted by the group before anyone else.', (m) => m.firstAccepted],
  ['First Wager Achieved', 'Had a wagered trope accepted before anyone else.', (m) => m.firstWagerHit],
  [
    'Blackout Bound',
    'Had the highest share of playable board spaces accepted, putting a total blackout within reach.',
    (m) => m.acceptedRatio >= 0.8,
    (m) => m.acceptedRatio * 100,
  ],
  [
    'Most Almost-Bingos',
    'Had the most lines with four accepted tropes, each one needing just one more acceptance to become a bingo.',
    (m) => m.almostBingos > 0,
    (m) => m.almostBingos,
  ],
  [
    'Most Scattered Board',
    'Has accepted tropes spread furthest from completing a line.',
    (m) => m.accepted > 0 && !m.bingos,
  ],
  ['Bingo Chaser', 'Has marked spaces close to completing another bingo.', (m) => m.nearestLineMissing <= 2],
  ['Pattern Hunter', 'Completed more bingo lines than anyone else.', (m) => m.bingos > 0],
  ['Acceptance Magnet', 'Has the most accepted tropes on their board.', (m) => m.accepted > 0],
  ['Wager Whisperer', 'Picked wagers that were especially likely to be accepted.', (m) => m.wagerHits > 0],
  ['Wager Architect', 'Filled the most wager slots.', (m) => m.wagers >= 3],
  ['Clean Sweep', 'Every wagered trope was accepted.', (m) => m.wagers > 0 && m.wagerHits === m.wagers],
  ['Long Shot', 'Won with a wager that looked unlikely at first.', (m) => m.wagerHits > 0 && m.wagerHits < m.wagers],
  [
    'Most Decisive',
    'Submitted claims more often than reading explanations first.',
    (m) => m.submissions >= 2 && m.submissions > m.views,
  ],
  ['Consensus Builder', 'Helped turn several claims into shared accepted tropes.', (m) => m.accepted >= 2],
  [
    'Quiet Achiever',
    'Marked accepted tropes without needing many submissions.',
    (m) => m.marked >= 2 && m.submissions <= 2,
  ],
  ['Comeback Kid', 'Built momentum after starting with few accepted spaces.', (m) => m.marked >= 3],
  ['Hot Streak', 'Collected several accepted tropes in a row.', (m) => m.accepted >= 3],
  ['Marking Momentum', 'Marked the most spaces on the board.', (m) => m.marked >= 3],
  ['The Finisher', 'Finished with a full bingo line.', (m) => m.bingos > 0],
  ['Full House', 'Had every wager slot filled at the finish.', (m) => m.wagers >= 5],
  ['Trophy Hunter', 'Completed multiple bingo lines.', (m) => m.bingos >= 2],
  ['Sharp Eye', 'Found accepted tropes that others might have missed.', (m) => m.accepted >= 1 && m.views >= 1],
  [
    'Patient Player',
    'Waited for the group before building a marked board.',
    (m) => m.accepted >= 1 && m.submissions === 0,
  ],
  ['Board Cartographer', 'Explored a wide range of board positions.', (m) => m.views >= 3],
  ['Variety Champion', 'Accepted tropes across many different board areas.', (m) => m.accepted >= 2],
  ['Unflappable', 'Kept building after a claim was rejected.', (m) => m.rejections > 0 && m.marked > 0],
  ['First Mover', 'Made the first successful claim of the game.', (m) => m.firstAccepted],
  ['Last Word', 'Added an accepted trope late in the game.', (m) => m.accepted >= 1],
  [
    'Brave Caller',
    'Submitted a claim without first opening its definition.',
    (m) => m.submissions > 0 && m.views === 0,
  ],
  ['Curious Mind', 'Read more explanations than anyone else.', (m) => m.views >= 2],
  ['Steady Presence', 'Stayed in the game and kept contributing.', () => true],
];

const definitions = SUPERLATIVE_DEFINITIONS.map(([name, description, qualifies, score], index) => ({
  id: name.toLowerCase().replaceAll(' ', '-'),
  name,
  description,
  qualifies,
  score: score || (() => 1),
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
  return Math.min(...lines.map((line) => line.filter((index) => !markedSet.has(index)).length));
}

export function getSuperlativeMetrics(player, gameState, personalStats = {}, milestones = {}) {
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
  const bingos = getCompletedLines(player.marked).length;
  const wagerHits = player.wagered.filter((index) => player.marked.includes(index)).length;
  return {
    accepted,
    acceptedRatio: playableSpaces > 0 ? accepted / playableSpaces : 0,
    marked: player.marked.length,
    bingos,
    almostBingos: getAlmostCompletedLines(acceptedIndexes).length,
    wagers: player.wagered.length,
    wagerHits,
    nearestLineMissing: nearestLineMissing(player.marked),
    views: personalStats.views || 0,
    submissions: personalStats.submissions || 0,
    rejections: personalStats.rejections || 0,
    firstBingo: !!milestones.firstBingo,
    firstAccepted: !!milestones.firstAccepted,
    firstWagerHit: !!milestones.firstWagerHit,
  };
}

export function getPlayerSuperlative(player, gameState, personalStats, milestones) {
  const metrics = getSuperlativeMetrics(player, gameState, personalStats, milestones);
  const award = definitions
    .filter((definition) => definition.qualifies(metrics))
    .sort((a, b) => b.score(metrics) - a.score(metrics) || b.priority - a.priority)[0];
  return { ...award, metrics };
}

export function getPlayerSuperlatives(players, gameState, personalStatsById = {}, milestonesById = {}) {
  const candidates = players.map((player) => {
    const metrics = getSuperlativeMetrics(player, gameState, personalStatsById[player.id], milestonesById[player.id]);
    return {
      player,
      metrics,
      eligible: definitions
        .filter((definition) => definition.qualifies(metrics))
        .sort((a, b) => b.score(metrics) - a.score(metrics) || b.priority - a.priority),
    };
  });
  const assignments = {};
  const used = new Set();

  // Reserve rare/earned distinctions first, so a later player cannot consume
  // the only fitting award for someone with a stronger claim to it.
  candidates
    .sort((a, b) => a.eligible.length - b.eligible.length)
    .forEach(({ player, metrics, eligible }) => {
      const award =
        eligible.find((definition) => !used.has(definition.id)) ||
        definitions.find((definition) => !used.has(definition.id));
      if (!award) return;
      used.add(award.id);
      assignments[player.id] = { ...award, metrics };
    });

  return assignments;
}

export function getAllSuperlatives() {
  return definitions;
}
