import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSuggestedSubgenres, isWikidataLookupAvailable } from './wikidataLookup.js';

function mockFetch(body, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));
}

describe('wikidataLookup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is always available because it needs no API key', () => {
    expect(isWikidataLookupAvailable()).toBe(true);
  });

  it('returns unique matching subgenre suggestions from Wikidata labels', async () => {
    mockFetch({
      results: {
        bindings: [
          { genreLabel: { value: 'Psychological horror film' } },
          { genreLabel: { value: 'ghost film' } },
          { genreLabel: { value: 'psychological horror film' } },
        ],
      },
    });

    await expect(getSuggestedSubgenres('tt0081505')).resolves.toEqual([
      { genre: 'horror', subgenre: 'supernatural' },
      { genre: 'horror', subgenre: 'psychological' },
    ]);
  });

  it('suggests specific TV subgenres from Wikidata labels', async () => {
    mockFetch({
      results: {
        bindings: [
          { genreLabel: { value: 'Cooking show' } },
          { genreLabel: { value: 'Dating game show' } },
          { genreLabel: { value: 'Medical drama' } },
        ],
      },
    });

    await expect(getSuggestedSubgenres('tt0000002')).resolves.toEqual([
      { genre: 'tv', subgenre: 'cooking' },
      { genre: 'tv', subgenre: 'dating' },
      { genre: 'tv', subgenre: 'game-show' },
      { genre: 'tv', subgenre: 'medical' },
    ]);
  });

  it('returns no suggestions for missing ids, failed responses, or malformed results', async () => {
    expect(await getSuggestedSubgenres('')).toEqual([]);
    mockFetch({}, false);
    expect(await getSuggestedSubgenres('tt0000001')).toEqual([]);
    mockFetch({ results: {} });
    expect(await getSuggestedSubgenres('tt0000001')).toEqual([]);
  });

  it('swallows network and JSON failures because suggestions are optional', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await getSuggestedSubgenres('tt0000001')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('bad json')) }));
    expect(await getSuggestedSubgenres('tt0000001')).toEqual([]);
  });
});
