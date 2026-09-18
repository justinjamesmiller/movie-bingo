import ModalShell from './ModalShell.jsx';

export default function TropeAdvancedActionsModal({ text, called, onToggleCall, onSwap, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content trope-actions-modal">
        <h3>Advanced Actions</h3>
        <p className="claim-text">{text}</p>
        <div className="trope-actions">
          <button className={`btn${called ? ' disagree' : ' primary'}`} onClick={onToggleCall}>
            {called ? '↩️ Uncall it' : '📣 Call it next'}
          </button>
          <button className="btn secondary-action" onClick={onSwap}>
            🔁 Propose swapping it out
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
