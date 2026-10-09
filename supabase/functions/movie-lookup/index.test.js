// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const service = vi.hoisted(() => ({ auth: { getUser: vi.fn() }, rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => service }));
let handler;
let fetchMovie;
beforeAll(async () => {
  fetchMovie = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ Response: 'True', Title: 'Example' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMovie);
  vi.stubGlobal('Deno', {
    env: { get: () => 'test-value' },
    serve: (callback) => {
      handler = callback;
    },
  });
  await import('./index.js');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  service.auth.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
  service.rpc.mockResolvedValue({ data: true, error: null });
});
const request = (auth) =>
  new Request('http://localhost/movie-lookup', {
    method: 'POST',
    body: JSON.stringify({ mode: 'title', query: 'Example' }),
    headers: auth ? { authorization: 'Bearer test-token' } : {},
  });
describe('movie-lookup deployed entrypoint', () => {
  it('rejects missing or invalid JWTs without budget/upstream work', async () => {
    expect((await handler(request(false))).status).toBe(401);
    service.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });
    expect((await handler(request(true))).status).toBe(401);
    expect(service.rpc).not.toHaveBeenCalled();
    expect(fetchMovie).not.toHaveBeenCalled();
  });
  it('uses the verified identity for budget checks and rejects exhausted budgets', async () => {
    service.rpc.mockResolvedValue({ data: false, error: null });
    expect((await handler(request(true))).status).toBe(429);
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_movie_lookup', { p_user_id: 'verified-user' });
    expect(fetchMovie).not.toHaveBeenCalled();
  });
  it('fails closed when the budget database fails', async () => {
    service.rpc.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } });
    expect((await handler(request(true))).status).toBe(502);
    expect(fetchMovie).not.toHaveBeenCalled();
  });
  it('executes a permitted lookup through the registered handler', async () => {
    expect((await handler(request(true))).status).toBe(200);
    expect(fetchMovie).toHaveBeenCalledTimes(1);
  });
});
