// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { gateRelayRequest } from './requestGate.js';
import { MAX_RELAY_REQUEST_BYTES } from './payload.js';

function fixture(body, budget = { allowed: true }) {
  const handle = vi.fn().mockResolvedValue(new Response('handled'));
  const service = { rpc: vi.fn().mockResolvedValue({ data: budget, error: null }) };
  const input = {
    request: new Request('http://localhost/relay', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    service,
    report: vi.fn(),
    userId: 'verified-user',
    handle,
    respond: (value, status, headers = {}) => new Response(JSON.stringify(value), { status, headers }),
  };
  return { input, handle, service };
}

describe('authenticated relay request gate', () => {
  it('executes valid operations only after consuming the shared budget', async () => {
    const { input, handle, service } = fixture({ operation: 'join', code: 'ABCD', name: 'Guest' });
    expect((await gateRelayRequest(input)).status).toBe(200);
    expect(handle).toHaveBeenCalledWith({ operation: 'join', code: 'ABCD', name: 'Guest' });
    expect(service.rpc.mock.invocationCallOrder[0]).toBeLessThan(handle.mock.invocationCallOrder[0]);
  });

  it('stops exhausted budgets without running operations', async () => {
    const { input, handle } = fixture({ operation: 'join', code: 'ABCD' }, { allowed: false, retry_after_seconds: 60 });
    const response = await gateRelayRequest(input);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(handle).not.toHaveBeenCalled();
  });

  it.each([
    '{bad json',
    { operation: 'unknown', code: 'ABCD' },
    {
      operation: 'publish',
      code: 'ABCD',
      playerId: 'p1',
      message: { t: 'action', action: { t: 'vote', claimId: 'claim', agree: 1 } },
    },
  ])('charges invalid requests and never executes them', async (body) => {
    const { input, handle, service } = fixture(body);
    expect((await gateRelayRequest(input)).status).toBe(400);
    expect(service.rpc).toHaveBeenCalledTimes(1);
    expect(handle).not.toHaveBeenCalled();
  });

  it('returns 413 for oversized requests without executing or parsing their payload', async () => {
    const { input, handle, service } = fixture('x'.repeat(MAX_RELAY_REQUEST_BYTES + 1));
    const response = await gateRelayRequest(input);
    expect(response.status).toBe(413);
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_relay_request', {
      p_user_id: 'verified-user',
      p_operation: 'invalid',
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('fails closed if the database budget cannot be checked', async () => {
    const { input, handle, service } = fixture({ operation: 'join', code: 'ABCD' });
    service.rpc.mockRejectedValue(new Error('Database unreachable'));
    expect((await gateRelayRequest(input)).status).toBe(503);
    expect(handle).not.toHaveBeenCalled();
  });
});
