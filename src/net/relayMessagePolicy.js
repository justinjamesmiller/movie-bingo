export class RelayMessagePolicy {
  constructor(client, { messageRateWindowMs, maxMessagesPerWindow, maxTrackedMessageSenders }) {
    this.client = client;
    this.messageRateWindowMs = messageRateWindowMs;
    this.maxMessagesPerWindow = maxMessagesPerWindow;
    this.maxTrackedMessageSenders = maxTrackedMessageSenders;
    this.messageRateLimits = new Map();
  }

  allowIncomingMessage(sender) {
    const key = sender || 'unattributed';
    const now = Date.now();
    let bucket = this.messageRateLimits.get(key);
    if (!bucket || now - bucket.startedAt >= this.messageRateWindowMs) {
      bucket = { startedAt: now, count: 0 };
    }
    if (bucket.count >= this.maxMessagesPerWindow) return false;
    bucket.count += 1;
    this.messageRateLimits.set(key, bucket);
    if (this.messageRateLimits.size > this.maxTrackedMessageSenders) {
      this.messageRateLimits.delete(this.messageRateLimits.keys().next().value);
    }
    return true;
  }

  shouldAcceptState(data) {
    const client = this.client;
    if (!client.state || !data.sender) return true;
    const incomingServerRevision = data.state?.serverRevision;
    const currentServerRevision = client.state.serverRevision;
    if (
      Number.isSafeInteger(incomingServerRevision) &&
      Number.isSafeInteger(currentServerRevision) &&
      incomingServerRevision !== currentServerRevision
    ) {
      return incomingServerRevision > currentServerRevision;
    }
    if (client._serverGameplayEnabled && Number.isSafeInteger(incomingServerRevision)) return true;
    const incomingRev = data.state?.rev || 0;
    const myRev = client.state.rev || 0;
    if (data.sender === client.myId && incomingRev <= myRev) return false;
    if (incomingRev > myRev) return true;
    if (client._currentHostId() !== client.myId) return true;
    const mySeat = client.state.players[client.myId]?.seat;
    const theirSeat = Object.hasOwn(client.state.players, data.sender)
      ? client.state.players[data.sender]?.seat
      : Object.hasOwn(data.state?.players || {}, data.sender)
        ? data.state.players[data.sender]?.seat
        : null;
    if (mySeat == null || theirSeat == null || theirSeat < mySeat) return true;
    client._send({ t: 'state', state: client.state });
    return false;
  }

  clear() {
    this.messageRateLimits.clear();
  }
}
