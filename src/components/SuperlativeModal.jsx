import ModalShell from './ModalShell.jsx';

export default function SuperlativeModal({ award, playerName, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content superlative-modal">
        <span className="superlative-modal-kicker">PLAYER DISTINCTION</span>
        <h3>{award.name}</h3>
        <p className="superlative-player">{playerName}</p>
        <p className="hint">{award.description}</p>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
