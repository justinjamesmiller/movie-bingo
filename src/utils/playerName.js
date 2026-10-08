export function formatPlayerName(player, fallback = 'Unknown player') {
  const name = typeof player === 'string' ? player : player?.name;
  return `${player?.avatar || '👤'} ${name || fallback}`;
}
