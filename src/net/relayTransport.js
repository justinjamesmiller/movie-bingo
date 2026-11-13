const MISSING_PARTITION_RETRY_DELAYS_MS = [500, 1500];

function isMissingPartitionError(error) {
  const message = typeof error === 'string' ? error : error?.message;
  return /MissingPartition|expected messages partition/i.test(message || '');
}

export class RelayTransport {
  constructor(client, options) {
    this.client = client;
    this.options = options;
    this.onWake = null;
  }

  installLifecycleListeners() {
    const client = this.client;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this.onWake = () => {
      if (document.visibilityState === 'hidden') return;
      client._checkConnection();
    };
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
    window.addEventListener('focus', this.onWake);
    window.addEventListener('pageshow', this.onWake);
  }

  removeLifecycleListeners() {
    if (!this.onWake) return;
    document.removeEventListener('visibilitychange', this.onWake);
    window.removeEventListener('online', this.onWake);
    window.removeEventListener('focus', this.onWake);
    window.removeEventListener('pageshow', this.onWake);
    this.onWake = null;
  }

  async connectChannel(code) {
    const client = this.client;
    let retryIndex = 0;
    while (true) {
      try {
        return await this.connectChannelOnce(code);
      } catch (error) {
        if (!isMissingPartitionError(error)) throw error;

        clearTimeout(client._reconnectTimer);
        client._reconnectTimer = null;
        if (client.channel) client.supabase.removeChannel(client.channel);
        client.channel = null;

        if (retryIndex >= MISSING_PARTITION_RETRY_DELAYS_MS.length || client._destroyed) {
          throw new Error(
            "Supabase Realtime couldn't initialize its messages partition after several attempts. Check your project's Realtime service and logs, then try again. If this happened while creating a game, your host seat was saved; use Reconnect to retry.",
            { cause: error },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, MISSING_PARTITION_RETRY_DELAYS_MS[retryIndex]));
        retryIndex += 1;
      }
    }
  }

  async connectChannelOnce(code) {
    const client = this.client;
    const { channelPrefix, connectTimeoutMs } = this.options;
    await client._ensureAuthenticated();
    client.code = code;
    return new Promise((resolve, reject) => {
      const channel = client.supabase.channel(channelPrefix + code, {
        config: { private: true, broadcast: { self: false }, presence: { key: client.myId } },
      });
      client.channel = channel;

      channel.on('broadcast', { event: 'msg' }, ({ payload }) => client._onMessage(payload));
      channel.on('presence', { event: 'leave' }, ({ key }) => client._onPeerLeft(key));

      const timeout = setTimeout(() => {
        if (client._destroyed || client.channel !== channel) return;
        client.onEvent({ type: 'connectionStatus', status: 'disconnected' });
        client.supabase.removeChannel(channel);
        if (client.channel === channel) client.channel = null;
        reject(new Error('Could not connect to the relay. Check your connection and try again.'));
      }, connectTimeoutMs);

      const finish = (callback) => {
        clearTimeout(timeout);
        callback();
      };
      let resubscribed = false;

      channel.subscribe((status, err) => {
        if (client._destroyed || client.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
          finish(() => {
            channel.track({ id: client.myId });
            client._reconnectAttempts = 0;
            clearTimeout(client._reconnectTimer);
            client._reconnectTimer = null;
            client.onEvent({ type: 'connectionStatus', status: 'connected' });
            client._syncHostHeartbeat();
            if (resubscribed) {
              client._announceSelf();
              client._flushQueuedActions();
            }
            resubscribed = true;
            resolve();
          });
        } else {
          client.onEvent({ type: 'connectionStatus', status: 'disconnected' });
          client._syncHostHeartbeat();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            client._scheduleReconnect();
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            finish(() => reject(err || new Error('Could not connect to the relay.')));
          }
        }
      });
    });
  }

  async migrateToCode(newCode) {
    const client = this.client;
    const oldChannel = client.channel;
    await client._connectChannel(newCode);
    if (oldChannel) client.supabase.removeChannel(oldChannel);
    const me = client.state?.players?.[client.myId];
    client._saveSession(newCode, me?.name || '');
  }

  scheduleReconnect() {
    const client = this.client;
    const { reconnectBaseDelayMs, reconnectMaxDelayMs } = this.options;
    if (client._destroyed || client._reconnectPaused || client._reconnectTimer || !client.state || !client.code) return;
    const ceiling = Math.min(reconnectBaseDelayMs * 2 ** client._reconnectAttempts, reconnectMaxDelayMs);
    const delay = Math.floor(ceiling * (0.5 + Math.random() * 0.5));
    client._reconnectAttempts += 1;
    client._reconnectTimer = setTimeout(() => {
      client._reconnectTimer = null;
      client._reconnect();
    }, delay);
  }

  reconnect() {
    const client = this.client;
    if (client._destroyed || client._reconnectPaused || !client.state || !client.code) return;
    if (client._reconnectPromise) return client._reconnectPromise;
    client._reconnectPromise = this.performReconnect().finally(() => {
      client._reconnectPromise = null;
    });
    return client._reconnectPromise;
  }

  async performReconnect() {
    const client = this.client;
    const { recoveryRequestTimeoutMs, isValidReplicatedState } = this.options;
    const oldChannel = client.channel;
    const code = client.code;
    let membership;
    try {
      await client._ensureAuthenticated();
      membership = await client._relayRequest(
        'join',
        { code, requestedPlayerId: client.myId },
        { timeout: recoveryRequestTimeoutMs },
      );
      if (client._destroyed || client._reconnectPaused || client.code !== code) return;
      if (
        membership.playerId !== client.myId ||
        membership.status !== 'active' ||
        !isValidReplicatedState(membership.state) ||
        !membership.state.players[client.myId]
      ) {
        throw new Error('Could not restore your authenticated player seat.');
      }
      await client._connectChannel(code);
    } catch {
      if (client.channel && client.channel !== oldChannel) client.supabase.removeChannel(client.channel);
      if (!client._destroyed) {
        client.channel = oldChannel;
        client.onEvent({ type: 'connectionStatus', status: 'disconnected' });
        if (!client._reconnectPaused) client._scheduleReconnect();
      }
      return;
    }
    if (client._destroyed || client._reconnectPaused || client.code !== code) return;
    if (oldChannel && oldChannel !== client.channel) client.supabase.removeChannel(oldChannel);
    if (membership.state.serverRevision >= client.state.serverRevision) client.state = membership.state;
    client.state.players[client.myId].connected = true;
    client._emitState();
    client._announceSelf();
    client._flushQueuedActions();
  }

  checkConnection() {
    const client = this.client;
    if (client._destroyed || client._reconnectPaused || !client.state || !client.code) return;
    if (client.channel?.state === 'joined' && client.supabase.realtime?.isConnected?.()) {
      clearTimeout(client._reconnectTimer);
      client._reconnectTimer = null;
      client._reconnectAttempts = 0;
      client.onEvent({ type: 'connectionStatus', status: 'connected' });
      return;
    }
    clearTimeout(client._reconnectTimer);
    client._reconnectTimer = null;
    client._reconnectAttempts = 0;
    return client._reconnect();
  }

  announceSelf() {
    const client = this.client;
    const me = client.state?.players?.[client.myId];
    if (!me) return;
    if (client._serverGameplayEnabled) return client._heartbeat().catch(() => {});
    if (me.connected && client._currentHostId() === client.myId) {
      client._send({ t: 'state', state: client.state });
      return;
    }
    client._send({ t: 'rejoin', from: client.myId, name: me.name });
  }
}
