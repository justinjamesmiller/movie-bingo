import { describe, expect, it, vi } from 'vitest';
import { createMovieLookupHandler } from './handler.js';

function setup(overrides = {}) {
  const dependencies = {
    authenticate: vi.fn().mockResolvedValue({ id: 'user-id' }),
    consumeBudget: vi.fn().mockResolvedValue(true),
    apiKey: 'upstream-secret',
    fetchMovie: vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ Response: 'True', Search: [] })))),
    ...overrides,
  };
  return { dependencies, handle: createMovieLookupHandler(dependencies) };
}

function request(body) {
  return new Request('https://example.supabase.co/functions/v1/movie-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('authenticated movie lookup proxy', () => {
  it('denies unauthenticated requests without contacting OMDb', async () => {
    const { handle, dependencies } = setup({ authenticate: vi.fn().mockResolvedValue(null) });
    expect((await handle(request({ mode: 'search', query: 'Alien' }))).status).toBe(401);
    expect(dependencies.fetchMovie).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'search', query: '' },
    { mode: 'search', query: '(2026)' },
    { mode: 'details', query: 'bad-id' },
    { mode: 'search', query: 'a'.repeat(121) },
    { mode: '__proto__', query: 'Alien' },
    { mode: 'search', query: { title: 'Alien' } },
    null,
  ])('rejects malformed query %j before consuming budget', async (body) => {
    const { handle, dependencies } = setup();
    expect((await handle(request(body))).status).toBe(400);
    expect(dependencies.consumeBudget).not.toHaveBeenCalled();
    expect(dependencies.fetchMovie).not.toHaveBeenCalled();
  });

  it.each([
    ['search', 's', 'Alien'],
    ['details', 'i', 'tt0078748'],
    ['title', 't', 'Alien'],
  ])('forwards only the allowed %s parameter and keeps the key out of the response', async (mode, parameter, query) => {
    const { handle, dependencies } = setup();
    const response = await handle(request({ mode, query, apikey: 'attacker-key', extra: 'ignored' }));
    expect(response.status).toBe(200);
    const upstream = dependencies.fetchMovie.mock.calls[0][0];
    expect(upstream.origin).toBe('https://www.omdbapi.com');
    expect([...upstream.searchParams.keys()]).toEqual(
      mode === 'search' ? ['apikey', parameter, 'type'] : ['apikey', parameter],
    );
    expect(upstream.searchParams.get('apikey')).toBe('upstream-secret');
    expect(upstream.searchParams.get(parameter)).toBe(query);
    expect(await response.text()).not.toContain('upstream-secret');
    expect(dependencies.consumeBudget).toHaveBeenCalledWith('user-id');
  });

  it('returns up to 50 movie and series matches in type-filtered, budgeted pages', async () => {
    const fetchMovie = vi.fn((url) => {
      const page = Number(url.searchParams.get('page') || 1);
      const type = url.searchParams.get('type');
      const Search = Array.from({ length: 10 }, (_, index) => ({ imdbID: `tt${type}${page}${index}` }));
      return Promise.resolve(new Response(JSON.stringify({ Response: 'True', totalResults: '67', Search })));
    });
    const { handle, dependencies } = setup({ fetchMovie });
    const response = await handle(request({ mode: 'search', query: 'Alien' }));

    expect(response.status).toBe(200);
    expect((await response.json()).Search).toHaveLength(50);
    expect(fetchMovie).toHaveBeenCalledTimes(6);
    expect(fetchMovie.mock.calls.map(([url]) => [url.searchParams.get('type'), url.searchParams.get('page')])).toEqual([
      ['movie', null],
      ['series', null],
      ['movie', '2'],
      ['series', '2'],
      ['movie', '3'],
      ['series', '3'],
    ]);
    expect(dependencies.consumeBudget).toHaveBeenCalledTimes(6);
  });

  it('can return 50 series matches when there are no movie matches', async () => {
    const fetchMovie = vi.fn((url) => {
      if (url.searchParams.get('type') === 'movie') {
        return Promise.resolve(new Response(JSON.stringify({ Response: 'False', Error: 'Movie not found!' })));
      }
      const page = Number(url.searchParams.get('page') || 1);
      const Search = Array.from({ length: 10 }, (_, index) => ({ imdbID: `ttseries${page}${index}` }));
      return Promise.resolve(new Response(JSON.stringify({ Response: 'True', totalResults: '50', Search })));
    });
    const { handle } = setup({ fetchMovie });
    const response = await handle(request({ mode: 'search', query: 'Example' }));

    expect(response.status).toBe(200);
    expect((await response.json()).Search).toHaveLength(50);
    expect(fetchMovie).toHaveBeenCalledTimes(6);
  });

  it('uses a trailing year to search the title and excludes results from other years', async () => {
    const fetchMovie = vi.fn((url) => {
      expect(url.searchParams.get('s')).toBe('Resident Evil');
      expect(url.searchParams.get('y')).toBe('2002');
      const Search =
        url.searchParams.get('type') === 'movie'
          ? [
              { imdbID: 'tt2002', Title: 'Resident Evil', Year: '2002', Type: 'movie' },
              { imdbID: 'tt2004', Title: 'Resident Evil: Apocalypse', Year: '2004', Type: 'movie' },
            ]
          : [{ imdbID: 'ttseries', Title: 'Resident Evil', Year: '2002–2003', Type: 'series' }];
      return Promise.resolve(
        new Response(JSON.stringify({ Response: 'True', totalResults: String(Search.length), Search })),
      );
    });
    const { handle } = setup({ fetchMovie });
    const response = await handle(request({ mode: 'search', query: 'Resident Evil (2002)' }));

    expect(response.status).toBe(200);
    expect((await response.json()).Search).toEqual([
      { imdbID: 'tt2002', Title: 'Resident Evil', Year: '2002', Type: 'movie' },
      { imdbID: 'ttseries', Title: 'Resident Evil', Year: '2002–2003', Type: 'series' },
    ]);
    expect(fetchMovie).toHaveBeenCalledTimes(2);
  });

  it('falls back to OMDb exact-title lookup when year-filtered search misses a movie', async () => {
    const fetchMovie = vi.fn((url) => {
      if (url.searchParams.has('t')) {
        expect(url.searchParams.get('t')).toBe('Resident Evil');
        expect(url.searchParams.get('y')).toBe('2026');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              Response: 'True',
              imdbID: 'tt35538033',
              Title: 'Resident Evil',
              Year: '2026',
              Type: 'movie',
              Poster: 'https://example.com/poster.jpg',
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ Response: 'False', Error: 'Movie not found!' })));
    });
    const { handle, dependencies } = setup({ fetchMovie });
    const response = await handle(request({ mode: 'search', query: 'Resident Evil (2026)' }));

    expect(response.status).toBe(200);
    expect((await response.json()).Search).toEqual([
      {
        imdbID: 'tt35538033',
        Title: 'Resident Evil',
        Year: '2026',
        Type: 'movie',
        Poster: 'https://example.com/poster.jpg',
      },
    ]);
    expect(fetchMovie).toHaveBeenCalledTimes(3);
    expect(dependencies.consumeBudget).toHaveBeenCalledTimes(3);
  });

  it('stops pagination when the user budget is exhausted', async () => {
    const { handle, dependencies } = setup({
      consumeBudget: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
      fetchMovie: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ Response: 'True', totalResults: '50', Search: [] }))),
    });
    const response = await handle(request({ mode: 'search', query: 'Alien' }));

    expect(response.status).toBe(429);
    expect(dependencies.fetchMovie).toHaveBeenCalledTimes(1);
    expect(dependencies.consumeBudget).toHaveBeenCalledTimes(2);
  });

  it('enforces server budget exhaustion without calling the upstream', async () => {
    const { handle, dependencies } = setup({ consumeBudget: vi.fn().mockResolvedValue(false) });
    expect((await handle(request({ mode: 'search', query: 'Alien' }))).status).toBe(429);
    expect(dependencies.fetchMovie).not.toHaveBeenCalled();
  });

  it('does not expose upstream errors or credentials', async () => {
    const { handle } = setup({ fetchMovie: vi.fn().mockRejectedValue(new Error('upstream-secret')) });
    const response = await handle(request({ mode: 'search', query: 'Alien' }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('upstream-secret');
  });
});
