import { useState } from 'react';
import ModalShell from './ModalShell.jsx';

const MAX_LENGTH = 60;

// Lets a player submit a brand-new free-text trope mid-game for majority
// approval -- reuses the same claim/vote pipeline as regular claims.
export default function CustomTropeModal({ onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>📝 Submit a Custom Trope</h3>
        <p className="hint">
          Not covered by the board? Type it in — the group votes on approving it just like any other claim, and it's
          added to the trope pool if approved.
        </p>
        <label htmlFor="custom-trope-input">Trope description</label>
        <input
          id="custom-trope-input"
          type="text"
          maxLength={MAX_LENGTH}
          autoFocus
          placeholder="e.g. Someone quotes the tagline"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="hint">
          {trimmed.length} / {MAX_LENGTH}
        </p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" disabled={!trimmed} onClick={() => onSubmit(trimmed)}>
            Submit for approval
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
