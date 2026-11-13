export class RelayStateLifecycle {
  constructor(client, { recordAwardTransitions, getSavedSession, clearSavedSession }) {
    this.client = client;
    this.recordAwardTransitions = recordAwardTransitions;
    this.getSavedSession = getSavedSession;
    this.clearSavedSession = clearSavedSession;
  }

  emit() {
    const client = this.client;
    const watch = client.state?.marathon?.watches?.length || 0;
    if (
      client._viewWatch !== undefined &&
      (watch !== client._viewWatch || (client._viewStarted && !client.state?.started))
    ) {
      clearTimeout(client._viewFlushTimer);
      client._pendingViews = [];
      client._viewBatch = null;
    }
    client._viewWatch = watch;
    client._viewStarted = !!client.state?.started;
    if (!client._serverGameplayEnabled && client.state && client._isActiveHostId(client.myId)) {
      this.recordAwardTransitions(client._lastAwardState, client.state);
      client._lastAwardState = structuredClone(client.state);
    }
    if (client.state && !Object.hasOwn(client.state.players, client.myId) && !client._pendingJoin) {
      this.clearSavedSession();
      client.onEvent({ type: 'kicked', reason: 'Your player session was recovered on another device.' });
      client.destroy();
      client.state = null;
      return;
    }
    client.deadlineLifecycle.scheduleBoardRecovery();
    client._saveSnapshot();
    const saved = this.getSavedSession();
    const me = client.state?.players?.[client.myId];
    if (
      saved?.myId === client.myId &&
      saved.code === client.code &&
      me &&
      (saved.avatar !== me.avatar || saved.name !== me.name)
    ) {
      client._saveSession(client.code, me.name);
    }
    client._scheduleSessionExpiry();
    client.deadlineLifecycle.scheduleServerManagedClaim();
    client.onState(client.state, client.myId);
    client._syncHostHeartbeat();
  }
}
