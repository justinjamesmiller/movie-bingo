// Shown to a would-be joiner while the host decides whether to let them into
// an already-started game.
import ModalShell from './ModalShell.jsx';

export default function JoinPendingModal({ onCancel }) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>⏳ Waiting for the host</h3>
        <p className="hint">
          This game has already started, so the host needs to approve you joining mid-game. Hang tight — this will
          update automatically once they respond.
        </p>
        <button className="btn cancel-claim-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
