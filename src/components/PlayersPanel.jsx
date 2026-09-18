import SuperlativeBadge from './SuperlativeBadge.jsx';

export default function PlayersPanel({
  players,
  hostIds = [],
  myId,
  isHost,
  wagerCount,
  maxWagers,
  started,
  bingoCounts,
  onKick,
  onEditSelf,
  onManagePlayer,
  onViewPlayerStats,
  callStats = {},
  wageringEnabled,
  onOpenWagerIntro,
  superlatives = {},
  onSuperlativeClick,
}) {
  return (
    <aside className="players-panel">
      <h3>Players</h3>
      <ul className="players-list">
        {players.map((p) => {
          const wagerLocked = p.wagered.length === 5;
          const wageredMarked = p.wagered.filter((i) => p.marked.includes(i)).length;
          const calls = callStats[p.id] || {};
          return (
            <li key={p.id}>
              <div className="player-row">
                {p.id === myId ? (
                  <button className="player-profile-button" onClick={onEditSelf} aria-label="Edit name and avatar">
                    {p.avatar ? `${p.avatar} ` : ''}
                    {p.name}
                    {!p.connected ? ' (disconnected)' : ''}
                  </button>
                ) : isHost ? (
                  <button className="player-profile-button" onClick={() => isHost && onManagePlayer(p)}>
                    {p.avatar ? `${p.avatar} ` : ''}
                    {p.name}
                    {!p.connected ? ' (disconnected)' : ''}
                  </button>
                ) : (
                  <button className="player-profile-button" onClick={() => onViewPlayerStats?.(p)}>
                    {p.avatar ? `${p.avatar} ` : ''}
                    {p.name}
                    {!p.connected ? ' (disconnected)' : ''}
                  </button>
                )}
                <span>
                  {hostIds.includes(p.id) && <span className="tag">HOST</span>}{' '}
                  {wagerLocked && <span className="tag">READY</span>}
                  {isHost && p.id !== myId && (
                    <button className="btn disagree kick-btn" onClick={() => onKick(p.id, p.name)}>
                      Remove
                    </button>
                  )}
                </span>
              </div>
              <div className="hint player-stats">
                {p.marked.length} marked · {bingoCounts[p.id] || 0} bingo{(bingoCounts[p.id] || 0) === 1 ? '' : 's'}
                {p.wagered.length > 0 && ` · ${wageredMarked}/${p.wagered.length} wagered marked`}
                {calls.made > 0 && ` · 📣 ${calls.correct || 0}/${calls.made} calls`}
              </div>
              {superlatives[p.id] && (
                <SuperlativeBadge award={superlatives[p.id]} onClick={() => onSuperlativeClick?.(p)} />
              )}
            </li>
          );
        })}
      </ul>
      {!started && (
        <>
          <button className="btn" onClick={onOpenWagerIntro}>
            🎯 {wageringEnabled ? 'Choose Wagers' : 'Optional Wagers'}
          </button>
          {wageringEnabled && (
            <>
              <p className="hint">
                Pick 5 spaces to <strong>wager</strong> — you think these tropes are extra likely to happen. Wagers lock
                once the game starts.
              </p>
              <p className="hint">
                Wagered: {wagerCount} / {maxWagers}
              </p>
            </>
          )}
        </>
      )}
    </aside>
  );
}
