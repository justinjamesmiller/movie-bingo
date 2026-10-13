import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { formatPlayerName } from '../utils/playerName.js';
import ModalShell from './ModalShell.jsx';

export default function BadgeAnnouncement({ achievements, suspended, onDismiss }) {
  const [blocked, setBlocked] = useState(() => !!document.querySelector('.modal, .game-menu-panel'));
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const noticeRef = useRef(null);
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (blocked || suspended || expanded) return;
    const dismissOutside = (event) => {
      if (noticeRef.current && !noticeRef.current.contains(event.target)) dismiss();
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [achievements, blocked, suspended, expanded]);
  useEffect(() => {
    const update = () => setBlocked(!!document.querySelector('.modal, .game-menu-panel'));
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (blocked || suspended || expanded) return;
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, [achievements, blocked, suspended, expanded]);
  const groups = new Map();
  for (const achievement of achievements) {
    const kind = achievement.awardKind || 'badge';
    const key = `${kind}:${achievement.badgeName}`;
    if (!groups.has(key)) groups.set(key, { kind, name: achievement.badgeName, players: [] });
    groups.get(key).players.push(formatPlayerName(achievement));
  }
  const entries = [...groups.values()].map(({ kind, name, players }) => (
    <span className="badge-announcement-entry" key={`${kind}:${name}`}>
      {players.join(', ')} {kind === 'superlative' ? 'now holds the superlative' : 'earned the badge'}{' '}
      <strong>{name}</strong>
    </span>
  ));

  function closeDetails() {
    setExpanded(false);
    onDismiss();
  }

  if (expanded) {
    return (
      <ModalShell onClose={closeDetails}>
        <div
          className="modal-content badge-announcement-details"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeDetails();
            } else if (event.key === 'Tab') {
              event.preventDefault();
              event.currentTarget.querySelector('button')?.focus();
            }
          }}
        >
          <h3 id={headingId}>New badges and superlatives</h3>
          {entries}
          <button className="btn" autoFocus onClick={closeDetails}>
            Close
          </button>
        </div>
      </ModalShell>
    );
  }
  if (blocked || suspended) return null;
  return (
    <aside ref={noticeRef} className="badge-announcement" role="status" aria-live="polite" aria-label="New awards">
      <div className="badge-announcement-preview">{entries}</div>
      <button
        className="btn badge-announcement-more"
        aria-label="Show all new awards"
        aria-haspopup="dialog"
        title="Show all new awards"
        onClick={() => setExpanded(true)}
      >
        ...
      </button>
      <button className="btn badge-announcement-more" aria-label="Close notification" onClick={onDismiss}>
        X
      </button>
    </aside>
  );
}
