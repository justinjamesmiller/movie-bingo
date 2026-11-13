export class ClaimQueueLifecycle {
  constructor(context) {
    this.context = context;
  }

  sceneContext(playerId, value) {
    const note = typeof value?.note === 'string' ? value.note.trim().slice(0, 240) : '';
    const timestamp = typeof value?.timestamp === 'string' ? value.timestamp.trim().slice(0, 120) : '';
    return note || timestamp ? { playerId, note, timestamp } : null;
  }

  submitProposal(playerId, text, kind, meta = {}, context) {
    const state = this.context.getState();
    const scene = this.sceneContext(playerId, context);
    if (
      state.pendingClaim?.kind === 'mark' &&
      kind === 'mark' &&
      state.pendingClaim.text === text &&
      !!state.pendingClaim.custom === !!meta.custom
    ) {
      this.context.mergeDuplicateMarkProposal(playerId, text, scene);
      return;
    }
    if (!state.pendingClaim && !state.pendingReplacement && !(state.claimQueue || []).length) {
      this.context.startClaim(playerId, text, kind, { ...meta, sceneContexts: scene ? [scene] : [] });
      return;
    }
    state.claimQueue ||= [];
    const duplicate = state.claimQueue.find(
      (item) =>
        item.text === text &&
        item.kind === kind &&
        item.meta.genre === meta.genre &&
        item.meta.subgenre === meta.subgenre &&
        !!item.meta.custom === !!meta.custom,
    );
    if (duplicate) {
      if (!duplicate.proposedBy.includes(playerId)) {
        duplicate.proposedBy.push(playerId);
        if (scene) duplicate.sceneContexts.push(scene);
      }
    } else {
      if (
        state.claimQueue.length >= 30 ||
        state.claimQueue.filter((item) => item.proposedBy.includes(playerId)).length >= 5
      ) {
        const message =
          'The claim queue is full or you already have five waiting proposals. Withdraw one before adding another.';
        if (playerId === this.context.getPlayerId()) this.context.onEvent({ type: 'proposalRejected', message });
        this.context.send({ t: 'proposalRejected', to: playerId, message });
        return;
      }
      state.claimQueue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        byId: playerId,
        proposedBy: [playerId],
        text,
        kind,
        meta,
        sceneContexts: scene ? [scene] : [],
      });
    }
    this.context.emitState();
    this.context.send({ t: 'state', state });
  }

  withdraw(playerId, queueId) {
    const state = this.context.getState();
    const entry = (state.claimQueue || []).find((item) => item.id === queueId);
    if (!entry?.proposedBy.includes(playerId)) return;
    entry.proposedBy = entry.proposedBy.filter((id) => id !== playerId);
    entry.sceneContexts = entry.sceneContexts.filter((context) => context.playerId !== playerId);
    if (!entry.proposedBy.length) state.claimQueue = state.claimQueue.filter((item) => item !== entry);
    else entry.byId = entry.proposedBy[0];
    this.context.emitState();
    this.context.send({ t: 'state', state });
  }

  drain() {
    const state = this.context.getState();
    if (state.gameOver || state.pendingClaim || state.pendingReplacement) return;
    while (state.claimQueue?.length) {
      const eligibleIndex = state.claimQueue.findIndex((item) =>
        item.proposedBy.some((id) => state.players[id]?.connected),
      );
      if (eligibleIndex === -1) break;
      const [entry] = state.claimQueue.splice(eligibleIndex, 1);
      const proposers = entry.proposedBy.filter((id) => state.players[id]?.connected);
      if (!proposers.length) continue;
      const accepted = state.acceptedTropes.includes(entry.text);
      if ((entry.kind === 'unmark' && !accepted) || (entry.kind !== 'unmark' && accepted)) continue;
      if (!entry.meta.custom && !state.tropePool.includes(entry.text)) continue;
      for (const id of proposers.slice(1)) this.context.superlativeStats(id).submissions += 1;
      this.context.startClaim(proposers[0], entry.text, entry.kind, {
        ...entry.meta,
        proposedBy: proposers,
        sceneContexts: entry.sceneContexts.filter((context) => proposers.includes(context.playerId)),
      });
      return;
    }
    this.context.emitState();
    this.context.send({ t: 'state', state });
  }
}
