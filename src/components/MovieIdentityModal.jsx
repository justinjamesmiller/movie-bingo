import { useState } from 'react';
import { getMovieDetails, isMovieLookupAvailable, searchMovies } from '../net/movieLookup.js';
import { getSuggestedSubgenres } from '../net/wikidataLookup.js';
import ErrorModal from './ErrorModal.jsx';
import ModalShell from './ModalShell.jsx';

export default function MovieIdentityModal({ currentMovie, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualTitle, setManualTitle] = useState(currentMovie?.title || '');

  async function handleSearch() {
    setBusy(true);
    setError('');
    try {
      setResults(await searchMovies(query));
    } catch (err) {
      setError(err.message || 'Could not find that title.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePick(imdbID) {
    setBusy(true);
    setError('');
    try {
      const details = await getMovieDetails(imdbID);
      const subgenreSelections = (await getSuggestedSubgenres(imdbID)).filter((selection) =>
        details.genres.includes(selection.genre),
      );
      onConfirm({
        title: details.title,
        year: details.year,
        type: details.type,
        poster: details.poster,
        genres: details.genres,
        subgenreSelections,
      });
    } catch (err) {
      setError(err.message || 'Could not load that title.');
    } finally {
      setBusy(false);
    }
  }

  function handleManualConfirm() {
    const title = manualTitle.trim();
    if (title) onConfirm({ title, poster: null });
  }

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content movie-identity-modal">
        <h3>Set movie or TV show</h3>
        <p className="hint">Search IMDb for a poster, or enter a title manually without selecting a result.</p>
        {isMovieLookupAvailable() && (
          <>
            <label htmlFor="movie-identity-search">Search IMDb</label>
            <div className="movie-lookup-row">
              <input
                id="movie-identity-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. The Shining"
              />
              <button className="btn" disabled={busy || !query.trim()} onClick={handleSearch}>
                {busy ? 'Searching…' : 'Search'}
              </button>
            </div>
            {results && (
              <ul className="movie-result-list">
                {results.map((result) => (
                  <li key={result.imdbID}>
                    <button className="movie-result-item" disabled={busy} onClick={() => handlePick(result.imdbID)}>
                      {result.poster ? (
                        <img src={result.poster} alt="" className="movie-result-poster" />
                      ) : (
                        <span className="movie-result-poster movie-result-poster-placeholder">🎬</span>
                      )}
                      <span className="movie-result-info">
                        <span className="movie-result-title">{result.title}</span>
                        <span className="movie-result-year">{result.year}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <label htmlFor="manual-movie-title">Manual title</label>
        <input
          id="manual-movie-title"
          value={manualTitle}
          onChange={(event) => setManualTitle(event.target.value)}
          placeholder="Movie or TV show title"
        />
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn agree" disabled={!manualTitle.trim()} onClick={handleManualConfirm}>
            Use manual title
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <ErrorModal message={error} onClose={() => setError('')} />
      </div>
    </ModalShell>
  );
}
