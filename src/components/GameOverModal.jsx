// Host-declared end-of-game recap -- summarizes every player's marked
// trope count and wagered-trope hit rate, using data already fully
// replicated to every client (no protocol changes needed beyond the
// gameOver flag itself).
import ModalShell from './ModalShell.jsx';
import SuperlativeBadge from './SuperlativeBadge.jsx';

export default function GameOverModal({
  players,
  bingoCounts = {},
  callStats = {},
  superlatives = {},
  movie,
  isHost = false,
  onMovieClick,
  onSuperlativeClick,
  onClose,
}) {
  const withStats = players.map((p) => {
    const wageredHit = p.wagered.filter((i) => p.marked.includes(i)).length;
    return {
      ...p,
      markedCount: p.marked.length,
      bingoCount: bingoCounts[p.id] || 0,
      wageredHit,
      wageredTotal: p.wagered.length,
      callsMade: callStats[p.id]?.made || 0,
      correctCalls: callStats[p.id]?.correct || 0,
    };
  });
  const topMarked = Math.max(0, ...withStats.map((p) => p.markedCount));
  const topBingos = Math.max(0, ...withStats.map((p) => p.bingoCount));
  const topWagered = Math.max(0, ...withStats.map((p) => p.wageredHit));

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>🏁 Game Over — Recap</h3>
        {movie && (
          <button
            className={`recap-movie${isHost ? ' recap-movie-editable' : ''}`}
            onClick={() => isHost && onMovieClick?.()}
          >
            {movie.poster && <img src={movie.poster} alt="" />}
            <span>{movie.title}</span>
          </button>
        )}
        <div className="modal-scroll-area">
          <ul className="recap-list">
            {withStats.map((p) => (
              <li key={p.id} className="recap-player">
                <div className="recap-player-name">
                  {p.avatar ? `${p.avatar} ` : ''}
                  {p.name}
                  {topMarked > 0 && p.markedCount === topMarked && ' 🏆'}
                  {topBingos > 0 && p.bingoCount === topBingos && ' 🎉'}
                  {topWagered > 0 && p.wageredHit === topWagered && ' 🎯'}
                </div>
                <div className="hint">
                  {p.markedCount} tropes marked · {p.bingoCount} bingo{p.bingoCount === 1 ? '' : 's'} · {p.wageredHit}/
                  {p.wageredTotal} wagers hit · 📣 {p.correctCalls}/{p.callsMade} calls
                </div>
                {superlatives[p.id] && (
                  <SuperlativeBadge award={superlatives[p.id]} onClick={() => onSuperlativeClick?.(p)} />
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="hint">🏆 most tropes marked · 🎉 most bingos · 🎯 most wagers hit</p>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
