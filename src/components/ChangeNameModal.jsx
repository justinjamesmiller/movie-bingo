import { useState } from 'react';

export default function ChangeNameModal({ currentName, onConfirm, onCancel }) {
  const [name, setName] = useState(currentName || '');
  const trimmed = name.trim();

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Change your name</h3>
        <label htmlFor="change-name-input">New name</label>
        <input
          id="change-name-input"
          type="text"
          maxLength={20}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" disabled={!trimmed} onClick={() => onConfirm(trimmed)}>Save</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
