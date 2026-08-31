export default function PlayersPanel({ players, hostId, wagerCount, maxWagers }) {
  return (
    <aside className="players-panel">
      <h3>Players</h3>
      <ul className="players-list">
        {players.map((p) => (
          <li key={p.id}>
            <span>{p.name}{!p.connected ? ' (disconnected)' : ''}</span>
            <span>
              {p.id === hostId && <span className="tag">HOST</span>}
              {' '}
              {p.wagerLocked && <span className="tag">READY</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        Pick 5 spaces to <strong>wager</strong> — you think these
        tropes are extra likely to happen. Wagers lock once the game starts.
      </p>
      <p className="hint">Wagered: {wagerCount} / {maxWagers}</p>
    </aside>
  );
}
