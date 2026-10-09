import { describe, expect, it, vi } from 'vitest';
import { reportSecurityEvent } from './securityEvents.js';

describe('privacy-safe security events', () => {
  it('logs only approved metadata and never payloads, identities or secrets', () => {
    const logger = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      reportSecurityEvent('relay_rate_limited', 'publish', 429, {
        retryAfterSeconds: 60,
        password: 'secret',
        userId: 'private',
        body: { name: 'Private name' },
      });
      expect(JSON.parse(logger.mock.calls[0][0])).toEqual({
        event: 'relay_rate_limited',
        operation: 'publish',
        status: 429,
        retryAfterSeconds: 60,
      });
      reportSecurityEvent('relay_payload_rejected', 'attacker-controlled-string', 400);
      expect(JSON.parse(logger.mock.calls[1][0]).operation).toBe('invalid');
    } finally {
      logger.mockRestore();
    }
  });
});
