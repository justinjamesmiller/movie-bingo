export class ClaimVoteLifecycle {
  constructor(context) {
    this.context = context;
  }

  handleAction(playerId, action) {
    const state = this.context.getState();
    if (action.t === 'vote') {
      const pendingClaim = state.pendingClaim;
      if (
        !pendingClaim ||
        pendingClaim.claimId !== action.claimId ||
        playerId === pendingClaim.byId ||
        Object.hasOwn(pendingClaim.votes, playerId)
      )
        return true;
      pendingClaim.votes[playerId] = !!action.agree;
      if (!action.agree && this.context.isValidDisagreeRationale(pendingClaim.kind, action.rationale)) {
        pendingClaim.disagreeRationaleCounts ||= {};
        pendingClaim.disagreeRationaleCounts[action.rationale] =
          (pendingClaim.disagreeRationaleCounts[action.rationale] || 0) + 1;
      }
      if (!this.context.maybeAutoResolve()) this.publishState();
      return true;
    }

    if (action.t === 'cancelClaim') {
      const pendingClaim = state.pendingClaim;
      if (!pendingClaim || pendingClaim.claimId !== action.claimId || playerId !== pendingClaim.byId) return true;
      this.context.clearClaimTimeout();
      state.pendingClaim = null;
      state.pendingReplacement = null;
      this.publishState();
      this.context.onEvent({ type: 'claimCancelled', text: pendingClaim.text });
      this.context.drainQueue();
      return true;
    }

    return false;
  }

  publishState() {
    this.context.emitState();
    this.context.send({ t: 'state', state: this.context.getState() });
  }
}
