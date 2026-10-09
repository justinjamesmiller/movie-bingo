const operations = new Set([
  'create',
  'join',
  'publish',
  'heartbeat',
  'join-status',
  'leave',
  'cancel-join',
  'claim-seat',
  'recover-host',
  'set-host-recovery-password',
]);

export function reportSecurityEvent(event, operation, status, extra = {}) {
  console.warn(
    JSON.stringify({
      event,
      operation: operations.has(operation) ? operation : 'invalid',
      status,
      ...(Number.isSafeInteger(extra.retryAfterSeconds) && { retryAfterSeconds: extra.retryAfterSeconds }),
      ...(Number.isSafeInteger(extra.elapsedMs) && extra.elapsedMs >= 0 && { elapsedMs: extra.elapsedMs }),
      ...(['authentication', 'body_read', 'budget', 'validation', 'database', 'commit', 'broadcast'].includes(
        extra.phase,
      ) && { phase: extra.phase }),
    }),
  );
}
