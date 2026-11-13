export class RelayActionDispatcher {
  constructor(client, { serverGameplayActions }) {
    this.client = client;
    this.serverGameplayActions = serverGameplayActions;
  }

  dispatch(action) {
    const client = this.client;
    if (!client.state) return;
    if (client.channel?.state !== 'joined') {
      client._queuedActions.push(action);
      client.onEvent({ type: 'actionQueued', actionType: action.t });
      return;
    }
    const request = client._actionQueue.then(async () => {
      await client._publishQueue;
      return this.dispatchConnected(action);
    });
    client._actionQueue = request.catch(() => {});
    return request;
  }

  dispatchConnected(action) {
    const client = this.client;
    if (client._serverGameplayEnabled && this.serverGameplayActions.has(action?.t)) {
      clearTimeout(client._viewFlushTimer);
      if (!client._viewBatch && client._pendingViews?.length)
        client._viewBatch = { id: crypto.randomUUID(), texts: client._pendingViews.splice(0, 20) };
      const viewBatch = client._viewBatch;
      if (action.t === 'flushViews' && !viewBatch) return;
      return client
        ._send({ t: 'action', from: client.myId, action, ...(viewBatch && { viewBatch }) })
        .then((result) => {
          if (result && client._viewBatch === viewBatch) client._viewBatch = null;
          if (result && client._pendingViews?.length)
            client._viewFlushTimer = setTimeout(() => client.flushTropeViews(), 300);
          return result;
        });
    }
    const currentHostId = client._currentHostId();
    if (!currentHostId) {
      client._queuedActions.push(action);
      client.onEvent({ type: 'actionQueued', actionType: action.t });
      return;
    }
    if (currentHostId === client.myId) {
      client._applyAction(client.myId, action);
      return client._publishQueue;
    }
    return client._send({ t: 'action', from: client.myId, action });
  }

  flushQueuedActions() {
    const client = this.client;
    if (client.channel?.state !== 'joined' || client._queuedActions.length === 0) return;
    const actions = client._queuedActions.splice(0);
    actions.forEach((action) => client._dispatch(action));
  }
}
