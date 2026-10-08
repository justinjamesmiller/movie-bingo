import { useState } from 'react';
import ModalShell from './ModalShell.jsx';

export default function HostRecoveryPasswordModal({ onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const canSubmit = password.length >= 12 && password.length <= 128 && password === confirmation;

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Host recovery password</h3>
        <p className="hint">
          Use this password with the game code to restore your host seat and board on another device. It is stored as a
          server-side verifier, not in this browser.
        </p>
        <label htmlFor="host-recovery-password">New password</label>
        <input
          id="host-recovery-password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label htmlFor="host-recovery-confirm">Confirm password</label>
        <input
          id="host-recovery-confirm"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {password.length > 0 && password.length < 12 && (
          <p className="hint" role="alert">
            Use at least 12 characters.
          </p>
        )}
        {confirmation.length > 0 && password !== confirmation && (
          <p className="hint" role="alert">
            Passwords do not match.
          </p>
        )}
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn primary" disabled={!canSubmit} onClick={() => onConfirm(password)}>
            Set recovery password
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
