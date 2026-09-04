import { useState } from 'react';
import { AVATAR_OPTIONS } from '../data/avatars.js';
import ModalShell from './ModalShell.jsx';

export default function ChangeNameModal({
  currentName,
  currentAvatar,
  onConfirm,
  onCancel,
  title = 'Change your name & avatar',
  confirmLabel = 'Save',
}) {
  const [name, setName] = useState(currentName || '');
  const [avatar, setAvatar] = useState(currentAvatar || AVATAR_OPTIONS[0]);
  const trimmed = name.trim();

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>{title}</h3>
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
          <button className="btn agree" disabled={!trimmed} onClick={() => onConfirm(trimmed, avatar)}>
            {confirmLabel}
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
