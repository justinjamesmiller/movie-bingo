import { useState } from 'react';
import { SUBGENRES, GENERAL_PERCENT_OPTIONS, DEFAULT_GENERAL_PERCENT } from '../data/tropes.js';

export default function ResetModal({ currentSubgenre, currentFreeSpace, currentGeneralPercent, onConfirm, onCancel }) {
  const [subgenre, setSubgenre] = useState(currentSubgenre || SUBGENRES[0].id);
  const [freeSpace, setFreeSpace] = useState(!!currentFreeSpace);
  const [generalPercent, setGeneralPercent] = useState(currentGeneralPercent ?? DEFAULT_GENERAL_PERCENT);

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
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={freeSpace}
            onChange={(e) => setFreeSpace(e.target.checked)}
          />
          Free center space
        </label>
        <label htmlFor="reset-general-percent">General tropes: {generalPercent}%</label>
        <input
          id="reset-general-percent"
          type="range"
          min={0}
          max={100}
          step={10}
          list="reset-general-percent-ticks"
          value={generalPercent}
          onChange={(e) => setGeneralPercent(Number(e.target.value))}
        />
        <datalist id="reset-general-percent-ticks">
          {GENERAL_PERCENT_OPTIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn disagree" onClick={() => onConfirm(subgenre, freeSpace, generalPercent)}>Reset Game</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
