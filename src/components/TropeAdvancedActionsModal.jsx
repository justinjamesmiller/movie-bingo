import ModalShell from './ModalShell.jsx';

export default function TropeAdvancedActionsModal({ text, called, onToggleCall, onSwap, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content trope-actions-modal">
        <header className="trope-info-header">
          <h3 className="trope-info-eyebrow">Advanced Actions</h3>
          <h4 className="trope-info-title">{text}</h4>
        </header>
        <div className="trope-actions">
          <button className={`btn${called ? ' disagree' : ' primary'}`} onClick={onToggleCall}>
            {called ? '↩️ Uncall it' : '📣 Call it next'}
          </button>
          <button className="btn secondary-action" onClick={onSwap}>
            🔁 Propose swapping it out
          </button>
        </div>
        <footer className="trope-modal-footer">
          <button className="btn trope-modal-dismiss" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}
