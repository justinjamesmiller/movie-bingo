export async function broadcastMessages(service, code, messages, sender) {
  if (!messages.length) return;
  const channel = service.channel(`bingo-${code}`, {
    config: { private: true, broadcast: { self: false, ack: true } },
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Realtime relay timed out.')), 5000);
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          clearTimeout(timeout);
          reject(error || new Error(`Realtime relay ${status.toLowerCase()}.`));
        }
      });
    });
    for (const message of messages) {
      const result = await channel.send({ type: 'broadcast', event: 'msg', payload: { ...message, sender } });
      if (result !== 'ok') throw new Error('Realtime relay rejected the message.');
    }
  } finally {
    await service.removeChannel(channel);
  }
}
