import { useState } from 'react';

// Lets a player stage BOTH removals (from their current wagers) and
// additions (from open board spaces) locally, then submit everything as one
// batched proposal for the group to approve together.
export default function ManageWagersModal({ board, wagered, marked, freeSpaceIndex, onSubmit, onCancel }) {
  const [toRemove, setToRemove] = useState([]);
  const [toAdd, setToAdd] = useState([]);

  const currentWagers = wagered.map((index) => ({ index, text: board[index] }));
  const eligibleToAdd = board
    .map((text, index) => ({ text, index }))
    .filter(({ index }) => index !== freeSpaceIndex && !wagered.includes(index) && !marked.includes(index));

  const openSlots = 5 - (wagered.length - toRemove.length);

  function toggleRemove(index) {
    setToRemove((prev) => {
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      const nextOpenSlots = 5 - (wagered.length - next.length);
      setToAdd((prevAdd) => prevAdd.slice(0, Math.max(0, nextOpenSlots)));
      return next;
    });
  }

  function toggleAdd(index) {
    setToAdd((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= openSlots) return prev;
      return [...prev, index];
    });
  }

  const hasChanges = toRemove.length > 0 || toAdd.length > 0;

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Manage Your Wagers</h3>
        <p className="hint">
          Remove and/or add wagered spaces below, then submit — all your changes go out together as a single proposal
          for the group to approve.
        </p>
        <h4>Your current wagers</h4>
        {currentWagers.length === 0 ? (
          <p className="hint">You have no wagers yet.</p>
        ) : (
          <ul className="challenge-list">
            {currentWagers.map(({ text, index }) => (
              <li key={index}>
                <button
                  className={`btn challenge-item${toRemove.includes(index) ? ' selected' : ''}`}
                  onClick={() => toggleRemove(index)}
                >
                  {toRemove.includes(index) ? '🗑️ ' : '✅ '}
                  {text}
                </button>
              </li>
            ))}
          </ul>
        )}
        <h4>
          Add new wager(s) ({openSlots} open slot{openSlots === 1 ? '' : 's'})
        </h4>
        {eligibleToAdd.length === 0 ? (
          <p className="hint">No open spaces left to wager on.</p>
        ) : (
          <ul className="challenge-list">
            {eligibleToAdd.map(({ text, index }) => (
              <li key={index}>
                <button
                  className={`btn challenge-item${toAdd.includes(index) ? ' selected' : ''}`}
                  disabled={!toAdd.includes(index) && toAdd.length >= openSlots}
                  onClick={() => toggleAdd(index)}
                >
                  {toAdd.includes(index) ? '☑ ' : '☐ '}
                  {text}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" disabled={!hasChanges} onClick={() => onSubmit(toAdd, toRemove)}>
            Submit for approval
          </button>
          <button className="btn" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
