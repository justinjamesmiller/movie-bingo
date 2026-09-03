import { useState } from 'react';
import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';
import ModalShell from './ModalShell.jsx';

export default function ProposeReplaceModal({ text, defaultGenre, defaultSubgenre, onConfirm, onCancel }) {
  const [genre, setGenre] = useState(defaultGenre);
  const [subgenre, setSubgenre] = useState(defaultSubgenre);

  function handleGenreChange(newGenre) {
    setGenre(newGenre);
    setSubgenre(SUBGENRES_BY_GENRE[newGenre][0].id);
  }

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Propose swapping out this trope?</h3>
        <p className="claim-text">{text}</p>
        <p className="hint">The new trope can come from any genre/sub-genre in play -- not just this game's own.</p>
        <label htmlFor="replace-genre">New trope's genre</label>
        <select id="replace-genre" value={genre} onChange={(e) => handleGenreChange(e.target.value)}>
          {GENRES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <label htmlFor="replace-subgenre">New trope's sub-genre</label>
        <select id="replace-subgenre" value={subgenre} onChange={(e) => setSubgenre(e.target.value)}>
          {SUBGENRES_BY_GENRE[genre].map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="hint">This asks the group to vote on swapping it out for a new trope from that sub-genre.</p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" onClick={() => onConfirm(genre, subgenre)}>
            👍 Propose it
          </button>
          <button className="btn disagree" onClick={onCancel}>
            👎 Never mind
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
