import { useState } from 'react';
import { SUBGENRES } from '../data/tropes.js';

export default function ResetModal({ currentSubgenre, onConfirm, onCancel }) {
  const [subgenre, setSubgenre] = useState(currentSubgenre || SUBGENRES[0].id);

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Reset the game?</h3>
        <p className="hint">
          This deals fresh boards and clears all marks and wagers for every player.
        </p>
        <label htmlFor="reset-subgenre">Sub-genre</label>
        <select id="reset-subgenre" value={subgenre} onChange={(e) => setSubgenre(e.target.value)}>
          {SUBGENRES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn disagree" onClick={() => onConfirm(subgenre)}>Reset Game</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
