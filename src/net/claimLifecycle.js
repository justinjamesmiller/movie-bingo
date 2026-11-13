import { BoardRecoveryLifecycle } from './boardRecoveryLifecycle.js';
import { ReplacementLifecycle } from './replacementLifecycle.js';
import { ClaimQueueLifecycle } from './claimQueueLifecycle.js';
import { ClaimResolutionLifecycle } from './claimResolutionLifecycle.js';
import { CallLifecycle } from './callLifecycle.js';
import { ClaimInitiationLifecycle } from './claimInitiationLifecycle.js';
import { ClaimVoteLifecycle } from './claimVoteLifecycle.js';
import { ClaimActionLifecycle } from './claimActionLifecycle.js';

const ACTIONS_BLOCKED_DURING_RECOVERY = new Set([
  'claim',
  'challenge',
  'proposeAccept',
  'proposeReplace',
  'proposeCustom',
  'proposeBoardSwap',
  'proposeWagerChange',
  'approveJoin',
  'denyJoin',
  'kick',
  'addHost',
  'resignHost',
  'proposeProfileChange',
  'restoreDisconnectedBoard',
]);

export class ClaimLifecycle {
  constructor(context) {
    this.context = context;
    this.initiationLifecycle = new ClaimInitiationLifecycle(context);
    this.voteLifecycle = new ClaimVoteLifecycle({
      ...context,
      maybeAutoResolve: () => this.maybeAutoResolve(),
      drainQueue: () => this.drainQueue(),
    });
    this.callLifecycle = new CallLifecycle(context);
    this.boardRecoveryLifecycle = new BoardRecoveryLifecycle({
      ...context,
      finishCall: (playerId, status) => this.finishCall(playerId, status),
    });
    this.replacementLifecycle = new ReplacementLifecycle({
      ...context,
      finishCall: (playerId, status) => this.finishCall(playerId, status),
    });
    this.queueLifecycle = new ClaimQueueLifecycle({
      ...context,
      sceneContext: (playerId, value) => this.sceneContext(playerId, value),
      mergeDuplicateMarkProposal: (playerId, text, scene) => this.mergeDuplicateMarkProposal(playerId, text, scene),
      startClaim: (playerId, text, kind, meta) => this.startClaim(playerId, text, kind, meta),
    });
    this.resolutionLifecycle = new ClaimResolutionLifecycle({
      ...context,
      beginReplacement: (pendingClaim, approvedByText) => this.beginReplacement(pendingClaim, approvedByText),
      finishCall: (playerId, status) => this.finishCall(playerId, status),
      drainQueue: () => this.drainQueue(),
    });
    this.actionLifecycle = new ClaimActionLifecycle(this);
  }

  finishCall(playerId, status) {
    return this.callLifecycle.finishCall(playerId, status);
  }

  rejectActionDuringRecovery(playerId, action) {
    if (!this.context.getState()?.pendingBoardRecovery || !ACTIONS_BLOCKED_DURING_RECOVERY.has(action?.t)) return false;
    const message = 'A player recovery is in progress. Try again after it finishes.';
    if (playerId === this.context.getPlayerId()) this.context.onEvent({ type: 'proposalRejected', message });
    else this.context.send({ t: 'proposalRejected', to: playerId, message });
    return true;
  }

  handleAction(playerId, action, player) {
    return this.actionLifecycle.handleAction(playerId, action, player);
  }

  publishState() {
    this.context.emitState();
    this.context.send({ t: 'state', state: this.context.getState() });
  }

  requestBoardRecovery(hostId, sourceId, targetId, timeoutSeconds) {
    return this.boardRecoveryLifecycle.requestBoardRecovery(hostId, sourceId, targetId, timeoutSeconds);
  }

  respondToBoardRecovery(playerId, requestId) {
    return this.boardRecoveryLifecycle.respondToBoardRecovery(playerId, requestId);
  }

  cancelBoardRecovery(hostId, requestId) {
    return this.boardRecoveryLifecycle.cancelBoardRecovery(hostId, requestId);
  }

  completeBoardRecovery() {
    return this.boardRecoveryLifecycle.completeBoardRecovery();
  }

  restoreDisconnectedBoard(hostId, targetId, sourceId, approvedRecovery = false) {
    return this.boardRecoveryLifecycle.restoreDisconnectedBoard(hostId, targetId, sourceId, approvedRecovery);
  }

  beginReplacement(pendingClaim, approvedByText) {
    return this.replacementLifecycle.beginReplacement(pendingClaim, approvedByText);
  }

  handleReplacementAction(playerId, action) {
    return this.replacementLifecycle.handleAction(playerId, action);
  }

  applyReplacement(replacement, newText) {
    return this.replacementLifecycle.applyReplacement(replacement, newText);
  }

  sceneContext(playerId, value) {
    return this.queueLifecycle.sceneContext(playerId, value);
  }

  submitProposal(playerId, text, kind, meta = {}, context) {
    return this.queueLifecycle.submitProposal(playerId, text, kind, meta, context);
  }

  drainQueue() {
    return this.queueLifecycle.drain();
  }

  startClaim(playerId, text, kind, meta = {}) {
    return this.initiationLifecycle.startClaim(playerId, text, kind, meta);
  }

  mergeDuplicateMarkProposal(playerId, text, scene) {
    return this.initiationLifecycle.mergeDuplicateMarkProposal(playerId, text, scene);
  }

  maybeAutoResolve() {
    return this.initiationLifecycle.maybeAutoResolve();
  }

  resolveClaim(claimId) {
    return this.resolutionLifecycle.resolveClaim(claimId);
  }
}
