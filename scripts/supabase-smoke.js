import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { buildPlayerBoard, pickTropePool } from '../src/data/tropes.js';

const env = loadEnv('development', process.cwd(), 'VITE_');
const url = env.VITE_SUPABASE_URL;
const publicKey = env.VITE_SUPABASE_ANON_KEY;
assert(url && publicKey, 'Local Supabase configuration is required.');
const projectRef = new URL(url).hostname.split('.')[0];
const accessToken =
  process.env.SUPABASE_ACCESS_TOKEN ||
  execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
const management = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
assert(management.ok, 'Could not obtain smoke-test cleanup credentials.');
const keys = await management.json();
const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key;
assert(serviceKey, 'A server cleanup credential is required.');
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, clientOptions);
const users = [];
const clients = [];
const channels = [];
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let code = Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join('');
const password = randomBytes(1).toString('hex');
let roomCreated = false;
let checks = 0;

function passed(name) {
  checks += 1;
  console.log(`PASS ${name}`);
}

async function newUser() {
  const client = createClient(url, publicKey, clientOptions);
  clients.push(client);
  const { data, error } = await client.auth.signInAnonymously();
  assert(!error && data.session && data.user, 'Anonymous sign-in failed.');
  users.push(data.user.id);
  return { client, token: data.session.access_token };
}

async function relay(user, body) {
  const response = await fetch(`${url}/functions/v1/game-relay`, {
    method: 'POST',
    headers: { apikey: publicKey, Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data, retryAfter: response.headers.get('Retry-After') };
}

async function publishState(user, roomCode, playerId, state, newCode = null) {
  const message = newCode ? { t: 'migrate', newCode, state } : { t: 'state', state };
  return relay(user, {
    operation: 'publish',
    code: roomCode,
    playerId,
    expectedRevision: state.serverRevision,
    message,
  });
}

async function movieLookup(user, body) {
  const response = await fetch(`${url}/functions/v1/movie-lookup`, {
    method: 'POST',
    headers: {
      apikey: publicKey,
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function subscribe(user, privateChannel = true, topic = `bingo-${code}`) {
  await user.client.realtime.setAuth(user.token);
  const channel = user.client.channel(topic, { config: { private: privateChannel, broadcast: { ack: true } } });
  channels.push({ client: user.client, channel });
  const status = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve('NO_STATUS'), 12000);
    channel.subscribe((value) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value)) {
        clearTimeout(timeout);
        resolve(value);
      }
    });
  });
  return { channel, status };
}

