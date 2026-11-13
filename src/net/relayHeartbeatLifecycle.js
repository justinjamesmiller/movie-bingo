export class RelayHeartbeatLifecycle {
  constructor(client, { intervalMs, isValidReplicatedState }) {
    this.client = client;
    this.intervalMs = intervalMs;
    this.isValidReplicatedState = isValidReplicatedState;
  }

  sync() {
    const client = this.client;
    if (!client.state || !client.code || client._destroyed || client.channel?.state !== 'joined') {
      clearInterval(client._hostHeartbeatTimer);
      client._hostHeartbeatTimer = null;
      return;
    }
    if (client._hostHeartbeatTimer) return;
    client._hostHeartbeatTimer = setInterval(() => {
      client._heartbeat().catch(() => {});
    }, this.intervalMs);
    client._hostHeartbeatTimer.unref?.();
  }

  async heartbeat() {
    const client = this.client;
    const code = client.code;
    const result = await client._relayRequest('heartbeat', { code, playerId: client.myId });
    if (
      !client._destroyed &&
      client.code === code &&
      this.isValidReplicatedState(result?.state) &&
      result.state.serverRevision > client.state?.serverRevision
    ) {
      client.state = result.state;
      client._emitState();
    }
    return result;
  }
}
