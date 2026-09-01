import { useState } from 'react';
import { SUBGENRES, GENERAL_PERCENT_OPTIONS, DEFAULT_GENERAL_PERCENT } from '../data/tropes.js';

export default function Landing({ onHost, onJoin, error, busy }) {
  const [hostName, setHostName] = useState('');
  const [hostSubgenre, setHostSubgenre] = useState(SUBGENRES[0].id);
  const [hostFreeSpace, setHostFreeSpace] = useState(false);
  const [hostGeneralPercent, setHostGeneralPercent] = useState(DEFAULT_GENERAL_PERCENT);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [localError, setLocalError] = useState('');

  function handleHostClick() {
    const name = hostName.trim();
    if (!name) {
      setLocalError('Please enter your name.');
      return;
    }
    setLocalError('');
    onHost(name, hostSubgenre, hostFreeSpace, hostGeneralPercent);
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
        <label htmlFor="host-subgenre">Sub-genre</label>
        <select
          id="host-subgenre"
          value={hostSubgenre}
          onChange={(e) => setHostSubgenre(e.target.value)}
        >
          {SUBGENRES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hostFreeSpace}
            onChange={(e) => setHostFreeSpace(e.target.checked)}
          />
          Free center space
        </label>
        <label htmlFor="host-general-percent">General tropes: {hostGeneralPercent}%</label>
        <input
          id="host-general-percent"
          type="range"
          min={0}
          max={100}
          step={10}
          list="general-percent-ticks"
          value={hostGeneralPercent}
          onChange={(e) => setHostGeneralPercent(Number(e.target.value))}
        />
        <datalist id="general-percent-ticks">
          {GENERAL_PERCENT_OPTIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <button className="btn primary" disabled={busy} onClick={handleHostClick}>
          Host Game
        </button>
      </div>
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
      {(localError || error) && <p className="error-text">{localError || error}</p>}
    </section>
  );
}
