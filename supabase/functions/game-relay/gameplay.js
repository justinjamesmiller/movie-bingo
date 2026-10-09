import { applyServerGameAction } from '../../../src/net/relay.js';
import { reportSecurityEvent } from './securityEvents.js';
import { createPhaseTimings } from './performance.js';

const reply = (body, status = 200) => ({ body, status });

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export async function executeGameplay({
  service,
  broadcast,
  broadcastMany,
  code,
  playerId,
  action,
  userId,
  initialRoom,
  requestId,
  viewBatch,
  report = reportSecurityEvent,
  timings = createPhaseTimings(report),
}) {
  timings.setOperation('publish');
  const hash = requestId
    ? Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(JSON.stringify(canonical(viewBatch ? { action, viewBatch } : action))),
          ),
        ),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('')
    : undefined;
  const { error: presenceError } = await service
    .from('bingo_room_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('room_code', code)
    .eq('player_id', playerId)
    .eq('user_id', userId)
    .eq('status', 'active');
  if (presenceError) return reply({ error: 'Could not update player presence.' }, 500);
  for (let attempt = 0; attempt < 32; attempt++) {
    const [roomResult, membersResult] = await timings.measure('database', () =>
      Promise.all([
        attempt === 0 && initialRoom
          ? { data: initialRoom, error: null }
          : service.from('bingo_rooms').select('state, revision, expires_at').eq('code', code).maybeSingle(),
        service.from('bingo_room_members').select('player_id, user_id, status, last_seen_at').eq('room_code', code),
      ]),
    );
    const { data: room, error: roomError } = roomResult;
    if (roomError) return reply({ error: 'Could not load game state.' }, 500);
    if (!room || new Date(room.expires_at).getTime() <= Date.now())
      return reply({ error: 'Game session expired.' }, 410);
    const { data: members, error: membersError } = membersResult;
    if (membersError) return reply({ error: 'Could not check player presence.' }, 500);
    if (
      !members.some(
        (member) => member.player_id === playerId && member.user_id === userId && member.status === 'active',
      ) ||
      !Object.hasOwn(room.state.players, playerId)
    )
      return reply({ error: 'Active seat required.' }, 403);
    const snapshot = structuredClone(room.state);
    for (const player of Object.values(snapshot.players)) {
      const member = members.find((entry) => entry.player_id === player.id);
      player.connected = member?.status === 'active' && Date.now() - new Date(member.last_seen_at).getTime() < 120_000;
    }
    const result = applyServerGameAction(snapshot, playerId, action, viewBatch);
    const changed = JSON.stringify(result.state) !== JSON.stringify(room.state);
    if (!requestId && !changed) {
      return reply({ ok: true, state: room.state, revision: room.revision, code });
    }
    if (changed) result.state.rev = (room.state.rev || 0) + 1;
    const commit = await timings.measure('commit', () =>
      service.rpc(requestId ? 'commit_bingo_action' : 'commit_bingo_gameplay_state', {
        p_code: code,
        p_expected_revision: room.revision,
        p_state: result.state,
        ...(requestId && { p_user_id: userId, p_player_id: playerId, p_request_id: requestId, p_action_hash: hash }),
      }),
    );
    if (commit.error) return reply({ error: 'Could not save game action.' }, 500);
    if (commit.data?.error === 'membership_required') return reply({ error: 'Active seat required.' }, 403);
    if (commit.data?.error === 'request_id_reused')
      return reply({ error: 'Action ID was reused for different content.' }, 409);
    if (commit.data?.conflict) continue;
    if (!commit.data?.saved) return reply({ error: 'Game action could not be committed.' }, 409);
    if (commit.data.unchanged)
      return reply({ ok: true, state: commit.data.state, revision: commit.data.revision, code, unchanged: true });
    let deliveryPending = false;
    try {
      const messages = [{ t: 'state', state: commit.data.state }, ...(commit.data.replayed ? [] : result.messages)];
      await timings.measure('broadcast', async () => {
        if (broadcastMany) await broadcastMany(code, messages, 'pserver');
        else for (const message of messages) await broadcast(code, message, 'pserver');
      });
    } catch {
      deliveryPending = true;
      report('relay_delivery_pending', 'publish', 200);
    }
    return reply({
      ok: true,
      state: commit.data.state,
      revision: commit.data.revision,
      code,
      deliveryPending,
      replayed: !!commit.data.replayed,
    });
  }
  return reply({ error: 'Game is busy. Please retry that action.' }, 409);
}
