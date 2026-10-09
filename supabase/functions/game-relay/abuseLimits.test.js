import { describe, expect, it, vi } from 'vitest';
import { checkRelayBudget } from './abuseLimits.js';

describe('relay abuse budget gate', () => {
  it.each([
    'create',
    'join',
    'publish',
    'heartbeat',
    'join-status',
    'leave',
    'claim-seat',
    'cancel-join',
    'recover-host',
    'set-host-recovery-password',
  ])('checks %s with the authenticated identity', async (operation) => {
    const service = { rpc: vi.fn().mockResolvedValue({ data: { allowed: true }, error: null }) };
    expect(await checkRelayBudget(service, 'authenticated-user', { operation, userId: 'forged-user' })).toBeNull();
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_relay_request', {
      p_user_id: 'authenticated-user',
      p_operation: operation,
    });
  });

  it('places join-form password attempts in the recovery budget', async () => {
    const service = { rpc: vi.fn().mockResolvedValue({ data: { allowed: true }, error: null }) };
    await checkRelayBudget(service, 'user', { operation: 'join', hostRecoveryPassword: 'xy' });
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_relay_request', {
      p_user_id: 'user',
      p_operation: 'recover-host',
    });
  });

  it('returns retry information for an exhausted shared budget', async () => {
    const service = {
      rpc: vi.fn().mockResolvedValue({ data: { allowed: false, retry_after_seconds: 42 }, error: null }),
    };
    expect(await checkRelayBudget(service, 'user', { operation: 'publish' })).toMatchObject({
      status: 429,
      headers: { 'Retry-After': '42' },
      body: { retryAfterSeconds: 42 },
    });
  });

  it.each([
    { data: null, error: { message: 'Database error' } },
    { data: {}, error: null },
  ])('fails closed on budget failures', async (result) => {
    const service = { rpc: vi.fn().mockResolvedValue(result) };
    expect((await checkRelayBudget(service, 'user', { operation: 'create' })).status).toBe(503);
  });

  it('counts invalid requests against the control budget and handles thrown errors safely', async () => {
    const service = { rpc: vi.fn().mockRejectedValue(new Error('Connection failed')) };
    expect((await checkRelayBudget(service, 'user', null)).status).toBe(503);
    expect(service.rpc).toHaveBeenCalledWith('consume_bingo_relay_request', {
      p_user_id: 'user',
      p_operation: 'invalid',
    });
  });
});