try {
  const unauthenticated = await fetch(`${url}/functions/v1/game-relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publicKey },
    body: JSON.stringify({ operation: 'create' }),
  });
  assert.equal(unauthenticated.status, 401);
  passed('unauthenticated function request denied');

  const host = await newUser();
  const guest = await newUser();
  assert.equal((await movieLookup(null, { mode: 'search', query: 'Alien' })).status, 401);
  passed('movie proxy denies unauthenticated requests');
  const movieSearch = await movieLookup(host, { mode: 'search', query: 'Alien' });
  assert.equal(movieSearch.status, 200, 'Authenticated movie search failed.');
  assert.equal(movieSearch.data.Response, 'True');
  assert(movieSearch.data.Search.some((movie) => movie.imdbID === 'tt0078748'));
  const movieDetails = await movieLookup(host, { mode: 'details', query: 'tt0078748' });
  assert.equal(movieDetails.status, 200);
  assert.equal(movieDetails.data.Title, 'Alien');
  assert(!env.VITE_OMDB_API_KEY || !JSON.stringify(movieDetails.data).includes(env.VITE_OMDB_API_KEY));
  passed('authenticated movie search and details succeed without exposing the upstream key');
  assert.equal((await movieLookup(host, { mode: 'details', query: 'invalid-id' })).status, 400);
  assert.equal((await movieLookup(host, { mode: '__proto__', query: 'Alien' })).status, 400);
  const { error: quotaError } = await admin
    .from('bingo_movie_lookup_budget')
    .update({ requests: 30 })
    .eq('subject', `user:${users[0]}`);
  assert(!quotaError, 'Could not prepare the temporary quota test.');
  assert.equal((await movieLookup(host, { mode: 'search', query: 'Alien' })).status, 429);
  passed('movie proxy rejects requests after the per-user budget is exhausted');
  const clientBudget = await host.client.rpc('consume_bingo_movie_lookup', { p_user_id: users[0] });
  assert(clientBudget.error, 'Client bypassed the movie proxy budget.');
  passed('movie proxy rejects malformed requests and direct budget access');
  const hostId = `p${randomBytes(6).toString('hex')}`;
  const pool = pickTropePool(['horror'], [], { horror: 50 }, 25);
  const makePlayer = (id, name, seat) => ({
    id,
    name,
    seat,
    connected: true,
    avatar: '🎬',
    board: buildPlayerBoard(pool, false),
    marked: [],
    wagered: [],
  });
  const state = {
    code,
    rev: 1,
    serverRevision: 0,
    genres: ['horror'],
    subgenreSelections: [],
    generalPercents: { horror: 50 },
    freeSpace: false,
    tropePool: pool,
    totalTropes: 25,
    players: { [hostId]: makePlayer(hostId, 'Smoke Host', 0) },
    seatOrder: [hostId],
    hostIds: [hostId],
    started: false,
    gameOver: false,
    acceptedTropes: [],
    pendingClaim: null,
    pendingJoinRequest: null,
    sessionExpiresAt: Date.now() + 30 * 60 * 1000,
  };
  const created = await relay(host, {
    operation: 'create',
    code,
    playerId: hostId,
    state,
    hostRecoveryPassword: password,
  });
  assert.equal(created.status, 200, `Create room failed: ${created.data.error || created.status}`);
  roomCreated = true;
  passed('authenticated host creates a room');
  const { data: createRecoveryRow, error: createRecoveryError } = await admin
    .from('bingo_rooms')
    .select('host_recovery_player_id, host_recovery_password_hash, state')
    .eq('code', code)
    .single();
  assert(!createRecoveryError);
  assert.equal(createRecoveryRow.host_recovery_player_id, hostId);
  assert(createRecoveryRow.host_recovery_password_hash.startsWith('pbkdf2-sha256$'));
  assert.notEqual(createRecoveryRow.host_recovery_password_hash, password);
  assert(!Object.hasOwn(createRecoveryRow.state, 'hostRecoveryPassword'));
  assert(!Object.hasOwn(createRecoveryRow.state, 'password'));
  passed('two-character create-time recovery password is stored only as a verifier');

  const sameIdentityPlayerId = `p${randomBytes(6).toString('hex')}`;
  const sameIdentityJoin = await relay(host, {
    operation: 'join',
    code,
    requestedPlayerId: sameIdentityPlayerId,
    name: 'Second Auth tab',
  });
  assert.equal(sameIdentityJoin.status, 200);
  assert.notEqual(sameIdentityJoin.data.playerId, hostId);
  state.players[sameIdentityJoin.data.playerId] = makePlayer(sameIdentityJoin.data.playerId, 'Second Auth tab', 1);
  state.seatOrder.push(sameIdentityJoin.data.playerId);
  passed('same Auth identity can create a distinct seat for a second tab');

  const duplicate = await relay(host, { operation: 'create', code, playerId: hostId, state });
  assert.equal(duplicate.status, 409);
  passed('duplicate room-code creation fails without replacing the original room');

  const joined = await relay(guest, { operation: 'join', code, name: 'Smoke Guest' });
  assert.equal(joined.status, 200);
  const guestId = joined.data.playerId;
  state.players[guestId] = makePlayer(guestId, 'Smoke Guest', 2);
  state.seatOrder.push(guestId);
  const hostChannel = await subscribe(host);
  assert.equal(hostChannel.status, 'SUBSCRIBED', 'Authorized private channel subscription failed.');
  let response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200, `Host state publish failed: ${response.data.error || response.status}`);
  Object.assign(state, response.data.state);
  const activeSession = await relay(host, { operation: 'join-status', code, playerId: hostId });
  assert.equal(activeSession.data.status, 'active');
  assert(activeSession.data.expiresAt > Date.now());
  const guestChannel = await subscribe(guest);
  assert.equal(guestChannel.status, 'SUBSCRIBED');
  passed('active members subscribe and host publishes state');

  response = await relay(guest, {
    operation: 'publish',
    code,
    playerId: guestId,
    message: { t: 'action', from: hostId, sender: hostId, action: { t: 'reset' } },
  });
  assert.equal(response.status, 403);
  response = await relay(guest, {
    operation: 'publish',
    code,
    playerId: hostId,
    expectedRevision: state.serverRevision,
    message: { t: 'state', state },
  });
  assert.equal(response.status, 403);
  response = await relay(guest, {
    operation: 'publish',
    code,
    playerId: guestId,
    message: { t: 'state', state: { ...state, rev: Number.MAX_SAFE_INTEGER, hostIds: [guestId] } },
  });
  assert.equal(response.status, 403);
  passed('forged host actions, identity, and state denied');

  const directWrite = await guestChannel.channel.send({
    type: 'broadcast',
    event: 'msg',
    payload: { t: 'state', state },
  });
  assert.notEqual(directWrite, 'ok', 'Direct client Realtime broadcast was permitted.');
  passed('direct client Realtime broadcast denied');
  const publicChannel = await subscribe(guest, false);
  assert.notEqual(publicChannel.status, 'SUBSCRIBED', 'Public Realtime channels were permitted.');
  passed('public Realtime channel denied');

  response = await relay(guest, {
    operation: 'publish',
    code,
    playerId: guestId,
    message: { t: 'action', from: hostId, sender: hostId, action: { t: 'setWager', indices: [0] } },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.state.players[guestId].wagered, [0]);
  assert.deepEqual(response.data.state.players[hostId].wagered, []);
  Object.assign(state, response.data.state);
  passed('server executes gameplay for the authenticated seat instead of trusting payload identity');

  state.hostIds.push(guestId);
  response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200, `Co-host assignment failed: ${response.data.error || response.status}`);
  Object.assign(state, response.data.state);
  const raceRevision = state.serverRevision;
  const hostSnapshot = structuredClone(state);
  const guestSnapshot = structuredClone(state);
  hostSnapshot.players[hostId].name = 'Host race candidate';
  guestSnapshot.players[guestId].name = 'Guest race candidate';
  const raceResults = await Promise.all([
    publishState(host, code, hostId, hostSnapshot),
    publishState(guest, code, guestId, guestSnapshot),
  ]);
  assert.deepEqual(raceResults.map((result) => !!result.data.conflict).sort(), [false, true]);
  const { data: roomAfterRace, error: raceReadError } = await admin
    .from('bingo_rooms')
    .select('state, revision')
    .eq('code', code)
    .single();
  assert(!raceReadError);
  assert.equal(roomAfterRace.revision, raceRevision + 1);
  assert.equal(
    ['Host race candidate', 'Guest race candidate'].filter((name) =>
      Object.values(roomAfterRace.state.players).some((player) => player.name === name),
    ).length,
    1,
  );
  Object.assign(state, roomAfterRace.state);
  passed('concurrent co-host snapshots serialize and reject the stale writer');

  const tamper = await guest.client
    .from('bingo_room_members')
    .update({ is_host: true })
    .eq('room_code', code)
    .eq('player_id', guestId);
  assert(tamper.error, 'Client changed its own host role.');
  const { data: visibleRooms, error: roomReadError } = await guest.client.from('bingo_rooms').select('state');
  assert(roomReadError || !visibleRooms?.length, 'Client read authoritative room rows directly.');
  passed('client role tampering and direct room-state reads denied');

  const returning = await newUser();
  state.started = true;
  response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200);
  Object.assign(state, response.data.state);
  const pending = await relay(returning, { operation: 'join', code, name: 'Pending Smoke Player' });
  assert.equal(pending.status, 200);
  assert.equal(pending.data.needsApproval, true);
  assert.equal(pending.data.state, undefined);
  const pendingId = pending.data.playerId;
  const pendingChannel = await subscribe(returning);
  assert.notEqual(pendingChannel.status, 'SUBSCRIBED', 'Pending user joined a private game channel.');
  const pendingStatus = await relay(returning, { operation: 'join-status', code, playerId: pendingId });
  assert.equal(pendingStatus.data.status, 'pending');
  assert.equal(pendingStatus.data.state, undefined);
  response = await relay(host, {
    operation: 'publish',
    code,
    playerId: hostId,
    message: { t: 'joinRejected', to: pendingId, reason: 'denied' },
  });
  assert.equal(response.status, 200);
  const deniedStatus = await relay(returning, { operation: 'join-status', code, playerId: pendingId });
  assert.equal(deniedStatus.data.status, 'revoked');
  passed('pending joiners cannot read private traffic and denial revokes membership');

  state.hostIds = [hostId];
  response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200);
  Object.assign(state, response.data.state);
  const staleTime = new Date(Date.now() - 120_001).toISOString();
  const { error: offlineError } = await admin
    .from('bingo_room_members')
    .update({ last_seen_at: staleTime })
    .eq('room_code', code)
    .eq('player_id', hostId);
  assert(!offlineError);
  const { error: otherPresenceError } = await admin
    .from('bingo_room_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('room_code', code)
    .eq('player_id', sameIdentityPlayerId);
  assert(!otherPresenceError);
  const { error: hostPresenceError } = await admin
    .from('bingo_rooms')
    .update({ host_seen_at: staleTime })
    .eq('code', code);
  assert(!hostPresenceError);
  response = await relay(guest, {
    operation: 'publish',
    code,
    playerId: guestId,
    message: { t: 'action', action: { t: 'claim', index: 0 } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.state.players[hostId].connected, false);
  const hostlessClaim = response.data.state.pendingClaim;
  assert(hostlessClaim);
  response = await relay(host, {
    operation: 'publish',
    code,
    playerId: sameIdentityPlayerId,
    message: { t: 'action', action: { t: 'vote', claimId: hostlessClaim.claimId, agree: true } },
  });
  assert.equal(response.status, 200);
  assert(response.data.state.acceptedTropes.includes(hostlessClaim.text));
  assert.deepEqual(response.data.state.hostIds, [hostId]);
  Object.assign(state, response.data.state);
  const { data: hostlessRow, error: hostlessReadError } = await admin
    .from('bingo_rooms')
    .select('host_seen_at')
    .eq('code', code)
    .single();
  assert(!hostlessReadError);
  assert.equal(new Date(hostlessRow.host_seen_at).getTime(), new Date(staleTime).getTime());
  passed('claims and votes commit without a connected host or refreshed host heartbeat');
  const { error: restoredPresenceError } = await admin
    .from('bingo_room_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('room_code', code)
    .eq('player_id', hostId);
  assert(!restoredPresenceError);
  state.players[hostId].connected = true;
  response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200);
  Object.assign(state, response.data.state);

  response = await relay(guest, { operation: 'set-host-recovery-password', code, playerId: guestId, password });
  assert.equal(response.status, 403);
  response = await relay(host, { operation: 'set-host-recovery-password', code, playerId: hostId, password });
  assert.equal(response.status, 200);
  const { data: row, error: rowError } = await admin
    .from('bingo_rooms')
    .select('host_recovery_password_hash')
    .eq('code', code)
    .single();
  assert(!rowError);
  assert(row.host_recovery_password_hash.startsWith('pbkdf2-sha256$'));
  assert.notEqual(row.host_recovery_password_hash, password);
  passed('only host configures a salted password verifier');

  const recoveryAttempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      relay(returning, {
        operation: 'join',
        code,
        name: 'Recovered Host',
        hostRecoveryPassword: `${password}wrong`,
      }),
    ),
  );
  assert.deepEqual(
    recoveryAttempts.map((attempt) => attempt.status).sort((left, right) => left - right),
    [403, 403, 403, 403, 403, 429],
  );
  passed('concurrent recovery attempts are serialized by the server lockout');
  response = await relay(host, { operation: 'set-host-recovery-password', code, playerId: hostId, password });
  assert.equal(response.status, 200);
  passed('recovery password guessing locks out after five attempts');

  response = await relay(returning, {
    operation: 'join',
    code,
    name: 'Recovered Host',
    hostRecoveryPassword: password,
  });
  assert.equal(response.status, 409, `Connected-host recovery guard failed: ${response.data.error || response.status}`);
  state.players[hostId].connected = false;
  response = await publishState(host, code, hostId, state);
  assert.equal(response.status, 200);
  Object.assign(state, response.data.state);
  response = await relay(returning, {
    operation: 'join',
    code,
    name: 'Recovered Host',
    hostRecoveryPassword: `${password}wrong`,
  });
  assert.equal(response.status, 403);
  response = await relay(returning, {
    operation: 'join',
    code,
    name: 'Recovered Host',
    hostRecoveryPassword: password,
  });
  assert.equal(response.status, 200, `Host recovery failed: ${response.data.error || response.status}`);
  assert.equal(response.data.playerId, hostId);
  assert.equal(response.data.isHost, true);
  assert.deepEqual(response.data.state.players[hostId].board, state.players[hostId].board);
  Object.assign(state, response.data.state);
  const invalidated = await relay(host, { operation: 'heartbeat', code, playerId: hostId });
  assert.equal(invalidated.status, 403);
  passed('password restores original host board and revokes old identity');

  let newCode = Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join('');
  while (newCode === code) newCode = Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join('');
  const migratedState = { ...state, code: newCode };
  const migration = await publishState(returning, code, hostId, migratedState, newCode);
  assert.equal(migration.status, 200, `Atomic room migration failed: ${migration.data.error || migration.status}`);
  assert.equal(migration.data.code, newCode);
  const { data: migratedRoom, error: migrationReadError } = await admin
    .from('bingo_rooms')
    .select('state, revision')
    .eq('code', newCode)
    .single();
  assert(!migrationReadError);
  assert.equal(migratedRoom.state.serverRevision, migration.data.revision);
  const { data: movedMembers, error: memberReadError } = await admin
    .from('bingo_room_members')
    .select('player_id')
    .eq('room_code', newCode);
  assert(!memberReadError);
  assert.equal(movedMembers.length, Object.keys(migratedRoom.state.players).length);
  code = newCode;
  passed('room code, snapshot revision, and memberships migrate atomically');

  const { error: expireError } = await admin
    .from('bingo_rooms')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('code', code);
  assert(!expireError);
  const expiredSession = await relay(returning, { operation: 'join-status', code, playerId: hostId });
  assert.equal(expiredSession.data.status, 'expired');
  passed('saved-session status hides expired rooms');
  const abusive = await newUser();
  for (let attempt = 0; attempt < 6; attempt++) {
    const invalid = await relay(abusive, { operation: 'create', code: 'ABCD', playerId: 'invalid' });
    assert.equal(invalid.status, 400);
  }
  const limited = await relay(abusive, { operation: 'create', code: 'ABCD', playerId: 'invalid' });
  assert.equal(limited.status, 429);
  assert(Number(limited.retryAfter) > 0);
  const deniedBudgetAccess = await abusive.client.rpc('consume_bingo_relay_request', {
    p_user_id: users.at(-1),
    p_operation: 'publish',
  });
  assert(deniedBudgetAccess.error, 'A browser role could alter relay request budgets.');
  passed('malformed payloads are rejected, counted, and rate-limited with retry information');
  console.log(`Live smoke checks passed: ${checks}`);
} catch (error) {
  console.error(`SMOKE FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const { client, channel } of channels) await client.removeChannel(channel);
  if (roomCreated) {
    const { error } = await admin.from('bingo_rooms').delete().eq('code', code);
    if (error) {
      console.error('Temporary room cleanup failed.');
      process.exitCode = 1;
    }
  }
  for (const id of users) {
    const { error: relayBudgetError } = await admin
      .from('bingo_relay_request_budget')
      .delete()
      .like('subject', `user:${id}:%`);
    if (relayBudgetError) {
      console.error('Temporary relay budget cleanup failed.');
      process.exitCode = 1;
    }
    const { error: budgetError } = await admin.from('bingo_movie_lookup_budget').delete().eq('subject', `user:${id}`);
    if (budgetError) {
      console.error('Temporary lookup budget cleanup failed.');
      process.exitCode = 1;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error('Temporary Auth user cleanup failed.');
      process.exitCode = 1;
    }
  }
  for (const client of clients) await client.removeAllChannels();
  console.log('Temporary smoke-test room and users cleaned up.');
}
