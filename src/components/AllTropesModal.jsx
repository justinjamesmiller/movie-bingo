import ModalShell from './ModalShell.jsx';
import { useState } from 'react';
import TropeListControls, { filterTropeTexts } from './TropeListControls.jsx';

function TropeItem({ text, accepted, onSelect }) {
  return (
    <button className={`btn challenge-item${accepted ? ' accepted' : ''}`} onClick={() => onSelect(text, accepted)}>
      {text}
    </button>
  );
}

export default function AllTropesModal({
  tropePool,
  acceptedTropes,
  onTropeClick,
  onClose,
  board = [],
  wageredTexts = [],
  calledTexts = [],
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const sorted = [...tropePool].sort((a, b) => a.localeCompare(b));
  const visible = filterTropeTexts(sorted, { query, filter, acceptedTropes, board, wageredTexts, calledTexts });

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>All Tropes ({sorted.length})</h3>
        <p className="hint">
          Click a trope to read what it means, propose it happened, challenge it if accepted, or propose replacing it.
        </p>
        <div className="modal-scroll-area">
          <TropeListControls query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} />
          <p className="hint" role="status">
            {visible.length} / {sorted.length} tropes
          </p>
          {!visible.length && <p className="hint">No tropes match this search.</p>}
          <ul className="challenge-list">
            {visible.map((text) => (
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
