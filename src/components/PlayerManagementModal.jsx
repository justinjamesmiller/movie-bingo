import { useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function PlayerManagementModal({
  player,
  isHost,
  isSelf = false,
  canRestoreBoard = false,
  recoverablePlayers = [],
  onRequestBoardRecovery,
  onAddHost,
  onProposeProfile,
  onEditProfile,
  onViewStats,
  onBadgeProgress,
  onCancel,
}) {
  const [sourceId, setSourceId] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const source = recoverablePlayers.find((candidate) => candidate.id === sourceId);
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
          {isSelf && onBadgeProgress && (
            <button className="btn" onClick={onBadgeProgress}>
              Badge Progress
            </button>
          )}
          <button className="btn" onClick={isSelf ? onEditProfile : onProposeProfile}>
            {isSelf ? '✏️ Edit Name & Avatar' : 'Propose Name & Avatar'}
          </button>
          {canRestoreBoard && onRequestBoardRecovery && recoverablePlayers.length > 0 && (
            <div className="restore-board-control">
              {confirmRecovery && source ? (
                <>
                  <h4>Recover {formatPlayerName(source)}?</h4>
                  <p className="hint">
                    {formatPlayerName(player)} will receive this player's name, avatar, board, wagers, and progress.
                    Their current progress will be replaced, and the old seat will be removed.
                  </p>
                  <p className="hint">
                    {timeoutSeconds === 0
                      ? 'No prompt will be sent. The old session will be removed immediately.'
                      : `The old player has ${timeoutSeconds === 300 ? '5 minutes' : `${timeoutSeconds} seconds`} to confirm they are still playing. Board-changing proposals pause during this check.`}
                  </p>
                  <button className="btn disagree" onClick={() => onRequestBoardRecovery(sourceId, timeoutSeconds)}>
                    {timeoutSeconds === 0 ? 'Recover immediately' : 'Send recovery prompt'}
                  </button>
                  <button className="btn" onClick={() => setConfirmRecovery(false)}>
                    Back
                  </button>
                </>
              ) : (
                <>
                  <label htmlFor="recover-player-from">Recover player from</label>
                  <select
                    id="recover-player-from"
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                  >
                    <option value="">Choose old player seat</option>
                    {recoverablePlayers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {formatPlayerName(candidate)}
                        {candidate.connected ? '' : ' (disconnected)'}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="recovery-response-time">Response time</label>
                  <select
                    id="recovery-response-time"
                    value={timeoutSeconds}
                    onChange={(event) => setTimeoutSeconds(Number(event.target.value))}
                  >
                    <option value={0}>Immediate</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={300}>5 minutes</option>
                  </select>
                  <button className="btn" disabled={!source} onClick={() => setConfirmRecovery(true)}>
                    Recover player
                  </button>
                </>
              )}
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
