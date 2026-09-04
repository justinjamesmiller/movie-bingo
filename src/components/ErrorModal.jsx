import ModalShell from './ModalShell.jsx';

export default function ErrorModal({ message, onClose }) {
  if (!message) return null;

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>Something Went Wrong</h3>
        <p className="hint">{message}</p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
