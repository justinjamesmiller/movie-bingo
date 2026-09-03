import ModalShell from './ModalShell.jsx';

function TropeItem({ text, onSelect }) {
  return (
    <button className="btn challenge-item" onClick={() => onSelect(text)}>
      {text}
    </button>
  );
}

export default function AcceptedTropesModal({ acceptedTropes, onTropeClick, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>Accepted Tropes</h3>
        {acceptedTropes.length === 0 ? (
          <p className="hint">No tropes have been accepted yet.</p>
        ) : (
          <>
            <p className="hint">Click a trope to read what it means, challenge it, or propose replacing it.</p>
            <ul className="challenge-list">
              {acceptedTropes.map((text) => (
                <li key={text}>
                  <TropeItem text={text} onSelect={onTropeClick} />
                </li>
              ))}
            </ul>
          </>
        )}
        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
