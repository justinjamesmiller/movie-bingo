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
    if (!groups.has(achievement.badgeName)) groups.set(achievement.badgeName, []);
    groups.get(achievement.badgeName).push(formatPlayerName(achievement));
  }
  return (
    <aside className="badge-announcement" role="status" aria-live="polite" aria-label="New badges">
      <strong>New badges</strong>
      {[...groups].map(([badge, names]) => (
        <p key={badge}>
          {names.join(', ')} earned <strong>{badge}</strong>
        </p>
      ))}
    </aside>
  );
}
