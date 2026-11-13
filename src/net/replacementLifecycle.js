export class ReplacementLifecycle {
  constructor(context) {
    this.context = context;
  }

  beginReplacement(pendingClaim, approvedByText) {
    const state = this.context.getState();
    const affected = Object.values(state.players).filter((player) => player.board.includes(pendingClaim.text));
    const candidates = this.context
      .getEligibleTropeTexts(pendingClaim.genre, pendingClaim.subgenre)
      .filter(
        (text) =>
          text !== pendingClaim.text &&
          text !== this.context.freeSpaceText &&
          !affected.some((player) => player.board.includes(text)),
      );
    if (candidates.length === 0) {
      this.context.logActivity(
        `🔁 "${pendingClaim.text}" was approved to be swapped out, but no replacement was available.${approvedByText}`,
      );
      return false;
    }
    state.pendingReplacement = {
      replacementId: `${pendingClaim.claimId}-replacement`,
      byId: pendingClaim.byId,
      oldText: pendingClaim.text,
      genre: pendingClaim.genre,
      subgenre: pendingClaim.subgenre,
      candidates: this.context.shuffle(candidates),
      index: 0,
      affectedIds: affected.map((player) => player.id),
    };
    this.context.logActivity(`🔁 "${pendingClaim.text}" was approved for replacement.${approvedByText}`);
    return true;
  }

  handleAction(playerId, action) {
    const state = this.context.getState();
    const replacement = state.pendingReplacement;
    if (!replacement || replacement.byId !== playerId) return;
    if (action.t === 'cancelReplacement') {
      state.pendingReplacement = null;
      this.context.logActivity(
        `🔁 ${this.context.formatPlayerName(state.players[playerId])} cancelled the replacement for "${replacement.oldText}".`,
      );
    } else if (action.t === 'cycleReplacement') {
      replacement.index = (replacement.index + 1) % replacement.candidates.length;
    } else {
      if (!replacement.candidates.includes(action.text)) return;
      const wagerFreedIds = this.applyReplacement(replacement, action.text);
      state.pendingReplacement = null;
      this.context.send({ t: 'replacementResolved', wagerFreedIds });
    }
    this.context.emitState();
    this.context.send({ t: 'state', state });
    if (!state.pendingReplacement) this.context.drainQueue();
  }

  applyReplacement(replacement, newText) {
    const state = this.context.getState();
    const affected = Object.values(state.players).filter((player) => replacement.affectedIds.includes(player.id));
    const wagerFreedIds = [];
    for (const player of affected) {
      const index = player.board.indexOf(replacement.oldText);
      if (index === -1) continue;
      if (player.wagered.includes(index)) wagerFreedIds.push(player.id);
      player.board[index] = newText;
      player.wagered = player.wagered.filter((wageredIndex) => wageredIndex !== index);
      player.marked = player.marked.filter((markedIndex) => markedIndex !== index);
      if (state.acceptedTropes.includes(newText)) player.marked.push(index);
    }
    for (const [playerId, calledText] of Object.entries(state.calls || {})) {
      if (calledText === replacement.oldText) {
        this.context.finishCall(playerId, 'replaced');
        delete state.calls[playerId];
      }
    }
    if (!state.tropePool.includes(newText)) state.tropePool.push(newText);
    state.acceptedTropes = state.acceptedTropes.filter((text) => text !== replacement.oldText);
    delete state.acceptedTropeProposers?.[replacement.oldText];
    delete state.acceptedCalls?.[replacement.oldText];
    this.context.logActivity(`🔁 "${replacement.oldText}" was swapped out for "${newText}".`);
    return wagerFreedIds;
  }
}
