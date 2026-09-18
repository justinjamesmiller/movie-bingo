import { useState } from 'react';
import { GENRES, DEFAULT_GENERAL_PERCENT, TOTAL_TROPES_OPTIONS, DEFAULT_TOTAL_TROPES } from '../data/tropes.js';
import MovieLookup from './MovieLookup.jsx';
import GenreSubgenrePicker from './GenreSubgenrePicker.jsx';
import GeneralPercentSliders from './GeneralPercentSliders.jsx';
import CustomTropesEditor from './CustomTropesEditor.jsx';
import { balancedRatios } from '../utils/ratios.js';
import ModalShell from './ModalShell.jsx';

export default function ResetModal({
  currentGenres,
  currentSubgenreSelections,
  currentFreeSpace,
  currentGeneralPercents,
  currentGenrePercents,
  currentSubgenrePercents,
  currentTotalTropes,
  onConfirm,
  onCancel,
}) {
  const [genres, setGenres] = useState(currentGenres?.length ? currentGenres : [GENRES[0].id]);
  const [subgenreSelections, setSubgenreSelections] = useState(currentSubgenreSelections || []);
  const [freeSpace, setFreeSpace] = useState(!!currentFreeSpace);
  const [generalPercents, setGeneralPercents] = useState(
    currentGeneralPercents || { [GENRES[0].id]: DEFAULT_GENERAL_PERCENT },
  );
  const [genrePercents, setGenrePercents] = useState(
    currentGenrePercents || balancedRatios(currentGenres?.length ? currentGenres : [GENRES[0].id]),
  );
  const [subgenrePercents, setSubgenrePercents] = useState(currentSubgenrePercents || {});
  const [totalTropes, setTotalTropes] = useState(currentTotalTropes ?? DEFAULT_TOTAL_TROPES);
  const [customTropes, setCustomTropes] = useState([]);
  const [movie, setMovie] = useState(null);

  function ensurePercentsFor(nextGenres) {
    setGeneralPercents((prev) => {
      const next = { ...prev };
      for (const g of nextGenres) if (!(g in next)) next[g] = DEFAULT_GENERAL_PERCENT;
      return next;
    });
  }

  function handleMovieFound(foundGenres, foundSubgenreSelections) {
    const safeGenres = foundGenres.length ? foundGenres : [GENRES[0].id];
    setGenres(safeGenres);
    setSubgenreSelections(foundSubgenreSelections || []);
    ensurePercentsFor(safeGenres);
    setGenrePercents(balancedRatios(safeGenres));
  }

  function handleGenreSubgenreChange(nextGenres, nextSelections) {
    setGenres(nextGenres);
    setSubgenreSelections(nextSelections);
    ensurePercentsFor(nextGenres);
    setGenrePercents(balancedRatios(nextGenres));
    setSubgenrePercents(() => {
      const next = {};
      for (const genre of nextGenres) {
        const keys = ['general', ...nextSelections.filter((s) => s.genre === genre).map((s) => s.subgenre)];
        next[genre] = balancedRatios(keys);
      }
      return next;
    });
  }

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>Reset the game?</h3>
        <p className="hint">This deals fresh boards and clears all marks and wagers for every player.</p>
        <MovieLookup onFound={handleMovieFound} onMovieSelected={setMovie} />
        <GenreSubgenrePicker
          genres={genres}
          subgenreSelections={subgenreSelections}
          onChange={handleGenreSubgenreChange}
        />
        <label className="checkbox-label">
          <input type="checkbox" checked={freeSpace} onChange={(e) => setFreeSpace(e.target.checked)} />
          Free center space
        </label>
        <GeneralPercentSliders
          genres={genres}
          subgenreSelections={subgenreSelections}
          genrePercents={genrePercents}
          subgenrePercents={subgenrePercents}
          onChange={(nextGenres, nextSubgenres) => {
            setGenrePercents(nextGenres);
            setSubgenrePercents(nextSubgenres);
          }}
        />
        <label htmlFor="reset-total-tropes">Total unique tropes in play</label>
        <select id="reset-total-tropes" value={totalTropes} onChange={(e) => setTotalTropes(Number(e.target.value))}>
          {TOTAL_TROPES_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <CustomTropesEditor customTropes={customTropes} onChange={setCustomTropes} />
        <div className="claim-vote-buttons cancel-claim-btn">
          <button
            className="btn disagree"
            onClick={() =>
              onConfirm(
                genres,
                subgenreSelections,
                freeSpace,
                generalPercents,
                totalTropes,
                customTropes,
                genrePercents,
                subgenrePercents,
                movie,
              )
            }
          >
            Reset Game
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
