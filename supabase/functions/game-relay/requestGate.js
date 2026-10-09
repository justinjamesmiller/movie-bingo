import { checkRelayBudget } from './abuseLimits.js';
import { readRelayPayload, RelayPayloadError, validateRelayPayload } from './payload.js';
import { reportSecurityEvent } from './securityEvents.js';

export async function gateRelayRequest({ request, service, userId, respond, handle, report = reportSecurityEvent }) {
  const startedAt = Date.now();
  let body;
  let payloadError;
  try {
    body = await readRelayPayload(request);
  } catch (error) {
    payloadError = error;
  }
  const budget = await checkRelayBudget(service, userId, body);
  if (budget) {
    report(
      budget.status === 429 ? 'relay_rate_limited' : 'relay_budget_unavailable',
      body?.operation,
      budget.status,
      budget.body,
    );
    return respond(budget.body, budget.status, budget.headers);
  }
  if (payloadError) {
    report('relay_payload_rejected', body?.operation, payloadError.status || 400);
    return respond(
      { error: payloadError instanceof RelayPayloadError ? payloadError.message : 'Invalid relay request.' },
      payloadError instanceof RelayPayloadError ? payloadError.status : 400,
    );
  }
  try {
    body = validateRelayPayload(body);
  } catch {
    report('relay_payload_rejected', body?.operation, 400);
    return respond({ error: 'Invalid relay payload.' }, 400);
  }
  let response;
  try {
    response = await handle(body);
  } catch (error) {
    report('relay_operation_failed', body.operation, 500);
    throw error;
  }
  if (response.status >= 400) report('relay_operation_rejected', body.operation, response.status);
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs >= 1500) report('relay_slow_request', body.operation, response.status, { elapsedMs });
  return response;
}
