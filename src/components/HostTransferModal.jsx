import ModalShell from './ModalShell.jsx';

export default function HostTransferModal({ players, onAssign, onLeaveWithoutAssign, onCancel }) {
  const assigningOnly = !onLeaveWithoutAssign;

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>{assigningOnly ? 'Add a Host' : 'Assign a New Host'}</h3>
        <p className="hint">
          Choose who should also host{assigningOnly ? '.' : ' before you leave.'} They will manage the game from here.
        </p>
        <ul className="challenge-list">
          {players.map((player) => (
            <li key={player.id}>
              <button className="btn challenge-item" onClick={() => onAssign(player.id)}>
                {player.avatar ? `${player.avatar} ` : ''}
                {player.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="claim-vote-buttons cancel-claim-btn">
          {!assigningOnly && (
            <button className="btn disagree" onClick={onLeaveWithoutAssign}>
              Leave Without Assigning
            </button>
          )}
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
