import { useEffect, useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function BoardRecoveryModal({ request, source, target, isSource, onKeepPlaying, onCancel }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [request.id]);
  const seconds = Math.max(0, Math.ceil((request.expiresAt - now) / 1000));
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const respond = () => {
    if (seconds > 0) (isSource ? onKeepPlaying : onCancel)();
  };
  return (
    <ModalShell onClose={respond}>
      <div className="modal-content board-recovery-modal">
        <h3>{isSource ? 'Are you still playing?' : 'Waiting for player response'}</h3>
        <p className="hint">
          {isSource
            ? `The host wants to recover your player session on ${formatPlayerName(target)}'s device. Confirm you are still playing to keep your board.`
            : `Waiting for ${formatPlayerName(source)} to confirm they are still playing before restoring their session to ${formatPlayerName(target)}.`}
        </p>
        <p className="recovery-countdown" role="timer" aria-label="Recovery countdown" aria-live="off">
          {countdown}
        </p>
        <p className="hint">{seconds > 0 ? 'Time remaining to respond' : 'Completing recovery...'}</p>
        <button className="btn agree" disabled={seconds === 0} onClick={respond}>
          {isSource ? "I'm still playing" : 'Cancel recovery'}
        </button>
      </div>
    </ModalShell>
  );
}
