import { useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function PlayerManagementModal({
  player,
  isHost,
  isSelf = false,
  canRestoreBoard = false,
  disconnectedPlayers = [],
  onAddHost,
  onRestoreBoard,
  onProposeProfile,
  onEditProfile,
  onViewStats,
  onCancel,
}) {
  const [sourceId, setSourceId] = useState('');
  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>
          {isSelf ? 'Options for' : 'Manage'} {formatPlayerName(player)}
        </h3>
        <div className="claim-vote-buttons cancel-claim-btn player-options-actions">
          {!isSelf && !isHost && (
            <button className="btn agree" onClick={onAddHost}>
              👑 Add Host
            </button>
          )}
          <button className="btn" onClick={onViewStats}>
            📊 View Stats
          </button>
          <button className="btn" onClick={isSelf ? onEditProfile : onProposeProfile}>
            {isSelf ? '✏️ Edit Name & Avatar' : 'Propose Name & Avatar'}
          </button>
          {canRestoreBoard && disconnectedPlayers.length > 0 && (
            <div className="restore-board-control">
              <label htmlFor="restore-disconnected-board">Restore board from</label>
              <select
                id="restore-disconnected-board"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
              >
                <option value="">Choose disconnected player</option>
                {disconnectedPlayers.map((disconnected) => (
                  <option key={disconnected.id} value={disconnected.id}>
                    {formatPlayerName(disconnected)}
                  </option>
                ))}
              </select>
              <button className="btn" disabled={!sourceId} onClick={() => onRestoreBoard(sourceId)}>
                Restore board and remove old seat
              </button>
            </div>
          )}
          <button className="btn disagree" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
