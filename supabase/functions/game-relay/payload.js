import { z as schema } from 'zod';
import { AVATAR_OPTIONS } from '../../../src/data/avatars.js';
import { GENRES, SUBGENRES_BY_GENRE, TOTAL_TROPES_OPTIONS } from '../../../src/data/tropes.js';
import { SESSION_LIFETIME_OPTIONS } from '../../../src/data/session.js';

export const MAX_RELAY_REQUEST_BYTES = 1_100_000;
export const MAX_RELAY_READ_MS = 8000;

export class RelayPayloadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validateStructure(body) {
  const stack = [{ value: body, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (++nodes > 50_000 || depth > 16) throw new RelayPayloadError('Relay request is too complex.');
    if (!value || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new RelayPayloadError('Invalid relay request key.');
      stack.push({ value: child, depth: depth + 1 });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RelayPayloadError('Invalid relay request.');
}

export async function readRelayPayload(request) {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RELAY_REQUEST_BYTES)) {
    throw new RelayPayloadError('Relay request is too large.', 413);
  }
  if (!request.body) throw new RelayPayloadError('Invalid relay request.');
  const reader = request.body.getReader();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new RelayPayloadError('Relay request body timed out.', 408)), MAX_RELAY_READ_MS);
  });
  let buffer = new Uint8Array(4096);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      const nextLength = length + value.byteLength;
      if (nextLength > MAX_RELAY_REQUEST_BYTES) {
        throw new RelayPayloadError('Relay request is too large.', 413);
      }
      if (nextLength > buffer.length) {
        const next = new Uint8Array(Math.min(MAX_RELAY_REQUEST_BYTES, Math.max(nextLength, buffer.length * 2)));
        next.set(buffer.subarray(0, length));
        buffer = next;
      }
      buffer.set(value, length);
      length = nextLength;
    }
  } catch (error) {
    reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
  } catch {
    throw new RelayPayloadError('Invalid relay JSON.');
  }
  validateStructure(body);
  return body;
}

const playerId = schema.string().regex(/^p[a-z0-9]{1,20}$/);
const code = schema.string().regex(/^[A-HJ-NP-Z2-9]{4}$/);
const token = schema.string().min(1).max(160);
const name = schema
  .string()
  .min(1)
  .max(20)
  .refine((value) => value.trim().length > 0);
const text = schema
  .string()
  .min(1)
  .max(240)
  .refine((value) => value.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value.trim()));
const password = schema.string().max(128);
const count = schema.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const index = schema.number().int().min(0).max(24);
const indexes = schema.array(index).max(25);
const ids = schema.array(playerId).max(32);
const avatar = schema.enum([...AVATAR_OPTIONS, '👤']);
const genre = schema.enum(GENRES.map((entry) => entry.id));
const selection = schema
  .object({ genre, subgenre: schema.string().max(64) })
  .strict()
  .refine((value) => SUBGENRES_BY_GENRE[value.genre]?.some((entry) => entry.id === value.subgenre));
const genres = schema.array(genre).min(1).max(GENRES.length);
const selections = schema.array(selection).max(80);
const percentages = schema.record(genre, schema.number().min(0).max(100).optional());
const scene = schema
  .object({ note: schema.string().max(240).optional(), timestamp: schema.string().max(120).optional() })
  .strict();
