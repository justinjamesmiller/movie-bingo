import { useState } from 'react';
import ModalShell from './ModalShell.jsx';

// Only the proposer sees this; everyone else just gets the resolved state.
export default function ReplacementPickerModal({ replacement, onCycle, onChoose, onCancel }) {
  const [listOpen, setListOpen] = useState(false);
  const current = replacement.candidates[replacement.index] || replacement.candidates[0];

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content replacement-picker-modal">
        <h3>Choose the replacement trope</h3>
        <p className="hint">
          The group approved replacing “{replacement.oldText}”. Choose a new trope from {replacement.genre} /{' '}
          {replacement.subgenre}.
        </p>
        <p className="claim-text replacement-suggestion">{current}</p>
        <div className="replacement-actions">
          <div className="claim-vote-buttons">
            <button className="btn" onClick={onCycle}>
              🔀 Pass
            </button>
            <button className="btn agree" onClick={() => onChoose(current)}>
              👍 Yes, use it
            </button>
          </div>
          <button className="btn" onClick={() => setListOpen((open) => !open)}>
            {listOpen ? 'Hide trope list' : 'Choose from full trope list'}
          </button>
          {listOpen && (
            <ul className="replacement-list">
              {replacement.candidates.map((candidate) => (
                <li key={candidate}>
                  <button className="btn" onClick={() => onChoose(candidate)}>
                    {candidate}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn disagree" onClick={onCancel}>
            Cancel replacement
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
