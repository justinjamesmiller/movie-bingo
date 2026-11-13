export class RelayPublisher {
  constructor(client, { isValidReplicatedState }) {
    this.client = client;
    this.isValidReplicatedState = isValidReplicatedState;
  }

  send(msg) {
    const client = this.client;
    if (msg.t === 'state' && client.state) client.state.rev = (client.state.rev || 0) + 1;
    let message = msg;
    const fingerprint = message.t === 'action' ? JSON.stringify(message.action) : null;
    client._uncertainActions ||= new Map();
    const uncertain = client._uncertainActions.get(fingerprint);
    const actionRevision = client.state?.serverRevision;
    if (uncertain && uncertain.revision === actionRevision && uncertain.message) message = uncertain.message;
    const requestId =
      message.t === 'action'
        ? uncertain?.revision === actionRevision
          ? uncertain.requestId
          : crypto.randomUUID()
        : undefined;
    const isSnapshot = message.t === 'state' || message.t === 'welcome' || message.t === 'migrate';
    const independent = ['reaction', 'resolved', 'replacementResolved'].includes(message.t);
    const generation = client._statePublishGeneration;
    const publish = async () => {
      if (isSnapshot && generation !== client._statePublishGeneration) return null;
      const expectedRevision = isSnapshot
        ? Number.isSafeInteger(message.state?.serverRevision)
          ? message.state.serverRevision
          : Number.isSafeInteger(client.state?.serverRevision)
            ? client.state.serverRevision
            : 0
        : undefined;
      if (isSnapshot && message.state?.serverRevision == null) message.state.serverRevision = expectedRevision;
      const values = {
        code: client.code,
        playerId: client.myId,
        ...(isSnapshot && { expectedRevision }),
        ...(requestId && { requestId }),
        message,
      };
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await client._relayRequest('publish', values);
          break;
        } catch (error) {
          if (!requestId || !client._serverGameplayEnabled || !error.retryable || attempt === 2) throw error;
        }
      }
      if (fingerprint) client._uncertainActions.delete(fingerprint);
      if (result?.conflict && this.isValidReplicatedState(result.state)) {
        client._statePublishGeneration += 1;
        client.state = result.state;
        client._emitState();
        client.onEvent({ type: 'stateConflict' });
        return null;
      }
      if (
        Number.isSafeInteger(result?.revision) &&
        result.revision > (client.state?.serverRevision || 0) &&
        result.code === client.state?.code
      ) {
        if (message.t === 'action' && this.isValidReplicatedState(result.state)) client.state = result.state;
        client.state.serverRevision = result.revision;
        client._emitState();
      }
      return result;
    };
    const request = independent ? publish() : client._publishQueue.then(publish);
    if (!independent) client._publishQueue = request.catch(() => {});
    return request.catch((error) => {
      if (fingerprint && client._serverGameplayEnabled && error.retryable) {
        client._uncertainActions.set(fingerprint, { requestId, revision: actionRevision, message });
        if (client._uncertainActions.size > 32)
          client._uncertainActions.delete(client._uncertainActions.keys().next().value);
      }
      client.onEvent({ type: 'relayError', message: error.message || 'The secure game relay rejected an update.' });
      return null;
    });
  }
}
