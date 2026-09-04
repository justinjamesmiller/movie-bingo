// Shared pool of avatar emoji -- assigned randomly on join (avoiding a
// duplicate with any other currently-seated player when possible) and
// pickable via the Change Name and Avatar modal.
export const AVATAR_OPTIONS = [
  '🎬',
  '🍿',
  '👻',
  '🔪',
  '🧟',
  '🕵️',
  '💀',
  '🎭',
  '🦇',
  '🐺',
  '🎃',
  '🧛',
  '🔮',
  '🎥',
  '📼',
  '🩸',
  '🎞️',
  '🪄',
  '🔦',
  '🕸️',
  '⚰️',
  '🗡️',
  '🚁',
  '💣',
  '🎯',
  '👽',
  '🤖',
  '🐉',
  '👑',
  '💔',
  '🧠',
  '⭐',
];

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0];
