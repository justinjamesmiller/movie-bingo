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

const discordAlertEvents = new Set(['relay_budget_unavailable', 'relay_operation_failed', 'relay_delivery_pending']);
const discordAlertCooldownMs = 5 * 60 * 1000;
const lastDiscordAlertAt = new Map();

function scheduleDiscordAlert(eventData) {
  if (!discordAlertEvents.has(eventData.event)) return;
  const webhookUrl = globalThis.Deno?.env?.get?.('DISCORD_ALERT_WEBHOOK_URL');
  if (typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

  const cooldownKey = `${eventData.event}:${eventData.operation}`;
  const now = Date.now();
  if (now - (lastDiscordAlertAt.get(cooldownKey) ?? -Infinity) < discordAlertCooldownMs) return;
  lastDiscordAlertAt.set(cooldownKey, now);

  const details = [
    `**Movie/TV Trope Bingo: ${eventData.event}**`,
    `Operation: ${eventData.operation} | Status: ${eventData.status}`,
    ...(eventData.phase ? [`Phase: ${eventData.phase}`] : []),
    ...(Number.isSafeInteger(eventData.retryAfterSeconds) ? [`Retry after: ${eventData.retryAfterSeconds}s`] : []),
    ...(Number.isSafeInteger(eventData.elapsedMs) ? [`Elapsed: ${eventData.elapsedMs}ms`] : []),
  ];
  const task = globalThis
    .fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: details.join('\n'), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(3000),
    })
    .then((response) => {
      if (!response.ok) console.error(JSON.stringify({ event: 'relay_discord_alert_failed', status: response.status }));
    })
    .catch(() => console.error(JSON.stringify({ event: 'relay_discord_alert_failed' })));

  const edgeRuntime = globalThis.EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === 'function') edgeRuntime.waitUntil(task);
  else void task;
}

export function reportSecurityEvent(event, operation, status, extra = {}) {
  const eventData = {
    event,
    operation: operations.has(operation) ? operation : 'invalid',
    status,
    ...(Number.isSafeInteger(extra.retryAfterSeconds) && { retryAfterSeconds: extra.retryAfterSeconds }),
    ...(Number.isSafeInteger(extra.elapsedMs) && extra.elapsedMs >= 0 && { elapsedMs: extra.elapsedMs }),
    ...(['authentication', 'body_read', 'budget', 'validation', 'database', 'commit', 'broadcast'].includes(
      extra.phase,
    ) && { phase: extra.phase }),
  };
  console.warn(JSON.stringify(eventData));
  scheduleDiscordAlert(eventData);
}
