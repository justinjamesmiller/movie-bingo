import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// VITE_OMDB_API_KEY is read once at module load time, so we stub the env and
// re-import fresh for tests that need lookup to be "configured".
async function freshMovieLookup(apiKey) {
  vi.resetModules();
  if (apiKey === undefined) {
    vi.unstubAllEnvs();
  } else {
    vi.stubEnv('VITE_OMDB_API_KEY', apiKey);
  }
  return import('./movieLookup.js');
}

function mockFetchOnce(body, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe('isMovieLookupAvailable', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is false when no API key is configured', async () => {
    const { isMovieLookupAvailable } = await freshMovieLookup('');
    expect(isMovieLookupAvailable()).toBe(false);
  });

  it('is true once an API key is configured', async () => {
    const { isMovieLookupAvailable } = await freshMovieLookup('test-key');
    expect(isMovieLookupAvailable()).toBe(true);
  });
});

describe('searchMovies', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects when lookup is not configured', async () => {
    const { searchMovies } = await freshMovieLookup('');
    await expect(searchMovies('Alien')).rejects.toThrow(/not configured|VITE_OMDB_API_KEY/i);
  });

  it('rejects on a blank title', async () => {
    const { searchMovies } = await freshMovieLookup('test-key');
    await expect(searchMovies('   ')).rejects.toThrow(/enter a movie/i);
  });

  it('returns mapped movie and series results, tagging each with its type', async () => {
    const { searchMovies } = await freshMovieLookup('test-key');
    mockFetchOnce({
      Response: 'True',
      Search: [
        { imdbID: 'tt1', Title: 'Alien', Year: '1979', Type: 'movie', Poster: 'http://poster/1.jpg' },
        { imdbID: 'tt2', Title: 'Alien Show', Year: '2020', Type: 'series', Poster: 'N/A' },
        { imdbID: 'tt3', Title: 'Alien Episode', Year: '2020', Type: 'episode', Poster: 'N/A' },
      ],
    });
    const results = await searchMovies('Alien');
    // Episodes are filtered out -- only movie/series results are useful here.
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      imdbID: 'tt1',
      title: 'Alien',
      year: '1979',
      type: 'movie',
      poster: 'http://poster/1.jpg',
    });
    expect(results[1]).toEqual({ imdbID: 'tt2', title: 'Alien Show', year: '2020', type: 'series', poster: null });
  });

  it('throws when OMDb reports no results', async () => {
    const { searchMovies } = await freshMovieLookup('test-key');
    mockFetchOnce({ Response: 'False', Error: 'Movie not found!' });
    await expect(searchMovies('Nonexistent Title')).rejects.toThrow('Movie not found!');
  });

  it('throws a friendly error when the network request fails', async () => {
    const { searchMovies } = await freshMovieLookup('test-key');
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(searchMovies('Alien')).rejects.toThrow(/could not reach/i);
  });
});

describe('getMovieDetails', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('maps known OMDb genres to internal genre ids and surfaces unmapped ones', async () => {
    const { getMovieDetails } = await freshMovieLookup('test-key');
    mockFetchOnce({
      Response: 'True',
      Title: 'Your Monster',
      Year: '2024',
      Type: 'movie',
      Genre: 'Horror, Comedy, Romance, Musical',
      Director: 'Caroline Lindy',
      Actors: 'Melissa Barrera, Tommy Dewey',
      Poster: 'N/A',
    });
    const details = await getMovieDetails('tt0000000');
    expect(details.genres).toEqual(['horror', 'comedy', 'romance']);
    expect(details.unmapped).toEqual(['Musical']);
    expect(details.director).toBe('Caroline Lindy');
    expect(details.poster).toBeNull();
  });

  it('dedupes genres that map to the same internal id', async () => {
    const { getMovieDetails } = await freshMovieLookup('test-key');
    mockFetchOnce({
      Response: 'True',
      Title: 'Breaking Bad',
      Year: '2008–2013',
      Type: 'series',
      Genre: 'Crime, Drama, Mystery, Thriller',
      Director: 'N/A',
      Actors: 'N/A',
    });
    const details = await getMovieDetails('tt0903747');
    expect(details.genres).toEqual(['thriller', 'drama']);
    expect(details.type).toBe('series');
    expect(details.director).toBeNull();
  });

  it('throws when the title id is not found', async () => {
    const { getMovieDetails } = await freshMovieLookup('test-key');
    mockFetchOnce({ Response: 'False', Error: 'Incorrect IMDb ID.' });
    await expect(getMovieDetails('bad-id')).rejects.toThrow('Incorrect IMDb ID.');
  });
});
