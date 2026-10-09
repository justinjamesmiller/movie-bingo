import { useEffect, useEffectEvent, useState } from 'react';
import { formatPlayerName } from '../utils/playerName.js';

export default function BadgeAnnouncement({ achievements, suspended, onDismiss }) {
  const [blocked, setBlocked] = useState(() => !!document.querySelector('.modal, .game-menu-panel'));
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const update = () => setBlocked(!!document.querySelector('.modal, .game-menu-panel'));
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (blocked || suspended) return;
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, [achievements, blocked, suspended]);
  if (blocked || suspended) return null;
  const groups = new Map();
  for (const achievement of achievements) {
    const kind = achievement.awardKind || 'badge';
    const key = `${kind}:${achievement.badgeName}`;
    if (!groups.has(key)) groups.set(key, { kind, name: achievement.badgeName, players: [] });
    groups.get(key).players.push(formatPlayerName(achievement));
  }
  return (
    <aside className="badge-announcement" role="status" aria-live="polite" aria-label="New awards">
      <strong>New badges and superlatives</strong>
      {[...groups.values()].map(({ kind, name, players }) => (
        <p key={`${kind}:${name}`}>
          {players.join(', ')} {kind === 'superlative' ? 'now holds the superlative' : 'earned the badge'}{' '}
          <strong>{name}</strong>
        </p>
      ))}
    </aside>
  );
}