const movie = schema
  .object({
    title: schema.string().min(1).max(200),
    year: schema.string().max(32).optional(),
    type: schema.enum(['movie', 'series', 'episode']).optional(),
    poster: schema
      .string()
      .max(2048)
      .refine((value) => /^https?:\/\//i.test(value))
      .nullable()
      .optional(),
    imdbID: schema
      .string()
      .regex(/^tt\d{1,10}$/)
      .optional(),
    director: schema.string().max(1000).optional(),
    actors: schema.string().max(3000).optional(),
    genres: schema.array(genre).max(GENRES.length).optional(),
    unmapped: schema.array(schema.string().max(100)).max(32).optional(),
    subgenreSelections: selections.optional(),
  })
  .passthrough();
const setup = {
  genres,
  subgenreSelections: selections,
  freeSpace: schema.boolean(),
  generalPercents: percentages,
  totalTropes: schema.number().refine((value) => TOTAL_TROPES_OPTIONS.includes(value)),
  customTropes: schema.array(schema.string().min(1).max(60)).max(20).optional(),
  genrePercents: percentages.optional(),
  subgenrePercents: schema
    .record(genre, schema.record(schema.string().max(64), schema.number().min(0).max(100)).optional())
    .optional(),
  movie: movie.nullable().optional(),
};
const action = (type, fields = {}) => schema.object({ t: schema.literal(type), ...fields }).strict();
const actions = schema.discriminatedUnion('t', [
  action('recordTropeView', { text }),
  action('setWager', { indices: indexes }),
  action('proposeWagerChange', { add: indexes, remove: indexes }),
  action('proposeBoardSwap'),
  action('start'),
  action('claim', { index, sceneContext: scene.optional() }),
  action('challenge', { text, sceneContext: scene.optional() }),
  action('vote', { claimId: token, agree: schema.boolean(), rationale: schema.string().max(100).optional() }),
  action('toggleCall', { text }),
  action('withdrawQueuedClaim', { queueId: token }),
  action('cancelClaim', { claimId: token }),
  action('reset', setup),
  action('changeName', { name }),
  action('changeAvatar', { avatar }),
  action('proposeProfileChange', { targetId: playerId, name, avatar }),
  action('restoreDisconnectedBoard', { targetId: playerId, sourceId: playerId }),
  action('requestBoardRecovery', {
    targetId: playerId,
    sourceId: playerId,
    timeoutSeconds: schema.number().refine((value) => [0, 10, 30, 300].includes(value)),
  }),
  action('respondToBoardRecovery', { requestId: token }),
  action('cancelBoardRecovery', { requestId: token }),
  action('respondToProfileChange', { accept: schema.boolean() }),
  action('proposeCustom', { text: text.refine((value) => value.length <= 60), sceneContext: scene.optional() }),
  action('proposeReplace', { text, genre, subgenre: schema.string().max(64), sceneContext: scene.optional() }),
  action('chooseReplacement', { text }),
  action('cycleReplacement'),
  action('cancelReplacement'),
  action('proposeAccept', { text, sceneContext: scene.optional() }),
  action('updateSessionLifetime', {
    extended: schema.boolean(),
    hours: schema.number().refine((value) => SESSION_LIFETIME_OPTIONS.some((entry) => entry.hours === value)),
  }),
  action('updateMovie', { movie }),
  action('gameOver'),
  action('resumeGame'),
  action('addHost', { targetId: playerId }),
  action('resignHost'),
  action('kick', { targetId: playerId }),
  action('approveJoin'),
  action('denyJoin', { rotateCode: schema.boolean() }),
  action('settleClaim'),
  action('flushViews'),
]);
const player = schema
  .object({
    id: playerId,
    name,
    avatar: avatar.optional(),
    seat: count,
    connected: schema.boolean(),
    board: schema.array(text).length(25),
    marked: indexes,
    wagered: schema.array(index).max(5),
  })
  .passthrough();
const contexts = schema
  .array(schema.object({ playerId, note: schema.string().max(240), timestamp: schema.string().max(120) }).strict())
  .max(32);
const reasons = schema.record(schema.string().max(100), schema.number().int().min(0).max(32));
const state = schema
  .object({
    code,
    rev: count.optional(),
    serverRevision: count.optional(),
    players: schema.record(playerId, player),
    seatOrder: ids,
    hostIds: ids,
    acceptedTropes: schema.array(text).max(1000),
    tropePool: schema.array(text).max(1000),
    genres,
    subgenreSelections: selections,
    freeSpace: schema.boolean(),
    started: schema.boolean(),
    gameOver: schema.boolean(),
    sessionExpiresAt: schema.number().int().min(0).max(8_640_000_000_000_000).optional(),
    movie: movie.nullable().optional(),
    pendingClaim: schema
      .object({
        claimId: token,
        byId: playerId,
        text: schema.string().max(240),
        kind: schema.enum(['mark', 'unmark', 'replace', 'wagerChange', 'reroll']),
        votes: schema.record(playerId, schema.boolean()),
        totalPlayers: schema.number().int().min(1).max(32),
        proposedBy: ids.optional(),
        expiresAt: count.optional(),
        serverManaged: schema.boolean().optional(),
        custom: schema.boolean().optional(),
        add: indexes.optional(),
        remove: indexes.optional(),
        addTexts: schema.array(text).max(25).optional(),
        removeTexts: schema.array(text).max(25).optional(),
        genre: genre.optional(),
        subgenre: schema.string().max(64).optional(),
        sceneContexts: contexts.optional(),
        disagreeRationaleCounts: reasons.optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    pendingReplacement: schema
      .object({
        replacementId: token,
        byId: playerId,
        oldText: text,
        genre,
        subgenre: schema.string().max(64),
        candidates: schema.array(text).min(1).max(4096),
        index: count,
        affectedIds: ids,
      })
      .passthrough()
      .nullable()
      .optional(),
    claimQueue: schema
      .array(
        schema
          .object({
            id: token,
            byId: playerId,
            proposedBy: ids,
            text,
            kind: schema.enum(['mark', 'unmark', 'replace']),
            meta: schema.record(schema.string(), schema.unknown()),
            sceneContexts: schema.array(schema.unknown()).max(32),
          })
          .passthrough(),
      )
      .max(30)
      .optional(),
    claimHistory: schema.array(schema.record(schema.string(), schema.unknown())).max(100).optional(),
    calls: schema.record(playerId, text).optional(),
    callStats: schema
      .record(playerId, schema.object({ made: count.optional(), correct: count.optional() }).strict())
      .optional(),
    callHistory: schema
      .record(
        playerId,
        schema
          .array(
            schema
              .object({
                id: token,
                text,
                status: schema.enum(['active', 'scored', 'withdrawn', 'changed', 'replaced']),
              })
              .passthrough(),
          )
          .max(1024),
      )
      .optional(),
    pendingBoardRecovery: schema
      .object({ id: token, byId: playerId, sourceId: playerId, targetId: playerId, expiresAt: count })
      .strict()
      .nullable()
      .optional(),
    pendingJoinRequest: schema
      .object({ id: playerId, name, avatar: avatar.optional() })
      .passthrough()
      .nullable()
      .optional(),
    pendingProfileChanges: schema
      .record(playerId, schema.object({ name, avatar, proposedBy: name, proposedByAvatar: avatar.optional() }).strict())
      .optional(),
    superlativeStats: schema
      .record(playerId, schema.object({ viewedTropes: schema.array(text).max(1000).optional() }).catchall(count))
      .optional(),
    superlativeMilestones: schema.record(playerId, schema.record(schema.string().max(80), schema.boolean())).optional(),
  })
  .passthrough()
  .superRefine((value, context) => {
    const players = Object.keys(value.players);
    if (
      !players.length ||
      players.length > 32 ||
      new Set(value.seatOrder).size !== players.length ||
      value.seatOrder.length !== players.length ||
      value.seatOrder.some((id) => !Object.hasOwn(value.players, id)) ||
      !value.hostIds.length ||
      new Set(value.hostIds).size !== value.hostIds.length ||
      value.hostIds.some((id) => !Object.hasOwn(value.players, id)) ||
      players.some((id) => value.players[id].id !== id)
    )
      context.addIssue({ code: 'custom', message: 'Invalid player roster.' });
    if (value.pendingClaim) {
      const claim = value.pendingClaim;
      if (
        !Object.hasOwn(value.players, claim.byId) ||
        claim.votes[claim.byId] !== true ||
        Object.keys(claim.votes).length > claim.totalPlayers ||
        (claim.kind === 'wagerChange' && (!claim.add || !claim.remove || !claim.addTexts || !claim.removeTexts)) ||
        (claim.kind === 'replace' &&
          (!claim.genre || !SUBGENRES_BY_GENRE[claim.genre]?.some((entry) => entry.id === claim.subgenre)))
      ) {
        context.addIssue({ code: 'custom', message: 'Invalid pending claim.' });
      }
    }
    if (value.pendingReplacement && value.pendingReplacement.index >= value.pendingReplacement.candidates.length) {
      context.addIssue({ code: 'custom', message: 'Invalid replacement index.' });
    }
    if (
      value.pendingBoardRecovery &&
      [value.pendingBoardRecovery.byId, value.pendingBoardRecovery.sourceId, value.pendingBoardRecovery.targetId].some(
        (id) => !Object.hasOwn(value.players, id),
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid recovery seats.' });
    }
  });
const envelope = { sender: playerId.optional(), from: playerId.optional() };
const message = (type, fields = {}) => schema.object({ t: schema.literal(type), ...envelope, ...fields }).strict();
const messages = schema.discriminatedUnion('t', [
  message('action', {
    action: actions,
    viewBatch: schema
      .object({ id: schema.uuid(), texts: schema.array(text).min(1).max(20) })
      .strict()
      .optional(),
  }),
  message('state', { state }),
  message('welcome', { to: playerId, state }),
  message('migrate', { newCode: code, state }),
  message('join', { name: name.optional(), forceNew: schema.boolean().optional() }),
  message('rejoin', { name: name.optional() }),
  message('reaction', { emoji: schema.enum(['👏', '😂', '😱', '🔥', '❤️']) }),
  message('resolved', {
    text: schema.string().max(240),
    kind: schema.enum(['mark', 'unmark', 'replace', 'wagerChange', 'reroll']),
    approved: schema.boolean(),
    custom: schema.boolean().optional(),
    byId: playerId,
    proposedBy: ids.optional(),
    approvedBy: schema.array(schema.object({ id: playerId, name, avatar: avatar.optional() }).strict()).max(32),
    disagreeRationaleCounts: schema.record(schema.string().max(100), schema.number().int().min(0).max(32)),
    wagerFreedIds: ids,
    missedCalls: schema.array(schema.object({ playerId, text }).strict()).max(32),
  }),
  message('replacementResolved', { wagerFreedIds: ids }),
  message('gameReset'),
  message('gameOverAnnounced'),
  message('gameResumed'),
  message('hostAdded', { to: playerId, byName: name, byAvatar: avatar.optional() }),
  message('joinRejected', { to: playerId, reason: schema.enum(['busy', 'denied', 'started']) }),
  message('joinPending', { to: playerId }),
  message('rejoinFailed', { to: playerId }),
  message('proposalRejected', { to: playerId, message: schema.string().max(240) }),
  message('claimCancelled', { text: schema.string().max(240) }),
]);
const operation = (type, fields = {}) => schema.object({ operation: schema.literal(type), code, ...fields }).strict();
const schemas = schema.discriminatedUnion('operation', [
  operation('create', { playerId, state, hostRecoveryPassword: password.optional() }),
  operation('join', {
    requestedPlayerId: playerId.optional(),
    newSeat: schema.boolean().optional(),
    name: name.optional(),
    hostRecoveryPassword: password.optional(),
  }),
  operation('recover-host', { password, name: name.optional() }),
  operation('set-host-recovery-password', { playerId, password }),
  operation('join-status', { playerId }),
  operation('cancel-join', { playerId }),
  operation('claim-seat', { playerId, seatId: playerId }),
  operation('publish', {
    playerId,
    expectedRevision: count.optional(),
    requestId: schema.uuid().optional(),
    message: messages,
  }),
  operation('heartbeat', { playerId }),
  operation('leave', { playerId }),
]);

export function validateRelayPayload(body) {
  validateStructure(body);
  const result = schemas.safeParse(body);
  if (!result.success) throw new RelayPayloadError('Invalid relay payload.');
  if (
    body.operation === 'create' &&
    (body.state.code !== body.code || !Object.hasOwn(body.state.players, body.playerId))
  ) {
    throw new RelayPayloadError('Invalid room setup.');
  }
  if (body.operation === 'publish' && ['state', 'welcome', 'migrate'].includes(body.message.t)) {
    if (
      body.message.state.code !== (body.message.newCode || body.code) ||
      !Object.hasOwn(body.message.state.players, body.playerId) ||
      body.expectedRevision !== body.message.state.serverRevision
    ) {
      throw new RelayPayloadError('Invalid room snapshot.');
    }
  }
  return result.data;
}
