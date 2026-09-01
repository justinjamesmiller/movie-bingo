// Host-declared end-of-game recap -- summarizes every player's marked
// trope count and wagered-trope hit rate, using data already fully
// replicated to every client (no protocol changes needed beyond the
// gameOver flag itself).
export default function GameOverModal({ players, onClose }) {
  const withStats = players.map((p) => {
    const wageredHit = p.wagered.filter((i) => p.marked.includes(i)).length;
    return { ...p, markedCount: p.marked.length, wageredHit, wageredTotal: p.wagered.length };
  });
  const topMarked = Math.max(0, ...withStats.map((p) => p.markedCount));
  const topWagered = Math.max(0, ...withStats.map((p) => p.wageredHit));

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>🏁 Game Over — Recap</h3>
        <ul className="recap-list">
          {withStats.map((p) => (
            <li key={p.id} className="recap-player">
              <div className="recap-player-name">
                {p.avatar ? `${p.avatar} ` : ''}
                {p.name}
                {topMarked > 0 && p.markedCount === topMarked && ' 🏆'}
                {topWagered > 0 && p.wageredHit === topWagered && ' 🎯'}
              </div>
              <div className="hint">
                {p.markedCount} tropes marked · {p.wageredHit}/{p.wageredTotal} wagers hit
              </div>
            </li>
          ))}
        </ul>
        <p className="hint">🏆 most tropes marked · 🎯 most wagers hit</p>
        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
