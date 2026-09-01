import { useState } from 'react';
import { AVATAR_OPTIONS } from '../data/avatars.js';

export default function ChangeNameModal({ currentName, currentAvatar, onConfirm, onCancel }) {
  const [name, setName] = useState(currentName || '');
  const [avatar, setAvatar] = useState(currentAvatar || AVATAR_OPTIONS[0]);
  const trimmed = name.trim();

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Change your name &amp; avatar</h3>
        <label htmlFor="change-name-input">New name</label>
        <input
          id="change-name-input"
          type="text"
          maxLength={20}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label>Avatar</label>
        <div className="avatar-grid">
          {AVATAR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`avatar-option${avatar === option ? ' selected' : ''}`}
              onClick={() => setAvatar(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" disabled={!trimmed} onClick={() => onConfirm(trimmed, avatar)}>Save</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
