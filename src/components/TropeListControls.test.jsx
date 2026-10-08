import { describe, expect, it } from 'vitest';
import { filterTropeTexts } from './TropeListControls.jsx';

describe('trope list filtering', () => {
  const texts = ['Jump Scare', 'A phone rings', 'A hidden clue'];
  const metadata = {
    acceptedTropes: ['Jump Scare'],
    board: ['Jump Scare', 'A phone rings'],
    wageredTexts: ['A phone rings'],
    calledTexts: ['Jump Scare'],
  };
  it.each([
    ['accepted', ['Jump Scare']],
    ['unaccepted', ['A phone rings', 'A hidden clue']],
    ['board', ['Jump Scare', 'A phone rings']],
    ['wagered', ['A phone rings']],
    ['called', ['Jump Scare']],
  ])('filters by %s', (filter, expected) => {
    expect(filterTropeTexts(texts, { ...metadata, filter })).toEqual(expected);
  });
  it('combines a trimmed case-insensitive search with the selected filter', () => {
    expect(filterTropeTexts(texts, { ...metadata, filter: 'board', query: ' PHONE ' })).toEqual(['A phone rings']);
    expect(filterTropeTexts(texts, { ...metadata, filter: 'accepted', query: 'phone' })).toEqual([]);
  });
});
