import { describe, expect, it, vi } from 'vitest';
import { createMovieLookupHandler } from './handler.js';

function setup(overrides = {}) {
  const dependencies = {
    authenticate: vi.fn().mockResolvedValue({ id: 'user-id' }),
    consumeBudget: vi.fn().mockResolvedValue(true),
    apiKey: 'upstream-secret',
    fetchMovie: vi.fn().mockResolvedValue(new Response(JSON.stringify({ Response: 'True', Search: [] }))),
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
    expect([...upstream.searchParams.keys()]).toEqual(['apikey', parameter]);
    expect(upstream.searchParams.get('apikey')).toBe('upstream-secret');
    expect(upstream.searchParams.get(parameter)).toBe(query);
    expect(await response.text()).not.toContain('upstream-secret');
    expect(dependencies.consumeBudget).toHaveBeenCalledWith('user-id');
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
