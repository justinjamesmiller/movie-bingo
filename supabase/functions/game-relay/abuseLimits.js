export async function checkRelayBudget(service, userId, body) {
  const operation =
    body?.operation === 'join' && typeof body.hostRecoveryPassword === 'string' && body.hostRecoveryPassword.length
      ? 'recover-host'
      : typeof body?.operation === 'string'
        ? body.operation
        : 'invalid';
  try {
    const { data, error } = await service.rpc('consume_bingo_relay_request', {
      p_user_id: userId,
      p_operation: operation,
    });
    if (error || !data || typeof data.allowed !== 'boolean') {
      return { status: 503, body: { error: 'Could not check the relay request budget. Please try again.' } };
    }
    if (data.allowed) return null;
    const retryAfterSeconds = Number.isSafeInteger(data.retry_after_seconds)
      ? Math.max(1, Math.min(86400, data.retry_after_seconds))
      : 60;
    return {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
      body: { error: 'Relay request limit reached. Please try again later.', retryAfterSeconds },
    };
  } catch {
    return { status: 503, body: { error: 'Could not check the relay request budget. Please try again.' } };
  }
}
