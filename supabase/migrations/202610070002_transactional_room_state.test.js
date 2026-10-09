// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { applyServerGameAction } from '../../src/net/relay.js';

const directory = dirname(fileURLToPath(import.meta.url));
const migration = await readFile(resolve(directory, '202610070002_transactional_room_state.sql'), 'utf8');
const gameplayMigration = await readFile(resolve(directory, '202610080001_hostless_gameplay.sql'), 'utf8');
const abuseMigration = await readFile(resolve(directory, '202610080002_relay_abuse_limits.sql'), 'utf8');
const reliableMigration = await readFile(resolve(directory, '202610080003_reliable_game_actions.sql'), 'utf8');
const noopMigration = await readFile(resolve(directory, '202610090001_noop_action_receipts.sql'), 'utf8');
const hostUser = '11111111-1111-4111-8111-111111111111';
const guestUser = '22222222-2222-4222-8222-222222222222';
const recoveringUser = '33333333-3333-4333-8333-333333333333';
let database;

function roomState(code = 'ABCD', marker = null) {
  return {
    code,
    rev: 0,
    serverRevision: 0,
    players: {
      p1: { id: 'p1', name: marker || 'Host', seat: 0, connected: false },
      p2: { id: 'p2', name: 'Guest', seat: 1, connected: true },
    },
    seatOrder: ['p1', 'p2'],
    hostIds: ['p1'],
    pendingJoinRequest: { id: 'p3' },
    acceptedTropes: [],
  };
}

async function insertRoom({ code = 'ABCD', state = roomState(code), revision = 0, oldHostSeen = true } = {}) {
  await database.query(
    `insert into public.bingo_rooms
      (code, state, expires_at, host_seen_at, host_recovery_player_id, host_recovery_password_hash, revision)
     values ($1, $2::jsonb, now() + interval '1 hour',
       case when $3 then now() - interval '61 seconds' else now() end,
       'p1', 'test-verifier', $4)`,
    [code, JSON.stringify(state), oldHostSeen, revision],
  );
  await database.query(
    `insert into public.bingo_room_members (room_code, player_id, user_id, is_host, status)
     values ($1, 'p1', $2, true, 'active'),
            ($1, 'p2', $3, false, 'active'),
            ($1, 'p3', $3, false, 'active'),
            ($1, 'p4', $3, false, 'active'),
            ($1, 'p5', $3, false, 'revoked')`,
    [code, hostUser, guestUser],
  );
}

async function commit(code, expectedRevision, state, newCode = null) {
  const { rows } = await database.query(
    `select public.commit_bingo_room_state($1, $2, $3::jsonb, now() + interval '1 hour', $4) as result`,
    [code, expectedRevision, JSON.stringify(state), newCode],
  );
  return rows[0].result;
}

