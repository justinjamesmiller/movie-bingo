export default function PlayersPanel({ players, hostId, wagerCount, maxWagers }) {
  return (
    <aside className="players-panel">
      <h3>Players</h3>
      <ul className="players-list">
        {players.map((p) => {
          const wagerLocked = p.wagered.length === 5;
          const wageredMarked = p.wagered.filter((i) => p.marked.includes(i)).length;
          return (
            <li key={p.id}>
              <div className="player-row">
                <span>{p.name}{!p.connected ? ' (disconnected)' : ''}</span>
                <span>
                  {p.id === hostId && <span className="tag">HOST</span>}
                  {' '}
                  {wagerLocked && <span className="tag">READY</span>}
                </span>
              </div>
              <div className="hint player-stats">
                {p.marked.length} marked · {wageredMarked}/{p.wagered.length} wagered marked
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hint">
        Pick 5 spaces to <strong>wager</strong> — you think these
        tropes are extra likely to happen. Wagers lock once the game starts.
      </p>
      <p className="hint">Wagered: {wagerCount} / {maxWagers}</p>
    </aside>
  );
}
