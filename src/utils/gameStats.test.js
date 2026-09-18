import { describe, expect, it } from 'vitest';
import { getCurrentPlayerMetrics, getMarathonMetrics } from './gameStats.js';

describe('gameStats', () => {
  it('does not count a free center space as a marked trope', () => {
    const player = { marked: [0, 12], wagered: [0, 12] };

    expect(getCurrentPlayerMetrics(player, true)).toMatchObject({ tropes: 1, bingos: 0, wagerHits: 2, wagers: 2 });
  });

  it('aggregates players who appear in only some marathon watches', () => {
    const totals = getMarathonMetrics([
      { players: [{ id: 'a', name: 'Alice', tropes: 2, bingos: 0, wagerHits: 1 }] },
      { players: [{ id: 'b', name: 'Bob', tropes: 3, bingos: 1, wagerHits: 0 }] },
    ]);

    expect(totals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', watches: 1, tropes: 2 }),
        expect.objectContaining({ id: 'b', watches: 1, tropes: 3 }),
      ]),
    );
  });
});
