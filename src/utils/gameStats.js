import { getCompletedLines } from './bingoLines.js';

export function getCurrentPlayerMetrics(player, freeSpace = false, callStats = {}) {
  const bingos = getCompletedLines(player.marked).length;
  const wagerHits = player.wagered.filter((index) => player.marked.includes(index)).length;
  const tropes = player.marked.filter((index) => !(freeSpace && index === 12)).length;
  return {
    tropes,
    bingos,
    wagerHits,
    wagers: player.wagered.length,
    callsMade: callStats.made || 0,
    correctCalls: callStats.correct || 0,
  };
}

export function getMarathonMetrics(watches) {
  const totals = new Map();
  for (const watch of watches || []) {
    for (const player of watch.players) {
      const total = totals.get(player.id) || {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        tropes: 0,
        bingos: 0,
        wagerHits: 0,
        callsMade: 0,
        correctCalls: 0,
        watches: 0,
      };
      total.name = player.name;
      total.avatar = player.avatar;
      total.tropes += player.tropes;
      total.bingos += player.bingos;
      total.wagerHits += player.wagerHits;
      total.callsMade += player.callsMade || 0;
      total.correctCalls += player.correctCalls || 0;
      total.watches += 1;
      totals.set(player.id, total);
    }
  }
  return [...totals.values()].sort((left, right) => right.tropes - left.tropes || right.bingos - left.bingos);
}
