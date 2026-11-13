import { assessClaimVotes } from '../utils/claimVoting.js';

export class ClaimInitiationLifecycle {
  constructor(context) {
    this.context = context;
  }

  startClaim(playerId, text, kind, meta = {}) {
    const state = this.context.getState();
    if (['mark', 'unmark', 'replace'].includes(kind)) {
      if (
        !state.acceptedTropes.length &&
        Object.values(state.superlativeStats || {}).every((stats) => !stats.submissions)
      ) {
        this.context.recordSuperlativeMilestone('firstProposal', [playerId]);
      }
      this.context.superlativeStats(playerId).submissions += 1;
    }
    const createdAt = Date.now();
    const claimId = `${state.code}-${createdAt}-${Math.random().toString(36).slice(2, 6)}`;
    state.pendingClaim = {
      claimId,
      byId: playerId,
      text,
      kind,
      proposedBy: [playerId],
      ...meta,
      votes: Object.fromEntries((meta.proposedBy || [playerId]).map((id) => [id, true])),
      totalPlayers: this.context.connectedCount(),
      expiresAt: createdAt + this.context.claimTimeoutMs,
      serverManaged: this.context.isServerMode(),
    };
    this.context.scheduleClaimTimeout(claimId);
    if (this.maybeAutoResolve()) return;
    this.context.emitState();
    this.context.send({ t: 'state', state });
  }

  mergeDuplicateMarkProposal(playerId, text, scene) {
    const state = this.context.getState();
    const pendingClaim = state.pendingClaim;
    if (
      !pendingClaim ||
      pendingClaim.kind !== 'mark' ||
      pendingClaim.text !== text ||
      pendingClaim.byId === playerId ||
      pendingClaim.votes[playerId] === false
    )
      return false;
    if (!Array.isArray(pendingClaim.proposedBy)) pendingClaim.proposedBy = [pendingClaim.byId];
    if (pendingClaim.proposedBy.includes(playerId)) return false;
    this.context.superlativeStats(playerId).submissions += 1;
    pendingClaim.proposedBy.push(playerId);
    if (scene) {
      pendingClaim.sceneContexts ||= [];
      pendingClaim.sceneContexts.push(scene);
    }
    pendingClaim.votes[playerId] = true;
    this.context.logActivity(`👥 ${this.context.formatPlayerName(state.players[playerId])} also proposed "${text}".`);
    if (this.maybeAutoResolve()) return true;
    this.context.emitState();
    this.context.send({ t: 'state', state });
    return true;
  }

  maybeAutoResolve() {
    const pendingClaim = this.context.getState().pendingClaim;
    if (!pendingClaim || !assessClaimVotes(pendingClaim).shouldResolve) return false;
    this.context.resolveClaim(pendingClaim.claimId);
    return true;
  }
}
