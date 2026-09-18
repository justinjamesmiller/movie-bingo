import { useState } from 'react';
import {
  DEFAULT_EXTENDED_SESSION_HOURS,
  DEFAULT_SESSION_LIFETIME_HOURS,
  SESSION_LIFETIME_OPTIONS,
} from '../data/session.js';
import ModalShell from './ModalShell.jsx';

export default function SessionLifetimeModal({ currentExtended, currentHours, onConfirm, onCancel }) {
  const [extended, setExtended] = useState(!!currentExtended);
  const [hours, setHours] = useState(currentHours || DEFAULT_SESSION_LIFETIME_HOURS);

  function handleExtendedChange(nextExtended) {
    setExtended(nextExtended);
    if (nextExtended && hours < DEFAULT_EXTENDED_SESSION_HOURS) setHours(DEFAULT_EXTENDED_SESSION_HOURS);
    if (!nextExtended) setHours(DEFAULT_SESSION_LIFETIME_HOURS);
  }

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Session lifetime</h3>
        <p className="hint">
          Choose how long this game can remain available while everyone is away. Each update restarts the countdown.
        </p>
        <label className="checkbox-label">
          <input type="checkbox" checked={extended} onChange={(event) => handleExtendedChange(event.target.checked)} />
          Keep this game available for an extended period
        </label>
        <label htmlFor="session-lifetime-select">Time until the game expires</label>
        <select
          id="session-lifetime-select"
          value={hours}
          onChange={(event) => {
            const nextHours = Number(event.target.value);
            setHours(nextHours);
            setExtended(nextHours !== DEFAULT_SESSION_LIFETIME_HOURS);
          }}
        >
          {SESSION_LIFETIME_OPTIONS.map((option) => (
            <option key={option.hours} value={option.hours}>
              {option.label}
            </option>
          ))}
        </select>
        {!extended && (
          <p className="hint">Standard lifetime: 12 hours. Enable extended lifetime to choose a longer window.</p>
        )}
        <div className="claim-vote-buttons cancel-claim-btn">
          <button
            className="btn agree"
            onClick={() => onConfirm(extended, extended ? hours : DEFAULT_SESSION_LIFETIME_HOURS)}
          >
            Restart countdown
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
