# Security Operations

## Deployment Order

Publish the revision-aware frontend before applying pending transactional migrations and deploying the relay.
Apply `202610080003_reliable_game_actions.sql` after the earlier migrations, then
`202610090001_noop_action_receipts.sql` before deploying the optimized relay. Never deploy a relay that depends
on missing RPCs: budget checks intentionally fail closed. Run the live smoke script only after deployment.
Current local tests are not evidence that the linked production project has these changes.
Publishing, migrations, cloud Auth/CAPTCHA settings, alert destinations, and live verification are separate operator
actions; none are enabled automatically by the local test suite. See the README's Testing section for the isolated
browser and real-entrypoint test commands.

## Monitor

In Supabase Logs Explorer, filter game-relay function logs by these structured `event` values:

- `relay_rate_limited`: inspect bursts and sustained 429s; alert on sustained legitimate-player throttling.
- `relay_budget_unavailable` and `relay_operation_failed`: investigate immediately when recurring.
- `relay_payload_rejected`: sustained 400/408/413 traffic can indicate malformed clients or abuse.
- `relay_operation_rejected`: distinguish expected access denial from a release compatibility failure.
- `relay_delivery_pending`: the action saved successfully but broadcast delivery failed. Do not replay it as a new action.
- `relay_slow_request`: requests taking at least 1.5 seconds; compare cold starts with sustained latency.
- `relay_phase_timing`: 5%-sampled phase durations for authentication, body reads, budget/schema checks, database
  reads, commits, and broadcast delivery. Compare p50/p95 per phase without logging user IDs or payloads.

Events exclude tokens, passwords, room state, names, and authenticated user IDs. Keep alert destinations private.
Configure alert thresholds/destinations in your monitoring provider; the repository does not pretend an external
alert is active without that configuration. Review global request budgets in the SQL Editor, not through browser roles:

```sql
select subject, requests, window_started_at
from public.bingo_relay_request_budget
where subject like 'global:%';
```

Alert before daily budgets reach 90% of their configured limits. Review room/receipt growth and cleanup alongside
request counts; rate-limit ceilings are not a guarantee that free-tier resource budgets cannot be exceeded.

## Anonymous Auth

Use the Supabase Auth dashboard/logs to monitor anonymous signups and signup rate-limit failures independently
of relay requests. Confirm the project's anonymous-signup IP limit is configured; shared households should still
be able to admit ten players. Relay limits do not prevent an attacker from creating Auth users directly.
For a public launch, enable a supported CAPTCHA with real provider keys and wire its token into anonymous sign-in.
Do not enable mandatory CAPTCHA until the frontend can supply those tokens. The linked project's Auth JWT expiry is
300 seconds (configured 2026-10-09); this live setting is not managed by repository changes. CAPTCHA provider keys and
mandatory CAPTCHA remain unconfigured.

## Live Revocation Test

Use an isolated test room and two authenticated browser identities. Subscribe the first identity to the private
channel, then recover/kick that seat from the second session. Keep the first subscription open using a test client
that deliberately does not follow the app's disconnect instruction. Verify direct writes and reconnect are denied,
then attempt a private broadcast. Supabase caches channel authorization for the connection; removing membership does
not immediately evict an already-subscribed client. It can keep receiving broadcasts until it sends a new JWT or its
current JWT expires. The live smoke test observed this behavior. The app closes a compliant client's channel after
its next denied request, but that is not immediate server-side revocation. Set an appropriately short JWT lifetime
in Supabase Auth to bound stale access. The linked project is configured for 300-second JWTs, but tokens already
issued retain their original expiry. If immediate confidentiality after seat revocation is required, use an
architecture with per-session revocable channel credentials or a transport with server-side forced disconnect;
rotating the room code alone is insufficient if the update is broadcast on the old channel.

## Retry Semantics

Updated clients send stable UUID action IDs. Server receipts are atomic with state saves and deduplicate retries
for a 24-hour retention window; rooms deleting or expiring also remove their receipts. Reusing an ID with different
content is rejected. Actions without IDs remain compatible but do not gain replay protection. A committed action
returns its authoritative state even if a notification fails. Other clients reconcile on subsequent snapshots and
heartbeats; the notification path is not a durable delivery queue.

Unchanged actions still save receipts but do not rewrite the room, increment its revision, or broadcast a snapshot.
View batches are included in action hashes and applied before the accompanying action. Actions without view batches
retain their original hash format so outstanding retries remain compatible across deployment.
