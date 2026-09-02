import { useState } from 'react';
import { useTropeDescription } from '../hooks/useTropeDescription.js';

function TropeItem({ text, accepted, onSelect }) {
  return (
    <button
      className={`btn challenge-item${accepted ? ' accepted' : ''}`}
      disabled={accepted}
      onClick={() => onSelect(text)}
    >
      {text}
    </button>
  );
}

export default function AllTropesModal({ tropePool, acceptedTropes, onPropose, onRequestReplace, onClose }) {
  const [pendingText, setPendingText] = useState(null);
  const { description } = useTropeDescription(pendingText);
  const sorted = [...tropePool].sort((a, b) => a.localeCompare(b));

  if (pendingText) {
    return (
      <div className="modal">
        <div className="modal-content">
          <h3>Propose this trope for acceptance?</h3>
          <p className="claim-text">{pendingText}</p>
          {description && (
            <>
              <p className="trope-description">{description.what}</p>
              <p className="hint">
                <strong>For example:</strong> {description.example}
              </p>
            </>
          )}
          <p className="hint">
            This asks the group to vote on marking it as having happened, on any board that has it.
          </p>
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={() => onPropose(pendingText)}>
              👍 Yes, propose it
            </button>
            <button className="btn disagree" onClick={() => setPendingText(null)}>
              👎 Never mind
            </button>
          </div>
          <button className="btn secondary-action" onClick={() => onRequestReplace(pendingText)}>
            🔁 Propose swapping this trope out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>All Tropes ({sorted.length})</h3>
        <p className="hint">
          Click a trope to propose it happened (whether or not it's on your board), or to propose replacing it with a
          different one.
        </p>
        <ul className="challenge-list">
          {sorted.map((text) => (
            <li key={text}>
              <TropeItem text={text} accepted={acceptedTropes.includes(text)} onSelect={setPendingText} />
            </li>
          ))}
        </ul>
        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
