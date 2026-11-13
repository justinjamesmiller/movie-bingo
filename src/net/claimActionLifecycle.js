export class ClaimActionLifecycle {
  constructor(claimLifecycle) {
    this.claimLifecycle = claimLifecycle;
    this.context = claimLifecycle.context;
  }

  handleAction(playerId, action, player) {
    const lifecycle = this.claimLifecycle;
    const state = this.context.getState();
    if (action.t === 'proposeWagerChange') {
      if (!state.started || state.gameOver || state.pendingClaim) return true;
      const remove = Array.from(new Set(Array.isArray(action.remove) ? action.remove : [])).filter(
        (index) => Number.isInteger(index) && player.wagered.includes(index),
      );
      const add = Array.from(new Set(Array.isArray(action.add) ? action.add : [])).filter(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < 25 &&
          !(state.freeSpace && index === this.context.centerIndex) &&
          !player.marked.includes(index) &&
          !player.wagered.includes(index) &&
          !remove.includes(index),
      );
      if (add.length === 0 && remove.length === 0) return true;
      if (player.wagered.length - remove.length + add.length > this.context.maxWagers) return true;
      lifecycle.startClaim(playerId, '', 'wagerChange', {
        add,
        remove,
        addTexts: add.map((index) => player.board[index]),
        removeTexts: remove.map((index) => player.board[index]),
      });
      return true;
    }
    if (action.t === 'proposeBoardSwap') {
      if (state.started && !state.gameOver && !state.pendingClaim) lifecycle.startClaim(playerId, '', 'reroll');
      return true;
    }
    if (action.t === 'claim') {
      if (!state.started || state.gameOver) return true;
      const index = action.index;
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= 25 ||
        (state.freeSpace && index === this.context.centerIndex)
      )
        return true;
      lifecycle.submitProposal(
        playerId,
        player.board[index],
        player.marked.includes(index) ? 'unmark' : 'mark',
        {},
        action.sceneContext,
      );
      return true;
    }
    if (action.t === 'challenge') {
      if (
        state.started &&
        !state.gameOver &&
        typeof action.text === 'string' &&
        state.acceptedTropes.includes(action.text)
      ) {
        lifecycle.submitProposal(playerId, action.text, 'unmark', {}, action.sceneContext);
      }
      return true;
    }
    if (lifecycle.voteLifecycle.handleAction(playerId, action)) return true;
    if (lifecycle.callLifecycle.handleAction(playerId, action, player)) return true;
    if (action.t === 'withdrawQueuedClaim') {
      lifecycle.queueLifecycle.withdraw(playerId, action.queueId);
      return true;
    }
    if (action.t === 'proposeCustom') {
      if (state.gameOver || typeof action.text !== 'string') return true;
      const text = action.text.trim().slice(0, this.context.maxCustomTropeLength);
      if (!text || text === this.context.freeSpaceText || state.tropePool.includes(text)) return true;
      lifecycle.submitProposal(playerId, text, 'mark', { custom: true }, action.sceneContext);
      return true;
    }
    if (action.t === 'proposeReplace') {
      if (
        state.gameOver ||
        typeof action.text !== 'string' ||
        action.text === this.context.freeSpaceText ||
        state.acceptedTropes.includes(action.text) ||
        !state.tropePool.includes(action.text)
      )
        return true;
      const genre = this.context.isValidGenre(action.genre) ? action.genre : state.genres[0];
      const subgenre = this.context.isValidSubgenre(genre, action.subgenre) ? action.subgenre : 'general';
      lifecycle.submitProposal(playerId, action.text, 'replace', { genre, subgenre }, action.sceneContext);
      return true;
    }
    if (action.t === 'proposeAccept') {
      if (
        !state.gameOver &&
        typeof action.text === 'string' &&
        state.tropePool.includes(action.text) &&
        !state.acceptedTropes.includes(action.text)
      ) {
        lifecycle.submitProposal(playerId, action.text, 'mark', {}, action.sceneContext);
      }
      return true;
    }
    if (['chooseReplacement', 'cycleReplacement', 'cancelReplacement'].includes(action.t)) {
      lifecycle.handleReplacementAction(playerId, action);
      return true;
    }
    return false;
  }
}
