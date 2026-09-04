import { useEffect, useState } from 'react';
import { GENRES, DEFAULT_GENERAL_PERCENT, TOTAL_TROPES_OPTIONS, DEFAULT_TOTAL_TROPES } from '../data/tropes.js';
import MovieLookup from './MovieLookup.jsx';
import GenreSubgenrePicker from './GenreSubgenrePicker.jsx';
import GeneralPercentSliders from './GeneralPercentSliders.jsx';
import CustomTropesEditor from './CustomTropesEditor.jsx';
import { balancedRatios } from '../utils/ratios.js';
import ModalShell from './ModalShell.jsx';

export default function Landing({ onHost, onJoin, error, busy, loadingMessage, savedSession, onRejoin }) {
  const [hostName, setHostName] = useState('');
  const [hostGenres, setHostGenres] = useState([GENRES[0].id]);
  const [hostSubgenreSelections, setHostSubgenreSelections] = useState([]);
  const [hostFreeSpace, setHostFreeSpace] = useState(false);
  const [hostGeneralPercents, setHostGeneralPercents] = useState({ [GENRES[0].id]: DEFAULT_GENERAL_PERCENT });
  const [hostGenrePercents, setHostGenrePercents] = useState(() => balancedRatios([GENRES[0].id]));
  const [hostSubgenrePercents, setHostSubgenrePercents] = useState({});
  const [customRatios, setCustomRatios] = useState(false);
  const [showSubgenres, setShowSubgenres] = useState(false);
  const [advancedSetup, setAdvancedSetup] = useState(false);
  const [hostTotalTropes, setHostTotalTropes] = useState(DEFAULT_TOTAL_TROPES);
  const [hostCustomTropes, setHostCustomTropes] = useState([]);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    return fromUrl ? fromUrl.trim().toUpperCase().slice(0, 4) : '';
  });
  const [localError, setLocalError] = useState('');
  const [hostSetupIssues, setHostSetupIssues] = useState(null);
  const [modalHostName, setModalHostName] = useState('');
  const [joinSetupIssues, setJoinSetupIssues] = useState(null);
  const [modalJoinName, setModalJoinName] = useState('');
  const [modalJoinCode, setModalJoinCode] = useState('');

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
    setHostGenrePercents(balancedRatios(safeGenres));
  }

  function handleGenreSubgenreChange(genres, selections) {
    setHostGenres(genres);
    setHostSubgenreSelections(selections);
    ensurePercentsFor(genres);
    setHostGenrePercents(balancedRatios(genres));
    setHostSubgenrePercents(() => {
      const next = {};
      for (const genre of genres) {
        const keys = ['general', ...selections.filter((s) => s.genre === genre).map((s) => s.subgenre)];
        next[genre] = balancedRatios(keys);
      }
      return next;
    });
  }

  function handleHostClick() {
    const name = hostName.trim();
    if (hostGenres.length === 0) {
      setHostSetupIssues({ missingName: false, missingGenres: true });
      return;
    }
    if (!name) {
      setModalHostName(hostName);
      setHostSetupIssues({ missingName: true, missingGenres: false });
      return;
    }
    const resolvedSubgenrePercents = { ...hostSubgenrePercents };
    for (const genre of hostGenres) {
      const keys = ['general', ...hostSubgenreSelections.filter((s) => s.genre === genre).map((s) => s.subgenre)];
      if (!resolvedSubgenrePercents[genre]) resolvedSubgenrePercents[genre] = balancedRatios(keys);
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
      hostGenrePercents,
      resolvedSubgenrePercents,
    );
  }

  function handleSaveModalName() {
    const name = modalHostName.trim();
    if (!name) return;
    setHostName(name);
    if (hostSetupIssues.missingGenres) {
      setHostSetupIssues({ missingName: false, missingGenres: true });
    } else {
      setHostSetupIssues(null);
    }
  }

  function handleJoinClick() {
    const name = joinName.trim();
    const normalizedCode = joinCode.trim().toUpperCase();
    const issues = { missingName: !name, missingCode: normalizedCode.length !== 4 };
    if (issues.missingName || issues.missingCode) {
      setModalJoinName(joinName);
      setModalJoinCode(joinCode);
      setJoinSetupIssues(issues);
      return;
    }
    setLocalError('');
    onJoin(name, normalizedCode);
  }

  function handleSubmitJoinSetup() {
    const name = modalJoinName.trim();
    const code = modalJoinCode.trim().toUpperCase();
    if (!name || code.length !== 4) return;
    setJoinName(name);
    setJoinCode(code);
    setJoinSetupIssues(null);
    setLocalError('');
    onJoin(name, code);
  }

  return (
    <section className="screen-landing">
      {busy && loadingMessage && (
        <div className="landing-loader" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          {loadingMessage}
        </div>
      )}
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
          showSubgenres={showSubgenres}
          allowEmptyGenres
        />
        <div className="host-setup-actions">
          <button className="btn" type="button" onClick={() => setShowSubgenres((shown) => !shown)}>
            {showSubgenres ? 'Hide Sub-genres' : 'Choose Sub-genres'}
          </button>
          <button className="btn" type="button" onClick={() => setAdvancedSetup((shown) => !shown)}>
            {advancedSetup ? 'Use Simple Host Setup' : 'Advanced Host Setup'}
          </button>
        </div>
        {advancedSetup && (
          <>
            <label className="checkbox-label">
              <input type="checkbox" checked={hostFreeSpace} onChange={(e) => setHostFreeSpace(e.target.checked)} />
              Free center space
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={customRatios}
                onChange={(event) => setCustomRatios(event.target.checked)}
              />
              Use custom genre and sub-genre ratios
            </label>
            {customRatios && (
              <GeneralPercentSliders
                genres={hostGenres}
                subgenreSelections={hostSubgenreSelections}
                genrePercents={hostGenrePercents}
                subgenrePercents={hostSubgenrePercents}
                onChange={(nextGenres, nextSubgenres) => {
                  setHostGenrePercents(nextGenres);
                  setHostSubgenrePercents(nextSubgenres);
                }}
              />
            )}
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
          </>
        )}
        <button className="btn primary" disabled={busy} onClick={handleHostClick}>
          Host Game
        </button>
      </div>
      {(localError || error) && <p className="error-text">{localError || error}</p>}
      {hostSetupIssues && (
        <ModalShell onClose={() => setHostSetupIssues(null)}>
          <div className="modal-content">
            <h3>Before You Host</h3>
            {hostSetupIssues.missingName && (
              <>
                <label htmlFor="modal-host-name">Host name</label>
                <input
                  id="modal-host-name"
                  type="text"
                  maxLength={20}
                  value={modalHostName}
                  onChange={(event) => setModalHostName(event.target.value)}
                />
              </>
            )}
            {hostSetupIssues.missingGenres && <p className="hint">Choose at least one genre before hosting a game.</p>}
            <div className="claim-vote-buttons cancel-claim-btn">
              {hostSetupIssues.missingName ? (
                <button className="btn agree" onClick={handleSaveModalName}>
                  Continue
                </button>
              ) : (
                <button className="btn" onClick={() => setHostSetupIssues(null)}>
                  Back to Setup
                </button>
              )}
            </div>
          </div>
        </ModalShell>
      )}
      {joinSetupIssues && (
        <ModalShell onClose={() => setJoinSetupIssues(null)}>
          <div className="modal-content">
            <h3>Before You Join</h3>
            {joinSetupIssues.missingName && (
              <>
                <label htmlFor="modal-join-name">Your name</label>
                <input
                  id="modal-join-name"
                  type="text"
                  maxLength={20}
                  value={modalJoinName}
                  onChange={(event) => setModalJoinName(event.target.value)}
                />
              </>
            )}
            {joinSetupIssues.missingCode && (
              <>
                <label htmlFor="modal-join-code">Game code</label>
                <input
                  id="modal-join-code"
                  type="text"
                  maxLength={4}
                  className="code-input"
                  value={modalJoinCode}
                  onChange={(event) => setModalJoinCode(event.target.value.toUpperCase().slice(0, 4))}
                />
              </>
            )}
            <div className="claim-vote-buttons cancel-claim-btn">
              <button className="btn agree" onClick={handleSubmitJoinSetup}>
                Join Game
              </button>
              <button className="btn" onClick={() => setJoinSetupIssues(null)}>
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  );
}
