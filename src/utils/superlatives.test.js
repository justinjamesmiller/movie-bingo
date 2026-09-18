import { describe, expect, it } from 'vitest';
import { getAllSuperlatives, getPlayerSuperlative, getPlayerSuperlatives } from './superlatives.js';

const gameState = { acceptedTropes: [], freeSpace: false, players: {} };
const player = { id: 'p1', board: Array.from({ length: 25 }, (_, index) => `Trope ${index}`), marked: [], wagered: [] };

describe('superlatives', () => {
  it('provides at least 30 distinctions', () => {
    expect(getAllSuperlatives().length).toBeGreaterThanOrEqual(30);
  });

  it('always gives a player a distinction', () => {
    expect(getPlayerSuperlative(player, gameState).name).toBeTruthy();
  });

  it('recognizes a bingo-based distinction', () => {
    const award = getPlayerSuperlative({ ...player, marked: [0, 1, 2, 3, 4] }, gameState, {}, { firstBingo: true });
    expect(['First Bingo', 'Pattern Hunter', 'The Finisher']).toContain(award.name);
  });

  it('recognizes a line that needs exactly one more accepted trope', () => {
    const almostBingoState = { ...gameState, acceptedTropes: ['Trope 0', 'Trope 1', 'Trope 2', 'Trope 3'] };
    const award = getPlayerSuperlative({ ...player, marked: [0, 1, 2, 3] }, almostBingoState);
    expect(award.name).toBe('Most Almost-Bingos');
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

  it('assigns distinct awards to every player', () => {
    const players = [
      player,
      { ...player, id: 'p2', marked: [0, 1, 2, 3, 4] },
      { ...player, id: 'p3', marked: [0, 5, 10] },
    ];
    const awards = Object.values(getPlayerSuperlatives(players, gameState));
    expect(new Set(awards.map((award) => award.id)).size).toBe(awards.length);
  });
});
