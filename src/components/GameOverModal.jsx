// Host-declared end-of-game recap -- summarizes every player's marked
// trope count and wagered-trope hit rate, using data already fully
// replicated to every client (no protocol changes needed beyond the
// gameOver flag itself).
import ModalShell from './ModalShell.jsx';

export default function GameOverModal({ players, bingoCounts = {}, onClose }) {
  const withStats = players.map((p) => {
    const wageredHit = p.wagered.filter((i) => p.marked.includes(i)).length;
    return {
      ...p,
      markedCount: p.marked.length,
      bingoCount: bingoCounts[p.id] || 0,
      wageredHit,
      wageredTotal: p.wagered.length,
    };
  });
  const topMarked = Math.max(0, ...withStats.map((p) => p.markedCount));
  const topBingos = Math.max(0, ...withStats.map((p) => p.bingoCount));
  const topWagered = Math.max(0, ...withStats.map((p) => p.wageredHit));

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>🏁 Game Over — Recap</h3>
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
                  {p.wageredTotal} wagers hit
                </div>
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
