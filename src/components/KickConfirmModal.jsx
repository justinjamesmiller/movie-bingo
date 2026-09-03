import ModalShell from './ModalShell.jsx';

export default function KickConfirmModal({ playerName, onConfirm, onCancel }) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Remove {playerName} from the game?</h3>
        <p className="hint">
          This also rotates the game code as a security measure, in case the old code leaked. You won't need to
          reconnect, but anyone else who's disconnected will need the new code to get back in.
        </p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn disagree" onClick={onConfirm}>
            Remove Player
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
