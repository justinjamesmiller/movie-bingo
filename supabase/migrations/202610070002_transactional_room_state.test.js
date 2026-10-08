// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const migration = await readFile(resolve(directory, '202610070002_transactional_room_state.sql'), 'utf8');
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
  await database.query('insert into auth.users values ($1), ($2), ($3)', [hostUser, guestUser, recoveringUser]);
});

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.exec('delete from public.bingo_rooms; delete from auth.users;');
  await database.query('insert into auth.users values ($1), ($2), ($3)', [hostUser, guestUser, recoveringUser]);
});

describe('transactional room state migration', () => {
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
