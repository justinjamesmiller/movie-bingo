import { useState } from 'react';
import { isMovieLookupAvailable, lookupMovie } from '../net/movieLookup.js';

export default function MovieLookup({ onFound }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!isMovieLookupAvailable()) return null;

  async function handleSearch() {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const found = await lookupMovie(query);
      setResult(found);
      onFound(found.genres);
    } catch (err) {
      setError(err.message || 'Could not find that movie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="movie-lookup">
      <label htmlFor="movie-search">Look up a movie (via IMDb)</label>
      <div className="movie-lookup-row">
        <input
          id="movie-search"
          type="text"
          placeholder="e.g. Your Monster"
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
      {result && (
        <p className="hint">
          Found "{result.title}" ({result.year}) — genres applied: {result.genres.length ? result.genres.join(', ') : 'none matched'}.
          {result.unmapped.length > 0 && ` Not supported yet: ${result.unmapped.join(', ')}.`}
          {' '}Sub-genres aren't in IMDb data, so each genre defaults to "general" — pick specific ones below if you want.
        </p>
      )}
    </div>
  );
}