async function storedRoom(code) {
  const { rows } = await database.query('select * from public.bingo_rooms where code = $1', [code]);
  return rows[0] || null;
}

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.bingo_rooms (
      code text primary key,
      state jsonb not null,
      expires_at timestamptz not null,
      host_seen_at timestamptz not null default now(),
      host_recovery_player_id text,
      host_recovery_password_hash text,
      host_recovery_attempts integer not null default 0,
      host_recovery_window_started_at timestamptz not null default now(),
      host_recovery_locked_until timestamptz,
      revision bigint not null default 0
    );
    create table public.bingo_room_members (
      room_code text not null references public.bingo_rooms(code) on update cascade on delete cascade,
      player_id text not null,
      user_id uuid not null,
      is_host boolean not null default false,
      status text not null default 'pending',
      primary key (room_code, player_id)
    );
  `);
  await database.exec(migration);
  await database.exec(gameplayMigration);
  await database.exec(abuseMigration);
  await database.exec(reliableMigration);
  await database.exec(noopMigration);
  await database.query('insert into auth.users values ($1), ($2), ($3)', [hostUser, guestUser, recoveringUser]);
});

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.exec('delete from public.bingo_rooms; delete from auth.users;');
  await database.exec('delete from public.bingo_relay_request_budget;');
  await database.query('insert into auth.users values ($1), ($2), ($3)', [hostUser, guestUser, recoveringUser]);
});

describe('transactional room state migration', () => {
  it('records a no-op action receipt without changing room revision and rejects stale no-ops', async () => {
    await insertRoom();
    const state = (await storedRoom('ABCD')).state;
    const write = (revision, requestId) =>
      database.query('select public.commit_bingo_action($1,$2,$3::jsonb,$4,$5,$6,$7) as result', [
        'ABCD',
        revision,
        JSON.stringify(state),
        guestUser,
        'p2',
        requestId,
        'd'.repeat(64),
      ]);
    const requestId = '66666666-6666-4666-8666-666666666666';
    expect((await write(0, requestId)).rows[0].result).toMatchObject({ saved: true, unchanged: true, revision: 0 });
    expect((await write(0, requestId)).rows[0].result.replayed).toBe(true);
    expect((await storedRoom('ABCD')).revision).toBe(0);
    expect((await write(1, '77777777-7777-4777-8777-777777777777')).rows[0].result.conflict).toBe(true);
  });
  it('does not undo a saved solo claim when the same action is retried after a lost response', async () => {
    const state = {
      ...roomState(),
      started: true,
      gameOver: false,
      freeSpace: false,
      pendingJoinRequest: null,
      genres: ['horror'],
      subgenreSelections: [],
    };
    const board = Array.from({ length: 25 }, (_, index) => `Trope ${index}`);
    for (const player of Object.values(state.players))
      Object.assign(player, { board: [...board], marked: [], wagered: [] });
    state.tropePool = board;
    await insertRoom({ state });
    const requestId = '55555555-5555-4555-8555-555555555555';
    const write = (snapshot, revision) =>
      database.query('select public.commit_bingo_action($1,$2,$3::jsonb,$4,$5,$6,$7) as result', [
        'ABCD',
        revision,
        JSON.stringify(snapshot),
        guestUser,
        'p2',
        requestId,
        'c'.repeat(64),
      ]);
    const first = await write(applyServerGameAction(state, 'p2', { t: 'claim', index: 0 }).state, 0);
    const accepted = first.rows[0].result.state;
    expect(accepted.acceptedTropes).toContain('Trope 0');
    const computedRetry = applyServerGameAction(accepted, 'p2', { t: 'claim', index: 0 }).state;
    expect(computedRetry.acceptedTropes).not.toContain('Trope 0');
    const retried = await write(computedRetry, 1);
    expect(retried.rows[0].result.replayed).toBe(true);
    expect(retried.rows[0].result.state.acceptedTropes).toContain('Trope 0');
    expect((await storedRoom('ABCD')).revision).toBe(1);
  });
  it('deduplicates concurrent action commits and rejects reusing an ID for different content', async () => {
    await insertRoom();
    const requestId = '44444444-4444-4444-8444-444444444444';
    const commitAction = (hash) =>
      database.query('select public.commit_bingo_action($1,$2,$3::jsonb,$4,$5,$6,$7) as result', [
        'ABCD',
        0,
        JSON.stringify(roomState('ABCD', 'Committed action')),
        guestUser,
        'p2',
        requestId,
        hash,
      ]);
    const results = await Promise.all([commitAction('a'.repeat(64)), commitAction('a'.repeat(64))]);
    expect(results.filter((result) => result.rows[0].result.replayed)).toHaveLength(1);
    expect((await storedRoom('ABCD')).revision).toBe(1);
    expect((await commitAction('b'.repeat(64))).rows[0].result.error).toBe('request_id_reused');
  });

  it('atomically reclaims only an available same-identity seat', async () => {
    await insertRoom();
    await database.query("update public.bingo_room_members set is_host=false, user_id=$1 where player_id='p1'", [
      guestUser,
    ]);
    await database.query("update public.bingo_rooms set state=jsonb_set(state,'{hostIds}','[\"p2\"]'::jsonb)");
    const result = await database.query('select public.claim_bingo_seat($1,$2,$3,$4) as result', [
      'ABCD',
      guestUser,
      'p3',
      'p1',
    ]);
    expect(result.rows[0].result.playerId).toBe('p1');
    const members = await database.query(
      "select player_id from public.bingo_room_members where player_id in ('p1','p3')",
    );
    expect(members.rows).toEqual([{ player_id: 'p1' }]);
    expect((await storedRoom('ABCD')).state.players.p1.connected).toBe(true);
    const duplicate = await database.query('select public.claim_bingo_seat($1,$2,$3,$4) as result', [
      'ABCD',
      guestUser,
      'p4',
      'p1',
    ]);
    expect(duplicate.rows[0].result.error).toBe('seat_unavailable');
    const denied = await database.query('select public.claim_bingo_seat($1,$2,$3,$4) as result', [
      'ABCD',
      hostUser,
      'p4',
      'p2',
    ]);
    expect(denied.rows[0].result.error).toBe('seat_unavailable');
  });

  it('rolls back the old membership deletion when the receiving update cannot complete', async () => {
    await insertRoom();
    await database.query("update public.bingo_room_members set is_host=false, user_id=$1 where player_id='p1'", [
      guestUser,
    ]);
    await database.query("update public.bingo_rooms set state=jsonb_set(state,'{hostIds}','[\"p2\"]'::jsonb)");
    await database.exec(
      'create function reject_claim_update() returns trigger language plpgsql as $$ begin return null; end $$; create trigger reject_claim before update on public.bingo_room_members for each row execute function reject_claim_update();',
    );
    try {
      await expect(
        database.query('select public.claim_bingo_seat($1,$2,$3,$4)', ['ABCD', guestUser, 'p3', 'p1']),
      ).rejects.toThrow('Seat transfer failed');
      const rows = await database.query(
        "select player_id from public.bingo_room_members where player_id in ('p1','p3') order by player_id",
      );
      expect(rows.rows).toEqual([{ player_id: 'p1' }, { player_id: 'p3' }]);
      const permissions = await database.query(
        "select has_function_privilege('authenticated','public.claim_bingo_seat(text,uuid,text,text)','EXECUTE') as allowed, has_table_privilege('authenticated','public.bingo_action_receipts','SELECT') as readable",
      );
      expect(permissions.rows[0]).toEqual({ allowed: false, readable: false });
    } finally {
      await database.exec(
        'drop trigger reject_claim on public.bingo_room_members; drop function reject_claim_update();',
      );
    }
  });
  it('allows only six concurrent room creations per user and keeps joining available', async () => {
    const requests = await Promise.all(
      Array.from({ length: 10 }, () =>
        database.query('select public.consume_bingo_relay_request($1, $2) as result', [hostUser, 'create']),
      ),
    );
    expect(requests.filter((request) => request.rows[0].result.allowed)).toHaveLength(6);
    expect(requests.filter((request) => !request.rows[0].result.allowed)).toHaveLength(4);
    const denied = requests.find((request) => !request.rows[0].result.allowed).rows[0].result;
    expect(denied.retry_after_seconds).toBeGreaterThan(0);
    const joined = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'join',
    ]);
    expect(joined.rows[0].result.allowed).toBe(true);
    const other = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      guestUser,
      'create',
    ]);
    expect(other.rows[0].result.allowed).toBe(true);
  });

  it('rate limits join guesses and reopens an expired window', async () => {
    for (let index = 0; index < 20; index++) {
      const request = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
        hostUser,
        'join',
      ]);
      expect(request.rows[0].result.allowed).toBe(true);
    }
    const blocked = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'join',
    ]);
    expect(blocked.rows[0].result.allowed).toBe(false);
    await database.query(
      "update public.bingo_relay_request_budget set window_started_at = now() - interval '61 seconds' where subject = $1",
      [`user:${hostUser}:join`],
    );
    const retry = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'join',
    ]);
    expect(retry.rows[0].result.allowed).toBe(true);
  });

  it('enforces project caps across identities and denies direct client access', async () => {
    await database.query(
      "insert into public.bingo_relay_request_budget (subject, requests) values ('global:minute', 6000)",
    );
    const result = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      guestUser,
      'publish',
    ]);
    expect(result.rows[0].result.allowed).toBe(false);
    const counters = await database.query(
      "select count(*)::int as count from public.bingo_relay_request_budget where subject like 'user:%'",
    );
    expect(counters.rows[0].count).toBe(0);
    const permissions = await database.query(
      "select has_function_privilege('authenticated', 'public.consume_bingo_relay_request(uuid,text)', 'EXECUTE') as allowed, has_table_privilege('authenticated', 'public.bingo_relay_request_budget', 'SELECT') as readable",
    );
    expect(permissions.rows[0]).toEqual({ allowed: false, readable: false });
  });

  it('allows normal ten-player traffic without sharing their user budgets', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const userId = `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`;
        const operations = [...Array(40).fill('publish'), 'join', 'heartbeat', 'heartbeat', 'heartbeat', 'join-status'];
        for (const operation of operations) {
          const result = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
            userId,
            operation,
          ]);
          expect(result.rows[0].result.allowed).toBe(true);
        }
        return userId;
      }),
    );
    expect(new Set(results).size).toBe(10);
  });

  it('rejects publish spam while preserving room cleanup operations', async () => {
    await database.query('insert into public.bingo_relay_request_budget (subject, requests) values ($1, 480)', [
      `user:${hostUser}:publish`,
    ]);
    const blocked = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'publish',
    ]);
    expect(blocked.rows[0].result.allowed).toBe(false);
    const leave = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'leave',
    ]);
    expect(leave.rows[0].result.allowed).toBe(true);
    const aggregate = await database.query(
      'select requests from public.bingo_relay_request_budget where subject = $1',
      [`user:${hostUser}:all`],
    );
    expect(aggregate.rows[0].requests).toBe(2);
  });

  it('caps total user traffic and cleans expired identity counters', async () => {
    await database.query('insert into public.bingo_relay_request_budget (subject, requests) values ($1, 600)', [
      `user:${hostUser}:all`,
    ]);
    await database.query(
      "insert into public.bingo_relay_request_budget (subject, window_started_at) values ('user:stale:all', now() - interval '3 days')",
    );
    const blocked = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      hostUser,
      'heartbeat',
    ]);
    expect(blocked.rows[0].result.allowed).toBe(false);
    const stale = await database.query(
      "select * from public.bingo_relay_request_budget where subject = 'user:stale:all'",
    );
    expect(stale.rows).toEqual([]);
  });

  it('caps project-wide creations across fresh identities without allocating their counters', async () => {
    await database.query(
      "insert into public.bingo_relay_request_budget (subject, requests) values ('global:create', 500)",
    );
    for (const userId of [hostUser, guestUser, recoveringUser]) {
      const request = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
        userId,
        'create',
      ]);
      expect(request.rows[0].result.allowed).toBe(false);
    }
    const counters = await database.query(
      "select * from public.bingo_relay_request_budget where subject like 'user:%'",
    );
    expect(counters.rows).toEqual([]);
    const gameplay = await database.query('select public.consume_bingo_relay_request($1, $2) as result', [
      guestUser,
      'publish',
    ]);
    expect(gameplay.rows[0].result.allowed).toBe(true);
  });

  it('preserves all ten competing gameplay writes when conflicted snapshots are retried', async () => {
    await insertRoom();
    const results = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        let current = await storedRoom('ABCD');
        for (let attempt = 0; attempt < 20; attempt++) {
          const state = structuredClone(current.state);
          state.acceptedTropes.push(`Concurrent observation ${index}`);
          const { rows } = await database.query(
            'select public.commit_bingo_gameplay_state($1, $2, $3::jsonb) as result',
            ['ABCD', current.revision, JSON.stringify(state)],
          );
          const result = rows[0].result;
          if (result.saved) return { ...result, attempts: attempt + 1 };
          expect(result.conflict).toBe(true);
          current = { state: result.state, revision: result.revision };
        }
        throw new Error('Ten-writer contention did not settle');
      }),
    );
    expect(results).toHaveLength(10);
    expect(Math.max(...results.map((result) => result.attempts))).toBeGreaterThan(5);
    const room = await storedRoom('ABCD');
    expect(room.revision).toBe(10);
    expect(new Set(room.state.acceptedTropes).size).toBe(10);
    expect(room.state.acceptedTropes).toEqual(
      expect.arrayContaining(Array.from({ length: 10 }, (_, index) => `Concurrent observation ${index}`)),
    );
  });

  it('saves gameplay without refreshing host presence and rejects stale gameplay revisions', async () => {
    await insertRoom();
    const original = await storedRoom('ABCD');
    const state = roomState('ABCD', 'guest-action');
    const { rows } = await database.query('select public.commit_bingo_gameplay_state($1, $2, $3::jsonb) as result', [
      'ABCD',
      0,
      JSON.stringify(state),
    ]);
    expect(rows[0].result).toMatchObject({ saved: true, revision: 1 });
    const saved = await storedRoom('ABCD');
    expect(saved.host_seen_at).toEqual(original.host_seen_at);
    expect(saved.expires_at).toEqual(original.expires_at);
    const stale = await database.query('select public.commit_bingo_gameplay_state($1, $2, $3::jsonb) as result', [
      'ABCD',
      0,
      JSON.stringify(state),
    ]);
    expect(stale.rows[0].result.conflict).toBe(true);
    const permissions = await database.query(
      "select has_function_privilege('authenticated', 'public.commit_bingo_gameplay_state(text,bigint,jsonb)', 'EXECUTE') as allowed",
    );
    expect(permissions.rows[0].allowed).toBe(false);
  });

  it('commits the snapshot and synchronizes membership status and host role atomically', async () => {
    await insertRoom();
    const nextState = { ...roomState('ABCD', 'committed'), serverRevision: 0 };

    const result = await commit('ABCD', 0, nextState);

    expect(result).toMatchObject({ saved: true, revision: 1, code: 'ABCD' });
    expect(result.state).toMatchObject({ serverRevision: 1, players: { p1: { name: 'committed' } } });
    const { rows } = await database.query(
      `select player_id, is_host, status from public.bingo_room_members where room_code = 'ABCD' order by player_id`,
    );
    expect(rows).toEqual([
      { player_id: 'p1', is_host: true, status: 'active' },
      { player_id: 'p2', is_host: false, status: 'active' },
      { player_id: 'p3', is_host: false, status: 'pending' },
      { player_id: 'p4', is_host: false, status: 'revoked' },
      { player_id: 'p5', is_host: false, status: 'revoked' },
    ]);
  });

  it('allows only one concurrent writer using the same expected revision', async () => {
    await insertRoom();
    const hostSnapshot = roomState('ABCD', 'host-wins');
    const cohostSnapshot = roomState('ABCD', 'cohost-stale');

    const results = await Promise.all([commit('ABCD', 0, hostSnapshot), commit('ABCD', 0, cohostSnapshot)]);

    expect(results.filter((result) => result.saved)).toHaveLength(1);
    expect(results.filter((result) => result.conflict)).toHaveLength(1);
    const winner = await storedRoom('ABCD');
    expect(winner.revision).toBe(1);
    expect(winner.state.serverRevision).toBe(1);
    expect(['host-wins', 'cohost-stale']).toContain(winner.state.players.p1.name);
    const conflict = results.find((result) => result.conflict);
    expect(conflict.state).toEqual(winner.state);
  });

  it('migrates room code, snapshot, and memberships together and rolls back a collision', async () => {
    await insertRoom();
    await insertRoom({ code: 'EFGH', state: roomState('EFGH', 'other-room') });
    const collidingState = roomState('EFGH', 'collision');

    await expect(commit('ABCD', 0, collidingState, 'EFGH')).rejects.toMatchObject({ code: '23505' });
    expect((await storedRoom('ABCD')).revision).toBe(0);
    expect((await storedRoom('ABCD')).state.code).toBe('ABCD');

    const movedState = roomState('WXYZ', 'migrated');
    const result = await commit('ABCD', 0, movedState, 'WXYZ');

    expect(result).toMatchObject({ saved: true, revision: 1, code: 'WXYZ' });
    expect(await storedRoom('ABCD')).toBeNull();
    expect((await storedRoom('WXYZ')).state.players.p1.name).toBe('migrated');
    const { rows } = await database.query(
      "select count(*)::int as count from public.bingo_room_members where room_code = 'WXYZ'",
    );
    expect(rows[0].count).toBe(5);
  });

  it('transfers the host membership and increments state revision in one recovery transaction', async () => {
    await insertRoom();

    const { rows } = await database.query(
      `select public.recover_bingo_host('ABCD', 'p1', $1, 'Recovered Host', 'test-verifier') as result`,
      [recoveringUser],
    );
    expect(rows[0].result).toMatchObject({ ok: true, playerId: 'p1', revision: 1 });
    const recovered = await storedRoom('ABCD');
    expect(recovered.state).toMatchObject({
      rev: 1,
      serverRevision: 1,
      players: { p1: { name: 'Recovered Host', connected: true } },
    });
    const { rows: memberRows } = await database.query(
      `select user_id::text as user_id, is_host, status from public.bingo_room_members where room_code = 'ABCD' and player_id = 'p1'`,
    );
    expect(memberRows[0]).toEqual({ user_id: recoveringUser, is_host: true, status: 'active' });
  });

  it('rejects invalid or stale state without changing the stored room', async () => {
    await insertRoom();
    const invalid = await commit('ABCD', 0, { ...roomState('ABCD'), code: 'WXYZ' });
    const stale = await commit('ABCD', 1, roomState('ABCD', 'stale'));

    expect(invalid).toEqual({ error: 'invalid_state' });
    expect(stale).toMatchObject({ conflict: true, revision: 0, code: 'ABCD' });
    const room = await storedRoom('ABCD');
    expect(room.revision).toBe(0);
    expect(room.state.players.p1.name).toBe('Host');
  });

  it('refuses host recovery when the old host heartbeat is still fresh', async () => {
    const state = roomState();
    state.players.p1.connected = true;
    await insertRoom({ state, oldHostSeen: false });

    const { rows } = await database.query(
      `select public.recover_bingo_host('ABCD', 'p1', $1, 'Recovered Host', 'test-verifier') as result`,
      [recoveringUser],
    );

    expect(rows[0].result).toEqual({ error: 'host_still_connected' });
    expect((await storedRoom('ABCD')).revision).toBe(0);
    const { rows: memberRows } = await database.query(
      `select user_id::text as user_id from public.bingo_room_members where room_code = 'ABCD' and player_id = 'p1'`,
    );
    expect(memberRows[0].user_id).toBe(hostUser);
  });
});
