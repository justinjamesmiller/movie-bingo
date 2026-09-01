import { describe, expect, it } from 'vitest';
import { getCompletedLineCells, getCompletedLines } from './bingoLines.js';

describe('getCompletedLines', () => {
  it('returns no lines when nothing is marked', () => {
    expect(getCompletedLines([])).toEqual([]);
  });

  it('detects a completed row', () => {
    const lines = getCompletedLines([0, 1, 2, 3, 4]);
    expect(lines).toEqual([[0, 1, 2, 3, 4]]);
  });

  it('detects a completed column', () => {
    const lines = getCompletedLines([0, 5, 10, 15, 20]);
    expect(lines).toEqual([[0, 5, 10, 15, 20]]);
  });

  it('detects the two diagonals', () => {
    expect(getCompletedLines([0, 6, 12, 18, 24])).toEqual([[0, 6, 12, 18, 24]]);
    expect(getCompletedLines([4, 8, 12, 16, 20])).toEqual([[4, 8, 12, 16, 20]]);
  });

  it('detects multiple simultaneous lines', () => {
    // Fill the whole top row plus the whole left column (index 0 shared).
    const marked = [0, 1, 2, 3, 4, 5, 10, 15, 20];
    const lines = getCompletedLines(marked);
    expect(lines).toHaveLength(2);
  });

  it('does not count a nearly-complete line', () => {
    expect(getCompletedLines([0, 1, 2, 3])).toEqual([]);
  });

  it('recognizes all 12 standard lines exactly once each when the whole board is marked', () => {
    const allMarked = Array.from({ length: 25 }, (_, i) => i);
    expect(getCompletedLines(allMarked)).toHaveLength(12);
  });
});

describe('getCompletedLineCells', () => {
  it('returns an empty set when nothing is completed', () => {
    expect(getCompletedLineCells([])).toEqual(new Set());
  });

  it('returns the union of cells across all completed lines', () => {
    // Top row + left column overlap at index 0.
    const marked = [0, 1, 2, 3, 4, 5, 10, 15, 20];
    const cells = getCompletedLineCells(marked);
    expect(cells).toEqual(new Set([0, 1, 2, 3, 4, 5, 10, 15, 20]));
  });
});
