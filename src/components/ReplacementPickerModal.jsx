import { useState } from 'react';
import ModalShell from './ModalShell.jsx';

export default function ReplacementPickerModal({ replacement, isProposer, onCycle, onChoose, onCancel }) {
  const [listOpen, setListOpen] = useState(false);
  const current = replacement.candidates[replacement.index] || replacement.candidates[0];

  return (
    <ModalShell onClose={isProposer ? onCancel : undefined}>
      <div className="modal-content replacement-picker-modal">
        <h3>{isProposer ? 'Choose the replacement trope' : 'Replacement trope pending'}</h3>
        <p className="hint">
          {isProposer
            ? `The group approved replacing “${replacement.oldText}”. Choose a new trope from ${replacement.genre} / ${replacement.subgenre}.`
            : `The proposer is choosing a replacement for “${replacement.oldText}”.`}
        </p>
        {isProposer ? (
          <>
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
          </>
        ) : (
          <p className="hint">This will update for everyone once the proposer confirms a trope.</p>
        )}
      </div>
    </ModalShell>
  );
}
