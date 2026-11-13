export class PresenceLifecycle {
  constructor(client, { disconnectGraceMs, claimTimeoutMs, isValidPlayerId }) {
    this.client = client;
    this.disconnectGraceMs = disconnectGraceMs;
    this.claimTimeoutMs = claimTimeoutMs;
    this.isValidPlayerId = isValidPlayerId;
  }

  onPeerLeft(peerId) {
    const client = this.client;
    if (!client.state || !this.isValidPlayerId(peerId) || !Object.hasOwn(client.state.players, peerId)) return;
    if (client._pendingDisconnects.has(peerId)) return;
    client._pendingDisconnects.set(
      peerId,
      setTimeout(() => {
        client._pendingDisconnects.delete(peerId);
        client._markDisconnected(peerId);
      }, this.disconnectGraceMs),
    );
  }

  isPresent(peerId) {
    try {
      return Object.keys(this.client.channel?.presenceState?.() || {}).includes(peerId);
    } catch {
      return false;
    }
  }

  notePeerAlive(peerId) {
    const client = this.client;
    if (
      !this.isValidPlayerId(peerId) ||
      peerId === client.myId ||
      !Object.hasOwn(client.state?.players || {}, peerId)
    ) {
      return;
    }
    const timer = client._pendingDisconnects.get(peerId);
    if (timer) {
      clearTimeout(timer);
      client._pendingDisconnects.delete(peerId);
    }
    const player = client.state.players[peerId];
    if (!player || player.connected) return;
    player.connected = true;
    client._emitState();
    if (!client._serverGameplayEnabled && client._currentHostId() === client.myId)
      client._send({ t: 'state', state: client.state });
  }

  markDisconnected(peerId) {
    const client = this.client;
    if (!client.state || !this.isValidPlayerId(peerId) || !Object.hasOwn(client.state.players, peerId)) return;
    if (this.isPresent(peerId)) return;
    const wasHost = client._currentHostId();
    client.state.players[peerId].connected = false;
    const nowHost = client._currentHostId();

    if (nowHost === client.myId && wasHost !== client.myId) {
      this.onPromotedToHost();
      client.onEvent({ type: 'promotedToHost' });
    }
    client._emitState();
    if (!client._serverGameplayEnabled && nowHost === client.myId) client._send({ t: 'state', state: client.state });
  }

  onPromotedToHost() {
    const client = this.client;
    if (!client.state.pendingClaim) return;
    clearTimeout(client.claimTimeout);
    const claimId = client.state.pendingClaim.claimId;
    client.claimTimeout = setTimeout(() => client._resolveClaim(claimId), this.claimTimeoutMs);
  }

  ensureSeatConnected() {
    const client = this.client;
    const me = client.state?.players?.[client.myId];
    if (!me || me.connected) return;
    me.connected = true;
    client._emitState();
    if (client._serverGameplayEnabled) {
      client._announceSelf();
      return;
    }
    if (client._authorityId(client.myId)) {
      client._send({ t: 'rejoin', from: client.myId, name: me.name });
    } else if (client.isHost()) {
      client._send({ t: 'state', state: client.state });
    }
  }

  clearPendingDisconnects() {
    const client = this.client;
    client._pendingDisconnects.forEach((timer) => clearTimeout(timer));
    client._pendingDisconnects.clear();
  }
}
