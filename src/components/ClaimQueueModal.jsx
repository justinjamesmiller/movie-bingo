import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function ClaimQueueModal({ queue, players, myId, onWithdraw, onBrowse, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>Claim Queue ({queue.length})</h3>
        <button className="btn" onClick={onBrowse}>
          Browse tropes to propose
        </button>
        <div className="modal-scroll-area">
          {!queue.length ? (
            <p className="hint">No proposals are waiting.</p>
          ) : (
            <ol className="claim-queue-list">
              {queue.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.text}</strong>
                  <p className="hint">
                    {entry.kind === 'replace' ? 'Swap' : entry.kind === 'unmark' ? 'Undo' : 'Mark'} ·{' '}
                    {entry.proposedBy
                      .map((id) => formatPlayerName(players.find((player) => player.id === id)))
                      .join(', ')}
                  </p>
                  {entry.sceneContexts?.map((context) => (
                    <p className="hint" key={context.playerId}>
                      {context.timestamp && `${context.timestamp} · `}
                      {context.note}
                    </p>
                  ))}
                  {entry.proposedBy.includes(myId) && (
                    <button className="btn disagree" onClick={() => onWithdraw(entry.id)}>
                      Withdraw my proposal
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
