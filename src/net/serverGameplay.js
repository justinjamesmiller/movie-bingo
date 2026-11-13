import { recordAwardTransitions } from '../utils/superlatives.js';
import { SERVER_GAMEPLAY_ACTIONS } from './gameplayActions.js';

export function applyServerGameAction(createEngine, claimTimeoutMs, snapshot, playerId, action, viewBatch) {
  if (!SERVER_GAMEPLAY_ACTIONS.has(action?.t) || !Object.hasOwn(snapshot.players, playerId)) {
    throw new Error('Invalid server gameplay action.');
  }
  const messages = [];
  const engine = createEngine({ snapshot, playerId, messages });
  Object.assign(engine, {
    state: structuredClone(snapshot),
    myId: playerId,
    code: snapshot.code,
    _serverMode: true,
    _pendingDisconnects: new Map(),
  });
  const previousAwardState = structuredClone(engine.state);
  if (engine.state.pendingClaim) engine.state.pendingClaim.serverManaged = true;
  if (engine.state.pendingClaim && !Number.isFinite(engine.state.pendingClaim.expiresAt)) {
    const createdAt = Number(engine.state.pendingClaim.claimId.split('-')[1]);
    engine.state.pendingClaim.expiresAt = (Number.isFinite(createdAt) ? createdAt : Date.now()) + claimTimeoutMs;
    engine.state.pendingClaim.serverManaged = true;
  }
  if (engine.state.pendingClaim?.expiresAt <= Date.now()) {
    engine._resolveClaim(engine.state.pendingClaim.claimId);
  }
  if (engine.state.pendingBoardRecovery?.expiresAt <= Date.now()) engine._completeBoardRecovery();
  if (viewBatch) {
    engine.state.viewBatches ||= {};
    const seen = (engine.state.viewBatches[playerId] ||= []);
    if (!seen.includes(viewBatch.id)) {
      for (const text of viewBatch.texts) engine._applyAction(playerId, { t: 'recordTropeView', text });
      seen.push(viewBatch.id);
      engine.state.viewBatches[playerId] = seen.slice(-32);
    }
  }
  if (action.t !== 'settleClaim') engine._applyAction(playerId, action);
  recordAwardTransitions(previousAwardState, engine.state);
  return { state: engine.state, messages };
}
