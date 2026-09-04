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
      <div className="modal-content list-modal">
        <h3>Accepted Tropes</h3>
        <div className="modal-scroll-area">
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
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
