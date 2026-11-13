export class RelayMessageHandler {
  constructor(client, { isValidPlayerId, isValidReplicatedState, allowedReactions, clearSavedSession }) {
    this.client = client;
    this.isValidPlayerId = isValidPlayerId;
    this.isValidReplicatedState = isValidReplicatedState;
    this.allowedReactions = allowedReactions;
    this.clearSavedSession = clearSavedSession;
  }

  handle(data) {
    const client = this.client;
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.t !== 'string') return;
    if (data.sender != null && !this.isValidPlayerId(data.sender)) return;
    if (data.sender === client.myId) return;
    if (data.sender !== 'pserver' && !client._allowIncomingMessage(data.sender)) return;
    if (
      (data.t === 'state' ||
        data.t === 'stateConflict' ||
        data.t === 'migrate' ||
        (data.t === 'welcome' && data.to === client.myId && client._pendingJoin)) &&
      !this.isValidReplicatedState(data.state)
    ) {
      return;
    }
    if (data.t === 'migrate' && (typeof data.newCode !== 'string' || !data.newCode)) return;
    client._notePeerAlive(data.sender);
    switch (data.t) {
      case 'join':
        if (client._currentHostId() === client.myId) client._handleJoin(data.from, data.name, data.forceNew);
        break;
      case 'rejoin':
        if (client._authorityId(data.from) === client.myId) client._handleRejoin(data.from, data.name);
        break;
      case 'welcome':
        if (data.to === client.myId && client._pendingJoin) {
          client.state = data.state;
          if (client._pendingJoin.awaitingApproval) {
            client._saveSession(client.code, client._pendingJoin.name);
            client._pendingJoin = null;
            client._emitState();
            client.onEvent({ type: 'joinApproved' });
          } else {
            client._pendingJoin.resolve();
            client._emitState();
            client._flushQueuedActions();
          }
        }
        break;
      case 'joinPending':
        if (data.to === client.myId && client._pendingJoin?.pending) {
          client._pendingJoin.pending();
        }
        break;
      case 'claimOffer':
        if (data.to === client.myId && client._pendingJoin?.choice && Array.isArray(data.options)) {
          const options = data.options.filter(
            (option) =>
              option &&
              this.isValidPlayerId(option.id) &&
              typeof option.name === 'string' &&
              typeof option.avatar === 'string' &&
              Number.isInteger(option.seat),
          );
          if (typeof data.allowNew === 'boolean' && (options.length > 0 || data.allowNew)) {
            client._pendingJoin.choice(options, data.allowNew);
          }
        }
        break;
      case 'joinRejected':
        if (data.to === client.myId && client._pendingJoin) {
          if (client._pendingJoin.awaitingApproval) {
            client._pendingJoin = null;
            this.clearSavedSession();
            const reason =
              data.reason === 'busy'
                ? 'Someone else was already waiting to join — try again shortly.'
                : 'The host declined your request to join.';
            client.onEvent({ type: 'joinDenied', reason });
            client.destroy();
          } else {
            const reason =
              data.reason === 'busy'
                ? 'Someone else is already waiting to join — try again in a moment.'
                : 'Could not join that game.';
            client._pendingJoin.reject?.(new Error(reason));
          }
        }
        break;
      case 'rejoinFailed':
        if (data.to === client.myId && client._pendingJoin) {
          client._pendingJoin.reject?.(new Error('That session could not be found — the game may have ended.'));
        }
        break;
      case 'state':
        if (!client._shouldAcceptState(data)) break;
        client.state = data.state;
        client._emitState();
        client._ensureSeatConnected();
        break;
      case 'stateConflict': {
        const incomingRevision = data.state?.serverRevision;
        const currentRevision = client.state?.serverRevision;
        if (
          this.isValidReplicatedState(data.state) &&
          Number.isSafeInteger(incomingRevision) &&
          (!Number.isSafeInteger(currentRevision) || incomingRevision > currentRevision)
        ) {
          client.state = data.state;
          client._emitState();
          client._ensureSeatConnected();
        }
        break;
      }
      case 'resolved':
        client.onEvent({
          type: 'claimResolved',
          text: data.text,
          kind: data.kind,
          custom: !!data.custom,
          byId: data.byId,
          approved: data.approved,
          approvedBy: Array.isArray(data.approvedBy)
            ? data.approvedBy
                .filter((player) => player && typeof player === 'object' && !Array.isArray(player))
                .map((player) => ({
                  id: typeof player.id === 'string' ? player.id : '',
                  name: typeof player.name === 'string' ? player.name : 'Unknown player',
                  avatar: typeof player.avatar === 'string' ? player.avatar : '👤',
                }))
            : [],
          disagreeRationaleCounts: data.disagreeRationaleCounts || {},
          proposedBy: Array.isArray(data.proposedBy) ? data.proposedBy.filter(this.isValidPlayerId) : [],
          wagerFreed: Array.isArray(data.wagerFreedIds) && data.wagerFreedIds.includes(client.myId),
          missedCalls: Array.isArray(data.missedCalls)
            ? data.missedCalls.filter(
                (call) => call && typeof call.playerId === 'string' && typeof call.text === 'string',
              )
            : [],
        });
        break;
      case 'proposalRejected':
        if (data.to === client.myId) {
          client.onEvent({
            type: 'proposalRejected',
            message: typeof data.message === 'string' ? data.message.slice(0, 240) : 'Proposal could not be queued.',
          });
        }
        break;
      case 'claimCancelled':
        client.onEvent({ type: 'claimCancelled', text: data.text });
        break;
      case 'replacementResolved':
        client.onEvent({
          type: 'replacementResolved',
          wagerFreed: Array.isArray(data.wagerFreedIds) && data.wagerFreedIds.includes(client.myId),
        });
        break;
      case 'reaction':
        if (typeof data.from === 'string' && this.allowedReactions.has(data.emoji)) {
          client.onEvent({ type: 'reaction', from: data.from, emoji: data.emoji });
        }
        break;
      case 'gameReset':
        client.onEvent({ type: 'gameReset' });
        break;
      case 'gameOverAnnounced':
        this.clearSavedSession();
        client.onEvent({ type: 'gameOver' });
        break;
      case 'gameResumed':
        client._saveCurrentSession();
        client.onEvent({ type: 'gameResumed' });
        break;
      case 'hostAdded':
        if (data.to === client.myId) {
          client.onEvent({
            type: 'hostAdded',
            byName: typeof data.byName === 'string' ? data.byName.slice(0, 40) : 'A player',
            byAvatar: typeof data.byAvatar === 'string' ? data.byAvatar.slice(0, 16) : '👤',
          });
        }
        break;
      case 'migrate':
        if (!client.state) break;
        if (!data.state.players[client.myId]) {
          this.clearSavedSession();
          client.onEvent({ type: 'kicked' });
          client.destroy();
          client.state = null;
          break;
        }
        client.state = data.state;
        client._emitState();
        client.onEvent({ type: 'codeChanged', code: data.newCode });
        client._migrateToCode(data.newCode).catch(() => {});
        break;
      case 'action':
        if (
          client._currentHostId() === client.myId &&
          typeof data.from === 'string' &&
          data.action &&
          typeof data.action === 'object' &&
          !Array.isArray(data.action)
        ) {
          client._applyAction(data.from, data.action);
        }
        break;
      default:
        break;
    }
  }
}
