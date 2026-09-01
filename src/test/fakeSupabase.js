// Minimal in-memory fake of the tiny slice of the @supabase/supabase-js
// Realtime API that relay.js actually uses (channel/on/subscribe/track/send/
// removeChannel), so GameClient instances can talk to each other inside
// tests without any real network. All `createClient()` calls share one
// module-level bus, mirroring how every real client ultimately talks through
// the same Supabase project -- call `resetFakeSupabase()` between tests.
const bus = new Map();

export function resetFakeSupabase() {
  bus.clear();
}

class FakeChannel {
  constructor(name, presenceKey) {
    this.name = name;
    this.presenceKey = presenceKey;
    this._broadcastHandlers = [];
    this._leaveHandlers = [];
  }

  on(type, filter, cb) {
    if (type === 'broadcast') this._broadcastHandlers.push(cb);
    else if (type === 'presence' && filter?.event === 'leave') this._leaveHandlers.push(cb);
    return this;
  }

  subscribe(cb) {
    if (!bus.has(this.name)) bus.set(this.name, new Set());
    bus.get(this.name).add(this);
    queueMicrotask(() => cb('SUBSCRIBED'));
    return this;
  }

  track() {
    // Presence payload itself isn't asserted on in these tests.
  }

  send({ payload }) {
    const peers = bus.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      queueMicrotask(() => {
        for (const cb of peer._broadcastHandlers) cb({ payload });
      });
    }
  }
}

export function createClient() {
  return {
    channel(name, config) {
      const presenceKey = config?.config?.presence?.key;
      return new FakeChannel(name, presenceKey);
    },
    removeChannel(channel) {
      const peers = bus.get(channel.name);
      if (!peers) return;
      peers.delete(channel);
      for (const peer of peers) {
        for (const cb of peer._leaveHandlers) cb({ key: channel.presenceKey });
      }
    },
  };
}
