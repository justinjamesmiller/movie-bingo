import { useState } from 'react';
import { useLongPress } from '../hooks/useLongPress.js';

function TropeItem({ text, onShortPress, onLongPress }) {
  const longPress = useLongPress(
    () => onLongPress(text),
    () => onShortPress(text),
  );
  return (
    <button className="btn challenge-item" {...longPress}>
      {text}
    </button>
  );
}

export default function AcceptedTropesModal({ acceptedTropes, onChallenge, onRequestReplace, onClose }) {
  const [pendingText, setPendingText] = useState(null);

  if (pendingText) {
    return (
      <div className="modal">
        <div className="modal-content">
          <h3>Challenge this trope?</h3>
          <p className="claim-text">{pendingText}</p>
          <p className="hint">This asks the group to vote on undoing it.</p>
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={() => onChallenge(pendingText)}>👍 Yes, challenge it</button>
            <button className="btn disagree" onClick={() => setPendingText(null)}>👎 Never mind</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Accepted Tropes</h3>
        {acceptedTropes.length === 0 ? (
          <p className="hint">No tropes have been accepted yet.</p>
        ) : (
          <>
            <p className="hint">
              Click a trope to challenge it (vote to undo it), or long-press to propose replacing it.
            </p>
            <ul className="challenge-list">
              {acceptedTropes.map((text) => (
                <li key={text}>
                  <TropeItem
                    text={text}
                    onShortPress={setPendingText}
                    onLongPress={onRequestReplace}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        <button className="btn cancel-claim-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
