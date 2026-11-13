export class RelayAuthority {
  constructor(client) {
    this.client = client;
  }

  currentHostId() {
    const client = this.client;
    if (!client.state) return null;
    const hostIds = this.hostIds();
    return client.state.seatOrder.find((id) => hostIds.includes(id) && client.state.players[id]?.connected) || null;
  }

  hostIds() {
    const hostIds = this.client.state?.hostIds;
    return Array.isArray(hostIds) && hostIds.length > 0 ? hostIds : [];
  }

  isHostId(id) {
    return this.hostIds().includes(id);
  }

  isActiveHostId(id) {
    const client = this.client;
    const activeHostIds = this.hostIds().filter((hostId) => client.state.players[hostId]?.connected);
    return activeHostIds.includes(id);
  }

  connectedCount() {
    return Object.values(this.client.state.players).filter((player) => player.connected).length;
  }

  // Ignoring one seat answers who should act for the table while that player is away.
  authorityId(excludeId = null) {
    const client = this.client;
    if (!client.state) return null;
    return (
      client.state.seatOrder.find(
        (id) => id !== excludeId && this.hostIds().includes(id) && client.state.players[id]?.connected,
      ) || null
    );
  }
}
