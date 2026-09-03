import { useEffect, useState } from 'react';
import { GENRES, DEFAULT_GENERAL_PERCENT, TOTAL_TROPES_OPTIONS, DEFAULT_TOTAL_TROPES } from '../data/tropes.js';
import MovieLookup from './MovieLookup.jsx';
import GenreSubgenrePicker from './GenreSubgenrePicker.jsx';
import GeneralPercentSliders from './GeneralPercentSliders.jsx';
import CustomTropesEditor from './CustomTropesEditor.jsx';

export default function Landing({ onHost, onJoin, error, busy, savedSession, onRejoin }) {
  const [hostName, setHostName] = useState('');
  const [hostGenres, setHostGenres] = useState([GENRES[0].id]);
  const [hostSubgenreSelections, setHostSubgenreSelections] = useState([]);
  const [hostFreeSpace, setHostFreeSpace] = useState(false);
  const [hostGeneralPercents, setHostGeneralPercents] = useState({ [GENRES[0].id]: DEFAULT_GENERAL_PERCENT });
  const [hostTotalTropes, setHostTotalTropes] = useState(DEFAULT_TOTAL_TROPES);
  const [hostCustomTropes, setHostCustomTropes] = useState([]);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    return fromUrl ? fromUrl.trim().toUpperCase().slice(0, 4) : '';
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  function ensurePercentsFor(genres) {
    setHostGeneralPercents((prev) => {
      const next = { ...prev };
      for (const g of genres) if (!(g in next)) next[g] = DEFAULT_GENERAL_PERCENT;
      return next;
    });
  }

  function handleMovieFound(genres, subgenreSelections) {
    const safeGenres = genres.length ? genres : [GENRES[0].id];
    setHostGenres(safeGenres);
    setHostSubgenreSelections(subgenreSelections || []);
    ensurePercentsFor(safeGenres);
  }

  function handleGenreSubgenreChange(genres, selections) {
    setHostGenres(genres);
    setHostSubgenreSelections(selections);
    ensurePercentsFor(genres);
  }

  function handleHostClick() {
    const name = hostName.trim();
    if (!name) {
      setLocalError('Please enter your name.');
      return;
    }
    setLocalError('');
    onHost(
      name,
      hostGenres,
      hostSubgenreSelections,
      hostFreeSpace,
      hostGeneralPercents,
      hostTotalTropes,
      hostCustomTropes,
    );
  }

  function handleJoinClick() {
    const name = joinName.trim();
    if (!name) {
      setLocalError('Please enter your name.');
      return;
    }
    setLocalError('');
    onJoin(name, joinCode);
  }

  return (
    <section className="screen-landing">
      {savedSession && (
        <div className="card rejoin-card">
          <h2>Reconnect</h2>
          <p className="hint">
            You were previously in game <strong>{savedSession.code}</strong> as {savedSession.name}. If you got
            disconnected (e.g. as the host), you can reconnect to the same seat.
          </p>
          <button className="btn primary" disabled={busy} onClick={onRejoin}>
            Reconnect to {savedSession.code}
          </button>
        </div>
      )}
      <div className="card">
        <h2>Join a Game</h2>
        <label htmlFor="join-name">Your name</label>
        <input
          id="join-name"
          type="text"
          maxLength={20}
          placeholder="e.g. Sidney"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />
        <label htmlFor="join-code">Game code</label>
        <input
          id="join-code"
          type="text"
          maxLength={4}
          placeholder="ABCD"
          className="code-input"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
        />
        <button className="btn primary" disabled={busy} onClick={handleJoinClick}>
          Join Game
        </button>
      </div>
      <div className="card">
        <h2>Host a New Game</h2>
        <label htmlFor="host-name">Your name</label>
        <input
          id="host-name"
          type="text"
          maxLength={20}
          placeholder="e.g. Ashley"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
        <MovieLookup onFound={handleMovieFound} />
        <GenreSubgenrePicker
          genres={hostGenres}
          subgenreSelections={hostSubgenreSelections}
          onChange={handleGenreSubgenreChange}
        />
        <label className="checkbox-label">
          <input type="checkbox" checked={hostFreeSpace} onChange={(e) => setHostFreeSpace(e.target.checked)} />
          Free center space
        </label>
        <GeneralPercentSliders
          genres={hostGenres}
          subgenreSelections={hostSubgenreSelections}
          generalPercents={hostGeneralPercents}
          onChange={(genreId, value) => setHostGeneralPercents((prev) => ({ ...prev, [genreId]: value }))}
        />
        <label htmlFor="host-total-tropes">Total unique tropes in play</label>
        <select
          id="host-total-tropes"
          value={hostTotalTropes}
          onChange={(e) => setHostTotalTropes(Number(e.target.value))}
        >
          {TOTAL_TROPES_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <CustomTropesEditor customTropes={hostCustomTropes} onChange={setHostCustomTropes} />
        <button className="btn primary" disabled={busy} onClick={handleHostClick}>
          Host Game
        </button>
      </div>
      {(localError || error) && <p className="error-text">{localError || error}</p>}
    </section>
  );
}
