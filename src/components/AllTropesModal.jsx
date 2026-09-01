import { useState } from 'react';
import { useLongPress } from '../hooks/useLongPress.js';

function TropeItem({ text, accepted, onShortPress, onLongPress }) {
  const longPress = useLongPress(
    () => onLongPress(text),
    () => onShortPress(text),
  );
  return (
    <button className="btn challenge-item" disabled={accepted} {...longPress}>
      {text}{accepted ? ' (accepted)' : ''}
    </button>
  );
}

export default function AllTropesModal({ tropePool, acceptedTropes, onPropose, onRequestReplace, onClose }) {
  const [pendingText, setPendingText] = useState(null);
  const sorted = [...tropePool].sort((a, b) => a.localeCompare(b));

  if (pendingText) {
    return (
      <div className="modal">
        <div className="modal-content">
          <h3>Propose this trope for acceptance?</h3>
          <p className="claim-text">{pendingText}</p>
          <p className="hint">This asks the group to vote on marking it as having happened, on any board that has it.</p>
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={() => onPropose(pendingText)}>👍 Yes, propose it</button>
            <button className="btn disagree" onClick={() => setPendingText(null)}>👎 Never mind</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>All Tropes ({sorted.length})</h3>
        <p className="hint">
          Click a trope to propose it happened (whether or not it's on your board), or long-press to
          propose replacing it with a different one.
        </p>
        <ul className="challenge-list">
          {sorted.map((text) => (
            <li key={text}>
              <TropeItem
                text={text}
                accepted={acceptedTropes.includes(text)}
                onShortPress={setPendingText}
                onLongPress={onRequestReplace}
              />
            </li>
          ))}
        </ul>
        <button className="btn cancel-claim-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
