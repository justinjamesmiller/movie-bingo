export class PlayerStateLifecycle {
  constructor(client, { centerIndex, maxWagers }) {
    this.client = client;
    this.centerIndex = centerIndex;
    this.maxWagers = maxWagers;
  }

  handleAction(playerId, action, player) {
    const client = this.client;
    const state = client.state;
    if (action.t === 'recordTropeView') {
      if (state.gameOver || typeof action.text !== 'string' || !state.tropePool.includes(action.text)) return true;
      const stats = client._superlativeStats(playerId);
      stats.views += 1;
      if (!stats.viewedTropes.includes(action.text)) stats.viewedTropes.push(action.text);
      client._emitState();
      client._send({ t: 'state', state });
      return true;
    }

    if (action.t === 'setWager') {
      if (state.started) return true;
      const indices = Array.isArray(action.indices)
        ? action.indices.filter(
            (index) =>
              Number.isInteger(index) && index >= 0 && index < 25 && !(state.freeSpace && index === this.centerIndex),
          )
        : [];
      player.wagered = Array.from(new Set(indices)).slice(0, this.maxWagers);
      client._emitState();
      client._send({ t: 'state', state: client.state });
      return true;
    }

    return false;
  }
}
