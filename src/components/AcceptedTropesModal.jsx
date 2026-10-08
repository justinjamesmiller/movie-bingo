import ModalShell from './ModalShell.jsx';
import { useState } from 'react';
import TropeListControls, { filterTropeTexts } from './TropeListControls.jsx';

function TropeItem({ text, onSelect }) {
  return (
    <button className="btn challenge-item" onClick={() => onSelect(text)}>
      {text}
    </button>
  );
}

export default function AcceptedTropesModal({
  acceptedTropes,
  onTropeClick,
  onClose,
  board = [],
  wageredTexts = [],
  calledTexts = [],
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const visible = filterTropeTexts(acceptedTropes, { query, filter, acceptedTropes, board, wageredTexts, calledTexts });
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>Accepted Tropes</h3>
        <div className="modal-scroll-area">
          {acceptedTropes.length === 0 ? (
            <p className="hint">No tropes have been accepted yet.</p>
          ) : (
            <>
              <TropeListControls query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} acceptedOnly />
              <p className="hint" role="status">
                {visible.length} / {acceptedTropes.length} tropes
              </p>
              {!visible.length && <p className="hint">No tropes match this search.</p>}
              <p className="hint">Click a trope to read what it means, challenge it, or propose replacing it.</p>
              <ul className="challenge-list">
                {visible.map((text) => (
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
