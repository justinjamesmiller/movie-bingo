import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const hostOnlyActions = new Set([
  'start',
  'reset',
  'gameOver',
  'resumeGame',
  'updateSessionLifetime',
  'updateMovie',
  'proposeProfileChange',
  'restoreDisconnectedBoard',
  'addHost',
  'resignHost',
  'kick',
  'approveJoin',
  'denyJoin',
]);
const MAX_ROOM_PLAYERS = 32;
const RECOVERY_PASSWORD_ITERATIONS = 310000;
const MIN_RECOVERY_PASSWORD_LENGTH = 12;
const MAX_RECOVERY_PASSWORD_LENGTH = 128;
const textEncoder = new TextEncoder();

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validCode(code) {
  return typeof code === 'string' && /^[A-HJ-NP-Z2-9]{4}$/.test(code);
}

function validPlayerId(id) {
  return typeof id === 'string' && /^p[a-z0-9]{1,20}$/.test(id);
}

function encodeBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveRecoveryVerifier(password, salt, iterations = RECOVERY_PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function hashRecoveryPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveRecoveryVerifier(password, salt);
  return `pbkdf2-sha256$${RECOVERY_PASSWORD_ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(verifier)}`;
}

async function verifyRecoveryPassword(password, encoded) {
  try {
    const [algorithm, iterationText, saltText, verifierText] = encoded.split('$');
    const iterations = Number(iterationText);
    if (algorithm !== 'pbkdf2-sha256' || iterations !== RECOVERY_PASSWORD_ITERATIONS) return false;
    const expected = decodeBase64(verifierText);
    const actual = await deriveRecoveryVerifier(password, decodeBase64(saltText), iterations);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}

function validState(state, code, playerId) {
  return (
    state &&
    typeof state === 'object' &&
    !Array.isArray(state) &&
    state.code === code &&
    state.players &&
    typeof state.players === 'object' &&
    !Array.isArray(state.players) &&
    Object.hasOwn(state.players, playerId) &&
    Array.isArray(state.seatOrder) &&
    Array.isArray(state.hostIds) &&
    Array.isArray(state.acceptedTropes) &&
    Object.keys(state.players).length <= MAX_ROOM_PLAYERS &&
    JSON.stringify(state).length <= 1_000_000
  );
}

function randomPlayerId() {
  return `p${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function membershipQuery(code, userId, id) {
  let query = service
    .from('bingo_room_members')
    .select('room_code, player_id, user_id, is_host, status')
    .eq('room_code', code)
    .eq('user_id', userId);
  if (id) query = query.eq('player_id', id);
  return query;
}

async function setHostRecoveryPassword(user, body) {
  const { code, playerId, password } = body;
  if (
    !validCode(code) ||
    !validPlayerId(playerId) ||
    typeof password !== 'string' ||
    password.length < MIN_RECOVERY_PASSWORD_LENGTH ||
    password.length > MAX_RECOVERY_PASSWORD_LENGTH
  ) {
    return json({ error: 'Use a host recovery password between 12 and 128 characters.' }, 400);
  }
  const { data: member } = await membershipQuery(code, user.id, playerId).maybeSingle();
  if (!member?.is_host || member.status !== 'active') return json({ error: 'An active host seat is required.' }, 403);
  const { data: room } = await service.from('bingo_rooms').select('state').eq('code', code).maybeSingle();
  if (room?.state?.seatOrder?.[0] !== playerId || !room.state.hostIds?.includes(playerId)) {
    return json({ error: 'Only the original host can set the host recovery password.' }, 403);
  }
  const passwordHash = await hashRecoveryPassword(password);
  const now = new Date().toISOString();
  const { error } = await service
    .from('bingo_rooms')
    .update({
      host_recovery_player_id: playerId,
      host_recovery_password_hash: passwordHash,
      host_recovery_attempts: 0,
      host_recovery_window_started_at: now,
      host_recovery_locked_until: null,
    })
    .eq('code', code);
  if (error) return json({ error: 'Could not save the host recovery password.' }, 500);
  return json({ ok: true });
}

async function recoverHost(user, body) {
  const { code, password, name } = body;
  if (
    !validCode(code) ||
    typeof password !== 'string' ||
    password.length < MIN_RECOVERY_PASSWORD_LENGTH ||
    password.length > MAX_RECOVERY_PASSWORD_LENGTH
  ) {
    return json({ error: 'The host recovery password is invalid.' }, 403);
  }
  const { data: room } = await service
    .from('bingo_rooms')
    .select('state, expires_at, host_seen_at, host_recovery_player_id, host_recovery_password_hash')
    .eq('code', code)
    .maybeSingle();
  if (!room || new Date(room.expires_at).getTime() <= Date.now() || room.state?.gameOver) {
    return json({ error: 'No recoverable host seat was found.' }, 404);
  }
  if (!room.host_recovery_password_hash || !room.host_recovery_player_id) {
    return json({ error: 'The host recovery password is incorrect or is not configured.' }, 403);
  }
  const { data: allowed, error: rateLimitError } = await service.rpc('consume_bingo_host_recovery_attempt', {
    p_code: code,
  });
  if (rateLimitError) return json({ error: 'Could not verify host recovery right now.' }, 500);
  if (!allowed) return json({ error: 'Too many recovery attempts. Try again in 15 minutes.' }, 429);
  if (!(await verifyRecoveryPassword(password, room.host_recovery_password_hash))) {
    return json({ error: 'The host recovery password is incorrect or is not configured.' }, 403);
  }

  const playerId = room.host_recovery_player_id;
  const { data: recovered, error: recoveryError } = await service.rpc('recover_bingo_host', {
    p_code: code,
    p_player_id: playerId,
    p_user_id: user.id,
    p_name: typeof name === 'string' ? name : '',
    p_expected_password_hash: room.host_recovery_password_hash,
  });
  if (recoveryError) return json({ error: 'Could not restore the host game state.' }, 500);
  if (recovered?.error) {
    const messages = {
      host_still_connected: 'The original host still appears connected. Try again after they disconnect.',
      not_recoverable: 'No recoverable host seat was found.',
      host_seat_missing: 'No recoverable host seat was found.',
      password_changed: 'The host recovery password changed. Try again with the current password.',
      host_membership_missing: 'Could not restore the original host seat.',
    };
    const status = recovered.error === 'not_recoverable' || recovered.error === 'host_seat_missing' ? 404 : 409;
    return json({ error: messages[recovered.error] || 'Could not restore the original host seat.' }, status);
  }
  try {
    await broadcast(code, { t: 'state', state: recovered.state }, playerId);
  } catch {
    // The restored host publishes this same authoritative state on channel join.
  }
  return json({ playerId, isHost: true, status: 'active', revision: recovered.revision, state: recovered.state });
}

async function authenticate(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const { data, error } = await service.auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}

async function broadcast(code, message, sender) {
  const channel = service.channel(`bingo-${code}`, {
    config: { private: true, broadcast: { self: false } },
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Realtime relay timed out.')), 5000);
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          reject(error || new Error(`Realtime relay ${status.toLowerCase()}.`));
        }
      });
    });
    const result = await channel.send({
      type: 'broadcast',
      event: 'msg',
      payload: { ...message, sender },
    });
    if (result !== 'ok') throw new Error('Realtime relay rejected the message.');
  } finally {
    await service.removeChannel(channel);
  }
}

async function createRoom(user, body) {
  const { code, playerId: hostPlayerId } = body;
  const state = body.state && typeof body.state === 'object' ? { ...body.state, serverRevision: 0 } : body.state;
  if (!validCode(code) || !validPlayerId(hostPlayerId) || !validState(state, code, hostPlayerId)) {
    return json({ error: 'Invalid room setup.' }, 400);
  }
  state.serverRevision = 0;
  const expiresAt = Number.isFinite(state.sessionExpiresAt)
    ? new Date(state.sessionExpiresAt).toISOString()
    : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error: roomError } = await service
    .from('bingo_rooms')
    .insert({ code, state, expires_at: expiresAt, host_seen_at: new Date().toISOString() });
  if (roomError) return json({ error: 'Could not create that game code.' }, 409);
  const { error: memberError } = await service.from('bingo_room_members').insert({
    room_code: code,
    player_id: hostPlayerId,
    user_id: user.id,
    is_host: true,
    status: 'active',
  });
  if (memberError) {
    await service.from('bingo_rooms').delete().eq('code', code);
    return json({ error: 'Could not register the host seat.' }, 500);
  }
  return json({ playerId: hostPlayerId, revision: 0 });
}

async function joinRoom(user, body) {
  const { code, requestedPlayerId, newSeat = false } = body;
  if (!validCode(code) || (requestedPlayerId != null && !validPlayerId(requestedPlayerId))) {
    return json({ error: 'Invalid game code.' }, 400);
  }
  if (typeof body.hostRecoveryPassword === 'string' && body.hostRecoveryPassword.length > 0) {
    return recoverHost(user, { ...body, password: body.hostRecoveryPassword });
  }
  await service.from('bingo_rooms').delete().lt('expires_at', new Date().toISOString());
  const { data: room, error: roomError } = await service
    .from('bingo_rooms')
    .select('code, state, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (roomError || !room) return json({ error: 'No game was found with that code.' }, 404);
  if (room.state?.gameOver) return json({ error: 'That game has ended.' }, 410);

  if (!newSeat && requestedPlayerId) {
    const { data: claimedSeat } = await service
      .from('bingo_room_members')
      .select('user_id')
      .eq('room_code', code)
      .eq('player_id', requestedPlayerId)
      .maybeSingle();
    if (claimedSeat && claimedSeat.user_id !== user.id) {
      return json({ error: 'That player seat belongs to another authenticated identity.' }, 403);
    }
    const { data: savedMember } = await membershipQuery(code, user.id, requestedPlayerId).maybeSingle();
    if (savedMember?.status === 'revoked') return json({ error: 'That seat is no longer available.' }, 403);
    if (savedMember) {
      return json({
        playerId: savedMember.player_id,
        isHost: savedMember.is_host,
        status: savedMember.status,
        needsApproval: savedMember.status === 'pending',
        state: savedMember.status === 'active' ? room.state : undefined,
      });
    }
  }
  if (Object.keys(room.state.players || {}).length >= MAX_ROOM_PLAYERS) {
    return json({ error: 'This game is full.' }, 409);
  }

  const assignedId = randomPlayerId();
  const needsApproval = !!room.state?.started;
  if (needsApproval && Date.now() - new Date(room.host_seen_at).getTime() > 60_000) {
    return json({ error: 'No authorized host is currently connected.' }, 409);
  }
  if (needsApproval && room.state.pendingJoinRequest) {
    return json({ error: 'Someone else is already waiting to join.' }, 409);
  }
  const { error: memberError } = await service.from('bingo_room_members').insert({
    room_code: code,
    player_id: assignedId,
    user_id: user.id,
    is_host: false,
    status: needsApproval ? 'pending' : 'active',
  });
  if (memberError) {
    return json(
      {
        error:
          memberError.code === '23505'
            ? 'Someone else is already waiting to join.'
            : 'Could not register a player seat.',
      },
      409,
    );
  }
  if (needsApproval) {
    try {
      await broadcast(code, { t: 'join', from: assignedId, name: body.name || 'Player', forceNew: true }, assignedId);
    } catch (error) {
      await service.from('bingo_room_members').delete().eq('room_code', code).eq('player_id', assignedId);
      return json({ error: error.message || 'Could not request to join this game.' }, 502);
    }
  }
  return json({ playerId: assignedId, isHost: false, status: needsApproval ? 'pending' : 'active', needsApproval });
}

async function claimSeat(user, body) {
  const { code, playerId: currentId, seatId } = body;
  if (!validCode(code) || !validPlayerId(currentId) || !validPlayerId(seatId)) {
    return json({ error: 'Invalid seat transfer.' }, 400);
  }
  const { data: room } = await service.from('bingo_rooms').select('state').eq('code', code).maybeSingle();
  if (!room?.state?.players?.[seatId] || room.state.players[seatId].connected || room.state.hostIds?.includes(seatId)) {
    return json({ error: 'That seat is not available to reclaim.' }, 409);
  }
  const { data: current } = await membershipQuery(code, user.id, currentId).maybeSingle();
  const { data: former } = await service
    .from('bingo_room_members')
    .select('user_id, is_host')
    .eq('room_code', code)
    .eq('player_id', seatId)
    .maybeSingle();
  if (!current || current.status === 'revoked' || former?.user_id !== user.id || former?.is_host) {
    return json({ error: 'That seat cannot be reclaimed.' }, 403);
  }
  if (former) await service.from('bingo_room_members').delete().eq('room_code', code).eq('player_id', seatId);
  const { error } = await service
    .from('bingo_room_members')
    .update({ player_id: seatId, status: 'active' })
    .eq('room_code', code)
    .eq('user_id', user.id)
    .eq('player_id', currentId);
  if (error) return json({ error: 'Could not transfer that seat.' }, 409);
  return json({ playerId: seatId });
}

async function commitRoomState(code, state, expectedRevision, expiresAt, newCode = null) {
  return service.rpc('commit_bingo_room_state', {
    p_code: code,
    p_expected_revision: expectedRevision,
    p_state: state,
    p_expires_at: expiresAt,
    p_new_code: newCode,
  });
}

async function publish(user, body) {
  const { code, playerId: senderId, message } = body;
  if (
    !validCode(code) ||
    !validPlayerId(senderId) ||
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message)
  ) {
    return json({ error: 'Invalid relay message.' }, 400);
  }
  const { data: member } = await membershipQuery(code, user.id, senderId).maybeSingle();
  if (!member || member.status === 'revoked') return json({ error: 'Player is not a member of this game.' }, 403);
  const { data: room } = await service
    .from('bingo_rooms')
    .select('state, expires_at, host_seen_at')
    .eq('code', code)
    .maybeSingle();
  if (!room || new Date(room.expires_at).getTime() <= Date.now()) return json({ error: 'Game session expired.' }, 410);

  let outgoing = { ...message };
  if (message.t === 'action') {
    if (!message.action || typeof message.action !== 'object' || Array.isArray(message.action)) {
      return json({ error: 'Invalid game action.' }, 400);
    }
    if (hostOnlyActions.has(message.action.t) && !member.is_host) {
      return json({ error: 'Only an authorized host can perform that action.' }, 403);
    }
    if (member.status !== 'active' && message.action.t !== 'join' && message.action.t !== 'rejoin') {
      return json({ error: 'This seat is awaiting host approval.' }, 403);
    }
    if (!member.is_host && Date.now() - new Date(room.host_seen_at).getTime() > 60_000) {
      return json({ error: 'No authorized host is currently connected.' }, 409);
    }
    outgoing = { ...message, from: member.player_id, sender: member.player_id };
  } else if (message.t === 'join' || message.t === 'rejoin' || message.t === 'reaction') {
    outgoing = { ...message, from: member.player_id, sender: member.player_id };
  } else if (!member.is_host) {
    return json({ error: 'Only an authorized host can broadcast this message.' }, 403);
  } else {
    outgoing.sender = member.player_id;
  }

  if (message.t === 'state' || message.t === 'welcome') {
    if (!member.is_host || !validState(message.state, code, member.player_id)) {
      return json({ error: 'Only an authorized host may publish valid game state.' }, 403);
    }
  }

  if (message.t === 'migrate') {
    if (!member.is_host || !validCode(message.newCode) || message.newCode === code) {
      return json({ error: 'Invalid room migration.' }, 400);
    }
    if (!validState(message.state, message.newCode, member.player_id)) {
      return json({ error: 'Invalid migrated game state.' }, 400);
    }
  }

  const isSnapshot = message.t === 'state' || message.t === 'welcome' || message.t === 'migrate';
  let commit = null;
  if (isSnapshot) {
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      return json({ error: 'Refresh the game before publishing state.', code: 'client_update_required' }, 409);
    }
    if (message.state.serverRevision !== body.expectedRevision) {
      return json({ error: 'Invalid room revision.' }, 400);
    }
    const nextCode = message.t === 'migrate' ? message.newCode : null;
    const stateCode = nextCode || code;
    const expiresAt = Number.isFinite(message.state.sessionExpiresAt)
      ? new Date(message.state.sessionExpiresAt).toISOString()
      : room.expires_at;
    const result = await commitRoomState(code, message.state, body.expectedRevision, expiresAt, nextCode);
    if (result.error) {
      if (result.error.code === '23505') return json({ error: 'That new game code is already in use.' }, 409);
      return json({ error: `Could not save authoritative game state: ${result.error.message}` }, 500);
    }
    if (result.data?.error === 'room_not_found') return json({ error: 'Game session expired.' }, 410);
    if (result.data?.error === 'room_full') return json({ error: 'This game is full.' }, 409);
    if (result.data?.error || !result.data) return json({ error: 'Invalid authoritative game state.' }, 400);
    if (result.data.conflict) {
      try {
        await broadcast(code, { t: 'stateConflict', state: result.data.state }, member.player_id);
      } catch {
        // The client also receives the committed snapshot in this response.
      }
      return json({
        conflict: true,
        revision: result.data.revision,
        state: result.data.state,
        code: result.data.code,
      });
    }
    if (!result.data.saved || !validState(result.data.state, stateCode, member.player_id)) {
      return json({ error: 'The authoritative room save returned invalid state.' }, 500);
    }
    commit = result.data;
    outgoing = { ...message, state: commit.state };
  }

  try {
    await broadcast(code, outgoing, member.player_id);
  } catch (error) {
    return json({ error: error.message || 'Could not relay the message.' }, 502);
  }

  if (message.t === 'joinRejected' && typeof message.to === 'string') {
    await service
      .from('bingo_room_members')
      .update({ status: 'revoked' })
      .eq('room_code', code)
      .eq('player_id', message.to)
      .eq('status', 'pending');
  }
  return json({
    ok: true,
    ...(commit && { revision: commit.revision, state: commit.state, code: commit.code }),
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const user = await authenticate(request);
    if (!user) return json({ error: 'A valid anonymous-auth session is required.' }, 401);
    const body = await request.json();
    if (body.operation === 'create') return await createRoom(user, body);
    if (body.operation === 'join') return await joinRoom(user, body);
    if (body.operation === 'set-host-recovery-password') return await setHostRecoveryPassword(user, body);
    if (body.operation === 'recover-host') return await recoverHost(user, body);
    if (body.operation === 'join-status') {
      const { code, playerId: memberId } = body;
      if (!validCode(code) || !validPlayerId(memberId)) return json({ error: 'Invalid join status request.' }, 400);
      const { data: member } = await membershipQuery(code, user.id, memberId).maybeSingle();
      if (!member) return json({ status: 'revoked' });
      if (member.status !== 'active') return json({ status: member.status });
      const { data: room, error } = await service
        .from('bingo_rooms')
        .select('state, expires_at')
        .eq('code', code)
        .maybeSingle();
      if (error) return json({ error: 'Could not check the saved game session.' }, 500);
      if (!room) return json({ status: 'revoked' });
      const expiresAt = new Date(room.expires_at).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || room.state?.gameOver) {
        return json({ status: 'expired', expiresAt });
      }
      if (!Object.hasOwn(room.state.players || {}, memberId)) return json({ status: 'revoked' });
      return json({ status: 'active', state: room.state, expiresAt });
    }
    if (body.operation === 'cancel-join') {
      const { code, playerId: memberId } = body;
      if (!validCode(code) || !validPlayerId(memberId)) return json({ error: 'Invalid join cancellation.' }, 400);
      await service
        .from('bingo_room_members')
        .update({ status: 'revoked' })
        .eq('room_code', code)
        .eq('player_id', memberId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
      return json({ ok: true });
    }
    if (body.operation === 'claim-seat') return await claimSeat(user, body);
    if (body.operation === 'publish') return await publish(user, body);
    if (body.operation === 'heartbeat') {
      const { code, playerId: memberId } = body;
      if (!validCode(code) || !validPlayerId(memberId)) return json({ error: 'Invalid heartbeat.' }, 400);
      const { data: member } = await membershipQuery(code, user.id, memberId).maybeSingle();
      if (!member?.is_host || member.status !== 'active') return json({ error: 'Host membership required.' }, 403);
      const { error } = await service
        .from('bingo_rooms')
        .update({ host_seen_at: new Date().toISOString() })
        .eq('code', code);
      if (error) return json({ error: 'Could not update host presence.' }, 500);
      return json({ ok: true });
    }
    if (body.operation === 'leave') {
      const { code, playerId: memberId } = body;
      if (!validCode(code) || !validPlayerId(memberId)) return json({ error: 'Invalid leave request.' }, 400);
      await service
        .from('bingo_room_members')
        .delete()
        .eq('room_code', code)
        .eq('user_id', user.id)
        .eq('player_id', memberId);
      return json({ ok: true });
    }
    return json({ error: 'Unknown relay operation.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Relay request failed.' }, 500);
  }
});
