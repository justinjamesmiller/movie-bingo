// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_RELAY_READ_MS, MAX_RELAY_REQUEST_BYTES, readRelayPayload, validateRelayPayload } from './payload.js';

const request = (body, headers = {}) =>
  new Request('http://localhost/relay', { method: 'POST', body, headers, duplex: 'half' });

describe('bounded relay payload parsing', () => {
  afterEach(() => vi.useRealTimers());
  it('cancels a stalled body after the total read deadline', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stream = new ReadableStream({ start() {}, cancel });
    const reading = readRelayPayload(request(stream));
    const rejection = expect(reading).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(MAX_RELAY_READ_MS);
    await rejection;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reads valid UTF-8 requests without requiring Content-Length', async () => {
    const body = { operation: 'join', name: 'Movie 🎬', code: 'ABCD' };
    expect(await readRelayPayload(request(JSON.stringify(body)))).toEqual(body);
  });

  it('rejects a declared oversized body before reading its stream', async () => {
    const read = vi.fn();
    await expect(
      readRelayPayload({
        headers: new Headers({ 'content-length': String(MAX_RELAY_REQUEST_BYTES + 1) }),
        body: { getReader: read },
      }),
    ).rejects.toMatchObject({ status: 413 });
    expect(read).not.toHaveBeenCalled();
  });

  it('bounds actual streamed bytes even when Content-Length claims a smaller size', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_RELAY_REQUEST_BYTES + 1));
      },
      cancel,
    });
    await expect(readRelayPayload(request(stream, { 'content-length': '1' }))).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each(['null', '[]', '{bad JSON', '{"operation":"join","__proto__":{}}', '{"nested":{"constructor":{}}}'])(
    'rejects invalid or dangerous JSON: %s',
    async (body) => {
      await expect(readRelayPayload(request(body))).rejects.toMatchObject({ status: 400 });
    },
  );

  it('rejects excessive nesting before operation handling', async () => {
    let nested = {};
    for (let index = 0; index < 20; index++) nested = { child: nested };
    await expect(readRelayPayload(request(JSON.stringify(nested)))).rejects.toMatchObject({ status: 400 });
  });
});

function sampleState() {
  const board = Array.from({ length: 25 }, (_, index) => `Trope ${index}`);
  return {
    code: 'ABCD',
    rev: 0,
    serverRevision: 0,
    players: { p1: { id: 'p1', name: 'Host', avatar: '🎬', seat: 0, connected: true, board, marked: [], wagered: [] } },
    seatOrder: ['p1'],
    hostIds: ['p1'],
    acceptedTropes: [],
    tropePool: board,
    genres: ['horror'],
    subgenreSelections: [],
    freeSpace: false,
    started: false,
    gameOver: false,
  };
}
const published = (action) => ({
  operation: 'publish',
  code: 'ABCD',
  playerId: 'p1',
  message: { t: 'action', from: 'p1', action },
});

describe('relay payload schemas', () => {
  it.each([
    { t: 'claim', index: 0, sceneContext: { note: 'A scene', timestamp: '01:23' } },
    { t: 'vote', claimId: 'claim-1', agree: true },
    { t: 'setWager', indices: [0, 1, 2, 3, 4] },
    { t: 'requestBoardRecovery', sourceId: 'p2', targetId: 'p3', timeoutSeconds: 300 },
    { t: 'respondToBoardRecovery', requestId: 'recovery-1' },
    { t: 'updateMovie', movie: { title: 'Manual title', poster: null } },
  ])('accepts the supported $t action envelope', (action) => {
    expect(validateRelayPayload(published(action))).toEqual(published(action));
  });

  it.each([
    { t: 'claim', index: 25 },
    { t: 'claim', index: -1 },
    { t: 'vote', claimId: 'claim-1', agree: 'yes' },
    { t: 'setWager', indices: Array(100).fill(0) },
    { t: 'proposeCustom', text: 'x'.repeat(61) },
    { t: 'proposeCustom', text: ' __proto__ ' },
    { t: 'changeName', name: '   ' },
    { t: 'unknownAction' },
    { t: 'requestBoardRecovery', sourceId: 'p2', targetId: 'p3', timeoutSeconds: 20 },
  ])('rejects malformed $t action fields', (action) => {
    expect(() => validateRelayPayload(published(action))).toThrow('Invalid relay payload');
  });

  it('accepts consistent create and state snapshot envelopes', () => {
    const state = sampleState();
    expect(validateRelayPayload({ operation: 'create', code: 'ABCD', playerId: 'p1', state })).toMatchObject({ state });
    expect(
      validateRelayPayload({
        operation: 'publish',
        code: 'ABCD',
        playerId: 'p1',
        expectedRevision: 0,
        message: { t: 'state', state },
      }),
    ).toMatchObject({ expectedRevision: 0 });
  });

  it.each(['board', 'roster', 'host', 'revision', 'code'])('rejects inconsistent %s snapshots', (kind) => {
    const state = sampleState();
    const body = {
      operation: 'publish',
      code: 'ABCD',
      playerId: 'p1',
      expectedRevision: 0,
      message: { t: 'state', state },
    };
    if (kind === 'board') state.players.p1.board.pop();
    if (kind === 'roster') state.seatOrder.push('p1');
    if (kind === 'host') state.hostIds.push('p2');
    if (kind === 'revision') body.expectedRevision = 1;
    if (kind === 'code') state.code = 'EFGH';
    expect(() => validateRelayPayload(body)).toThrow();
  });

  it('rejects unknown operations, message types, and unrecognized envelope fields', () => {
    expect(() => validateRelayPayload({ operation: 'admin', code: 'ABCD' })).toThrow();
    expect(() =>
      validateRelayPayload({ operation: 'publish', code: 'ABCD', playerId: 'p1', message: { t: 'arbitrary' } }),
    ).toThrow();
    expect(() => validateRelayPayload({ operation: 'join', code: 'ABCD', isHost: true })).toThrow();
  });

  it.each(['missing proposer approval', 'bad wager fields', 'bad statistics', 'invalid date', 'missing recovery seat'])(
    'rejects malformed nested state: %s',
    (kind) => {
      const state = sampleState();
      if (kind === 'missing proposer approval')
        state.pendingClaim = {
          claimId: 'claim-1',
          byId: 'p1',
          text: 'Trope 0',
          kind: 'mark',
          votes: {},
          totalPlayers: 1,
        };
      if (kind === 'bad wager fields')
        state.pendingClaim = {
          claimId: 'claim-1',
          byId: 'p1',
          text: '',
          kind: 'wagerChange',
          votes: { p1: true },
          totalPlayers: 1,
          add: 'not an array',
        };
      if (kind === 'bad statistics') state.superlativeStats = { p1: { submissions: 'a lot' } };
      if (kind === 'invalid date') state.sessionExpiresAt = Number.MAX_SAFE_INTEGER;
      if (kind === 'missing recovery seat')
        state.pendingBoardRecovery = {
          id: 'recovery-1',
          byId: 'p1',
          sourceId: 'p2',
          targetId: 'p1',
          expiresAt: Date.now() + 1000,
        };
      expect(() => validateRelayPayload({ operation: 'create', code: 'ABCD', playerId: 'p1', state })).toThrow();
    },
  );
});
