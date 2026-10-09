import { describe, expect, it, vi } from 'vitest';
import { broadcastMessages } from './broadcast.js';

describe('request-scoped broadcasts', () => {
  it('subscribes once and sends committed state before outcomes on a private acknowledged channel', async () => {
    const send = vi.fn().mockResolvedValue('ok');
    const channel = { subscribe: vi.fn((callback) => callback('SUBSCRIBED')), send };
    const service = { channel: vi.fn().mockReturnValue(channel), removeChannel: vi.fn().mockResolvedValue('ok') };
    await broadcastMessages(service, 'ABCD', [{ t: 'state' }, { t: 'resolved' }], 'pserver');
    expect(service.channel).toHaveBeenCalledTimes(1);
    expect(service.channel).toHaveBeenCalledWith(
      'bingo-ABCD',
      expect.objectContaining({ config: { private: true, broadcast: { self: false, ack: true } } }),
    );
    expect(send.mock.calls.map(([message]) => message.payload.t)).toEqual(['state', 'resolved']);
    expect(service.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('cleans up failed sends and does not send later outcomes after a state delivery failure', async () => {
    const channel = { subscribe: (callback) => callback('SUBSCRIBED'), send: vi.fn().mockResolvedValue('error') };
    const service = { channel: () => channel, removeChannel: vi.fn().mockResolvedValue('ok') };
    await expect(broadcastMessages(service, 'ABCD', [{ t: 'state' }, { t: 'resolved' }], 'pserver')).rejects.toThrow();
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(service.removeChannel).toHaveBeenCalledTimes(1);
  });
});
