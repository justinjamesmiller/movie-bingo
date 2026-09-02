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
    this.state = 'closed';
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
    queueMicrotask(() => {
      this.state = 'joined';
      cb('SUBSCRIBED');
    });
    return this;
  }

  track() {
    // Presence payload itself isn't asserted on in these tests.
  }

  presenceState() {
    const present = {};
    for (const peer of bus.get(this.name) || []) present[peer.presenceKey] = [{ id: peer.presenceKey }];
    return present;
  }

  // Simulates the transport dropping without an explicit removeChannel (what a
  // backgrounded phone or a flaky network actually does): peers see a presence
  // leave, and this channel stops sending and receiving.
  simulateDrop() {
    const peers = bus.get(this.name);
    this.state = 'closed';
    if (!peers) return;
    peers.delete(this);
    for (const peer of peers) {
      for (const cb of peer._leaveHandlers) cb({ key: this.presenceKey });
    }
  }

  send({ payload }) {
    const peers = bus.get(this.name);
    if (!peers || this.state !== 'joined') return;
    for (const peer of peers) {
      if (peer === this) continue;
      // Real broadcasts go over the wire as JSON, so peers must never end up
      // sharing a live object reference with the sender.
      const copy = structuredClone(payload);
      queueMicrotask(() => {
        for (const cb of peer._broadcastHandlers) cb({ payload: copy });
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
      channel.state = 'closed';
      const peers = bus.get(channel.name);
      if (!peers) return;
      peers.delete(channel);
      for (const peer of peers) {
        for (const cb of peer._leaveHandlers) cb({ key: channel.presenceKey });
      }
    },
  };
}
