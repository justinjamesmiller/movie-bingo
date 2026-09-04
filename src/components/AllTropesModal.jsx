import ModalShell from './ModalShell.jsx';

function TropeItem({ text, accepted, onSelect }) {
  return (
    <button className={`btn challenge-item${accepted ? ' accepted' : ''}`} onClick={() => onSelect(text, accepted)}>
      {text}
    </button>
  );
}

export default function AllTropesModal({ tropePool, acceptedTropes, onTropeClick, onClose }) {
  const sorted = [...tropePool].sort((a, b) => a.localeCompare(b));

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>All Tropes ({sorted.length})</h3>
        <p className="hint">
          Click a trope to read what it means, propose it happened, challenge it if accepted, or propose replacing it.
        </p>
        <div className="modal-scroll-area">
          <ul className="challenge-list">
            {sorted.map((text) => (
              <li key={text}>
                <TropeItem text={text} accepted={acceptedTropes.includes(text)} onSelect={onTropeClick} />
              </li>
            ))}
          </ul>
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
