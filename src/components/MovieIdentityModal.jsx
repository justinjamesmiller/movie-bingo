import { useState } from 'react';
import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';
import { getMovieDetails, isMovieLookupAvailable, searchMovies } from '../net/movieLookup.js';
import { getSuggestedSubgenres } from '../net/wikidataLookup.js';
import ErrorModal from './ErrorModal.jsx';
import ModalShell from './ModalShell.jsx';

export default function MovieIdentityModal({ currentMovie, onConfirm, onCancel, readOnly = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [failedPoster, setFailedPoster] = useState(null);
  const identity = [
    currentMovie?.year,
    currentMovie?.type === 'series' ? 'TV Show' : currentMovie?.type === 'movie' ? 'Movie' : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
      onConfirm({ ...details, imdbID, subgenreSelections });
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
        <h3>{readOnly ? 'Movie or TV show' : 'Set movie or TV show'}</h3>
        {currentMovie?.title && (
          <div className="movie-selected">
            <div className="movie-selected-row">
              {currentMovie.poster && failedPoster !== currentMovie.poster ? (
                <img
                  src={currentMovie.poster}
                  alt={`${currentMovie.title} poster`}
                  className="movie-result-poster"
                  onError={() => setFailedPoster(currentMovie.poster)}
                />
              ) : (
                <span className="movie-result-poster movie-result-poster-placeholder" aria-hidden="true">
                  {currentMovie.type === 'series' ? '📺' : '🎬'}
                </span>
              )}
              <div className="movie-current-info">
                <h4>{currentMovie.title}</h4>
                {identity && <p className="hint">{identity}</p>}
                {currentMovie.director && <p className="hint">Directed by {currentMovie.director}</p>}
                {currentMovie.actors && <p className="hint">Starring {currentMovie.actors}</p>}
                {currentMovie.genres?.length > 0 && (
                  <p className="hint">
                    Genres:{' '}
                    {currentMovie.genres
                      .map((genre) => GENRES.find((entry) => entry.id === genre)?.label || genre)
                      .join(', ')}
                  </p>
                )}
                {currentMovie.unmapped?.length > 0 && (
                  <p className="hint">Other genres: {currentMovie.unmapped.join(', ')}</p>
                )}
                {currentMovie.subgenreSelections?.length > 0 && (
                  <p className="hint">
                    Suggested sub-genres:{' '}
                    {currentMovie.subgenreSelections
                      .map(
                        (selection) =>
                          SUBGENRES_BY_GENRE[selection.genre]?.find((subgenre) => subgenre.id === selection.subgenre)
                            ?.label || selection.subgenre,
                      )
                      .join(', ')}
                  </p>
                )}
                {/^tt\d+$/.test(currentMovie.imdbID || '') && (
                  <a
                    href={`https://www.imdb.com/title/${currentMovie.imdbID}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on IMDb
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        {!readOnly && (
          <p className="hint">Search IMDb for a poster, or enter a title manually without selecting a result.</p>
        )}
        {!readOnly && isMovieLookupAvailable() && (
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
        {!readOnly && (
          <>
            <label htmlFor="manual-movie-title">Manual title</label>
            <input
              id="manual-movie-title"
              type="text"
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Movie or TV show title"
            />
          </>
        )}
        <div className="claim-vote-buttons cancel-claim-btn">
          {!readOnly && (
            <button className="btn agree" disabled={busy || !manualTitle.trim()} onClick={handleManualConfirm}>
              Use manual title
            </button>
          )}
          <button className="btn" onClick={onCancel}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
        </div>
        <ErrorModal message={error} onClose={() => setError('')} />
      </div>
    </ModalShell>
  );
}
