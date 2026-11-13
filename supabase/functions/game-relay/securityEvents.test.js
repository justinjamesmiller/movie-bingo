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

  it('sends only high-signal events to the configured Discord webhook in the background', async () => {
    const webhookUrl = 'https://discord.com/api/webhooks/test/token';
    const tasks = [];
    const waitUntil = vi.fn((task) => tasks.push(task));
    const discordFetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('Deno', { env: { get: (name) => (name === 'DISCORD_ALERT_WEBHOOK_URL' ? webhookUrl : undefined) } });
    vi.stubGlobal('EdgeRuntime', { waitUntil });
    vi.stubGlobal('fetch', discordFetch);
    const logger = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      reportSecurityEvent('relay_operation_failed', 'publish', 500, {
        phase: 'database',
        userId: 'private-user',
        password: 'private-password',
      });
      reportSecurityEvent('relay_operation_failed', 'publish', 500);
      reportSecurityEvent('relay_payload_rejected', 'publish', 400);
      reportSecurityEvent('relay_rate_limited', 'publish', 429);
      expect(waitUntil).toHaveBeenCalledOnce();
      await tasks[0];

      expect(discordFetch).toHaveBeenCalledOnce();
      expect(discordFetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
      );
      const payload = JSON.parse(discordFetch.mock.calls[0][1].body);
      expect(payload.allowed_mentions).toEqual({ parse: [] });
      expect(payload.content).toContain('relay_operation_failed');
      expect(payload.content).toContain('Phase: database');
      expect(payload.content).not.toContain('private-user');
      expect(payload.content).not.toContain('private-password');
    } finally {
      logger.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('keeps relay logging when Discord alerts are not configured', () => {
    const logger = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const discordFetch = vi.spyOn(globalThis, 'fetch');
    try {
      reportSecurityEvent('relay_operation_failed', 'publish', 500);
      expect(logger).toHaveBeenCalledOnce();
      expect(discordFetch).not.toHaveBeenCalled();
    } finally {
      logger.mockRestore();
      discordFetch.mockRestore();
    }
  });
});
