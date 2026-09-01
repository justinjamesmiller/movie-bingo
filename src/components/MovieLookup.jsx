import { useState } from 'react';
import { isMovieLookupAvailable, searchMovies, getMovieDetails } from '../net/movieLookup.js';
import { getSuggestedSubgenres } from '../net/wikidataLookup.js';
import { SUBGENRES_BY_GENRE } from '../data/tropes.js';

export default function MovieLookup({ onFound }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [suggestedSubgenres, setSuggestedSubgenres] = useState([]);
  const [error, setError] = useState('');

  if (!isMovieLookupAvailable()) return null;

  async function handleSearch() {
    setError('');
    setResults(null);
    setSelected(null);
    setBusy(true);
    try {
      const found = await searchMovies(query);
      setResults(found);
    } catch (err) {
      setError(err.message || 'Could not find that title.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePick(imdbID) {
    setError('');
    setBusy(true);
    try {
      const details = await getMovieDetails(imdbID);
      const subgenres = (await getSuggestedSubgenres(imdbID)).filter((s) => details.genres.includes(s.genre));
      setSelected(details);
      setSuggestedSubgenres(subgenres);
      setResults(null);
      onFound(details.genres, subgenres);
    } catch (err) {
      setError(err.message || 'Could not load that title.');
    } finally {
      setBusy(false);
    }
  }

  function handleSearchAgain() {
    setSelected(null);
    setSuggestedSubgenres([]);
    setResults(null);
    setError('');
  }

  return (
    <div className="movie-lookup">
      <label htmlFor="movie-search">Look up a movie or TV show (via IMDb)</label>
      <div className="movie-lookup-row">
        <input
          id="movie-search"
          type="text"
          placeholder="e.g. Spiral or Breaking Bad"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <button type="button" className="btn" disabled={busy || !query.trim()} onClick={handleSearch}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}

      {results && (
        <ul className="movie-result-list">
          {results.map((m) => (
            <li key={m.imdbID}>
              <button type="button" className="movie-result-item" disabled={busy} onClick={() => handlePick(m.imdbID)}>
                {m.poster ? (
                  <img src={m.poster} alt="" className="movie-result-poster" />
                ) : (
                  <span className="movie-result-poster movie-result-poster-placeholder">{m.type === 'series' ? '📺' : '🎬'}</span>
                )}
                <span className="movie-result-info">
                  <span className="movie-result-title">
                    {m.type === 'series' ? '📺' : '🎬'} {m.title}
                  </span>
                  <span className="movie-result-year">{m.year} · {m.type === 'series' ? 'TV Show' : 'Movie'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="movie-selected">
          <div className="movie-selected-row">
            {selected.poster && <img src={selected.poster} alt="" className="movie-result-poster" />}
            <p className="hint">
              Picked "{selected.title}" ({selected.year}, {selected.type === 'series' ? 'TV Show' : 'Movie'})
              {selected.director && ` — directed by ${selected.director}`}
              {selected.actors && `, starring ${selected.actors}`}.
              {' '}Genres applied: {selected.genres.length ? selected.genres.join(', ') : 'none matched'}.
              {selected.unmapped.length > 0 && ` Not supported yet: ${selected.unmapped.join(', ')}.`}
              {suggestedSubgenres.length > 0 ? (
                <>
                  {' '}Sub-genres suggested via Wikidata:{' '}
                  {suggestedSubgenres
                    .map((s) => (SUBGENRES_BY_GENRE[s.genre] || []).find((sg) => sg.id === s.subgenre)?.label || s.subgenre)
                    .join(', ')}
                  {' '}(already checked below — feel free to adjust).
                </>
              ) : (
                " No specific sub-genres recognized, so each genre defaults to 'general' — pick specific ones below if you want."
              )}
            </p>
          </div>
          <button type="button" className="btn" onClick={handleSearchAgain}>Search a different title</button>
        </div>
      )}
    </div>
  );
}
