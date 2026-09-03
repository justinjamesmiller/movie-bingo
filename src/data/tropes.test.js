import { describe, expect, it } from 'vitest';
import {
  buildPlayerBoard,
  CENTER_INDEX,
  DEFAULT_GENERAL_PERCENT,
  DEFAULT_TOTAL_TROPES,
  FREE_SPACE_TEXT,
  GENERAL_PERCENT_OPTIONS,
  GENRES,
  getEligibleTropeTexts,
  getSubgenres,
  getTropeSubgenres,
  pickTropePool,
  SUBGENRES_BY_GENRE,
  TOTAL_TROPES_OPTIONS,
  tropeHasGenre,
  tropeHasSubgenre,
  TROPES,
} from './tropes.js';

describe('GENRES / SUBGENRES_BY_GENRE data integrity', () => {
  it('has a subgenre list (including "general") for every genre', () => {
    for (const genre of GENRES) {
      const subs = SUBGENRES_BY_GENRE[genre.id];
      expect(subs).toBeDefined();
      expect(subs.some((s) => s.id === 'general')).toBe(true);
    }
  });

  it('has no duplicate trope text entries after consolidation', () => {
    const seen = new Set();
    for (const trope of TROPES) {
      expect(seen.has(trope.text)).toBe(false);
      seen.add(trope.text);
    }
  });

  it('keeps shared tropes as one entry with multiple genre/subgenre memberships', () => {
    const shared = TROPES.find((trope) => trope.text === 'A safehouse is compromised');
    expect(shared).toBeDefined();
    expect(shared.genres).toEqual(expect.arrayContaining(['horror', 'action']));
    expect(tropeHasSubgenre(shared, 'horror', 'zombie')).toBe(true);
    expect(tropeHasSubgenre(shared, 'action', 'general')).toBe(true);
  });

  it('has every genre referenced by at least one trope, and every trope genre membership is known', () => {
    const validGenres = new Set(GENRES.map((g) => g.id));
    const referencedGenres = new Set();
    for (const trope of TROPES) {
      expect(validGenres.has(trope.genre)).toBe(true);
      for (const genre of trope.genres) {
        expect(validGenres.has(genre)).toBe(true);
        referencedGenres.add(genre);
      }
    }
    expect(referencedGenres).toEqual(validGenres);
  });

  it('has at least 40 tropes for every subgenre (including "general") of every genre', () => {
    for (const genre of GENRES) {
      for (const sub of SUBGENRES_BY_GENRE[genre.id]) {
        const count = TROPES.filter((tr) => tropeHasSubgenre(tr, genre.id, sub.id)).length;
        expect(count, `${genre.id}/${sub.id} should have >=40 tropes`).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe('getSubgenres', () => {
  it('returns the subgenre list for a known genre', () => {
    expect(getSubgenres('horror')).toBe(SUBGENRES_BY_GENRE.horror);
  });

  it('falls back to the default genre for an unknown genre id', () => {
    expect(getSubgenres('not-a-real-genre')).toBe(SUBGENRES_BY_GENRE.horror);
  });
});

describe('getEligibleTropeTexts', () => {
  it('returns the union of general and the specific subgenre for that genre', () => {
    const texts = getEligibleTropeTexts('horror', 'slasher');
    const expectedCount = TROPES.filter(
      (tr) => tropeHasSubgenre(tr, 'horror', 'general') || tropeHasSubgenre(tr, 'horror', 'slasher'),
    ).length;
    expect(texts).toHaveLength(expectedCount);
  });

  it('returns only general tropes when the subgenre does not match anything', () => {
    const texts = getEligibleTropeTexts('horror', 'not-a-real-subgenre');
    const generalCount = TROPES.filter((tr) => tropeHasSubgenre(tr, 'horror', 'general')).length;
    expect(texts).toHaveLength(generalCount);
  });

  it('never mixes tropes from a different genre', () => {
    const texts = getEligibleTropeTexts('comedy', 'rom-com');
    const comedyTexts = new Set(TROPES.filter((tr) => tropeHasGenre(tr, 'comedy')).map((tr) => tr.text));
    for (const text of texts) {
      expect(comedyTexts.has(text)).toBe(true);
    }
  });
});

describe('pickTropePool', () => {
  it('returns exactly totalTropes unique entries for a single genre', () => {
    const pool = pickTropePool(['horror'], [], { horror: DEFAULT_GENERAL_PERCENT }, 40);
    expect(pool).toHaveLength(40);
    expect(new Set(pool).size).toBe(40);
  });

  it('respects a 0%/100% general split across two genres', () => {
    const genres = ['horror', 'comedy'];
    const subgenreSelections = [{ genre: 'horror', subgenre: 'slasher' }];
    const generalPercents = { horror: 0, comedy: 100 };
    const pool = pickTropePool(genres, subgenreSelections, generalPercents, 40);
    expect(pool).toHaveLength(40);

    // A handful of tropes are tagged with both 'general' and a specific subgenre, so a
    // trope picked via the specific pool can legitimately also carry the 'general' tag.
    // What must never happen is drawing a trope that is *only* tagged 'general'.
    const horrorGeneralOnlyTexts = new Set(
      TROPES.filter((tr) => {
        const subgenres = getTropeSubgenres(tr, 'horror');
        return subgenres.length === 1 && subgenres[0] === 'general';
      }).map((tr) => tr.text),
    );
    const comedyGeneralTexts = new Set(
      TROPES.filter((tr) => tropeHasSubgenre(tr, 'comedy', 'general')).map((tr) => tr.text),
    );
    const horrorInPool = pool.filter((text) => TROPES.some((tr) => tr.text === text && tropeHasGenre(tr, 'horror')));
    const comedyInPool = pool.filter((text) => TROPES.some((tr) => tr.text === text && tropeHasGenre(tr, 'comedy')));

    // Horror at 0% general should never draw a general-only trope.
    expect(horrorInPool.every((text) => !horrorGeneralOnlyTexts.has(text))).toBe(true);
    // Comedy at 100% general should draw exclusively from its general pool.
    expect(comedyInPool.every((text) => comedyGeneralTexts.has(text))).toBe(true);
  });

  it('splits the total as evenly as possible across multiple genres', () => {
    const pool = pickTropePool(
      ['horror', 'comedy', 'action'],
      [],
      { horror: DEFAULT_GENERAL_PERCENT, comedy: DEFAULT_GENERAL_PERCENT, action: DEFAULT_GENERAL_PERCENT },
      30,
    );
    expect(pool).toHaveLength(30);
  });

  it('does not pull a selected subgenre into another genre allocation', () => {
    const pool = pickTropePool(
      ['horror', 'adventure'],
      [{ genre: 'adventure', subgenre: 'pirate' }],
      { horror: 0, adventure: 0 },
      40,
    );
    const horrorGeneralTexts = new Set(
      TROPES.filter((tr) => tropeHasSubgenre(tr, 'horror', 'general')).map((tr) => tr.text),
    );
    const adventurePirateTexts = new Set(
      TROPES.filter((tr) => tropeHasSubgenre(tr, 'adventure', 'pirate')).map((tr) => tr.text),
    );
    expect(pool.some((text) => horrorGeneralTexts.has(text))).toBe(true);
    expect(pool.some((text) => adventurePirateTexts.has(text))).toBe(true);
  });

  it('gracefully degrades below totalTropes only if the combined pool is smaller than requested', () => {
    // Every genre has hundreds of tropes, so a small ask should always be met exactly.
    const pool = pickTropePool(['horror'], [], { horror: DEFAULT_GENERAL_PERCENT }, 25);
    expect(pool).toHaveLength(25);
  });

  it('accepts every documented TOTAL_TROPES_OPTIONS value across multiple genres', () => {
    // A single genre's general-only pool can be smaller than the largest option, so
    // spread the ask across three genres, which always have plenty combined.
    for (const total of TOTAL_TROPES_OPTIONS) {
      const pool = pickTropePool(
        ['horror', 'comedy', 'action'],
        [],
        { horror: DEFAULT_GENERAL_PERCENT, comedy: DEFAULT_GENERAL_PERCENT, action: DEFAULT_GENERAL_PERCENT },
        total,
      );
      expect(pool).toHaveLength(total);
    }
  });

  it('accepts every documented GENERAL_PERCENT_OPTIONS value without throwing', () => {
    for (const pct of GENERAL_PERCENT_OPTIONS) {
      expect(() =>
        pickTropePool(['horror'], [{ genre: 'horror', subgenre: 'slasher' }], { horror: pct }, 40),
      ).not.toThrow();
    }
  });

  it('defaults to DEFAULT_TOTAL_TROPES-sized pools being achievable for every genre alone', () => {
    for (const genre of GENRES) {
      const pool = pickTropePool([genre.id], [], { [genre.id]: DEFAULT_GENERAL_PERCENT }, DEFAULT_TOTAL_TROPES);
      expect(pool).toHaveLength(DEFAULT_TOTAL_TROPES);
    }
  });
});

describe('buildPlayerBoard', () => {
  const pool = pickTropePool(['horror'], [], { horror: DEFAULT_GENERAL_PERCENT }, 40);

  it('returns 25 entries without a free space', () => {
    const board = buildPlayerBoard(pool, false);
    expect(board).toHaveLength(25);
    expect(board.every((text) => typeof text === 'string')).toBe(true);
  });

  it('returns 25 entries with the center forced to FREE_SPACE_TEXT when useFreeSpace is true', () => {
    const board = buildPlayerBoard(pool, true);
    expect(board).toHaveLength(25);
    expect(board[CENTER_INDEX]).toBe(FREE_SPACE_TEXT);
    // Every other cell should be a real trope, not the free-space text.
    const others = board.filter((_, i) => i !== CENTER_INDEX);
    expect(others.every((text) => text !== FREE_SPACE_TEXT)).toBe(true);
  });

  it('never duplicates a trope on the same board', () => {
    const board = buildPlayerBoard(pool, false);
    expect(new Set(board).size).toBe(board.length);
  });
});
