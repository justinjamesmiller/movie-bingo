import { getCurrentPlayerMetrics } from '../utils/gameStats.js';
import ModalShell from './ModalShell.jsx';

export default function StatsDashboardModal({ players, acceptedTropes, freeSpace, callStats = {}, onClose }) {
  const metrics = players.map((player) => ({
    ...player,
    ...getCurrentPlayerMetrics(player, freeSpace, callStats[player.id]),
  }));
  const totalTropes = metrics.reduce((total, player) => total + player.tropes, 0);
  const totalBingos = metrics.reduce((total, player) => total + player.bingos, 0);
  const totalWagerHits = metrics.reduce((total, player) => total + player.wagerHits, 0);
  const totalCorrectCalls = metrics.reduce((total, player) => total + player.correctCalls, 0);

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>📊 Game Stats</h3>
        <div className="stats-grid">
          <span>Accepted tropes</span>
          <strong>{acceptedTropes.length}</strong>
          <span>Total marked spaces</span>
          <strong>{totalTropes}</strong>
          <span>Bingos completed</span>
          <strong>{totalBingos}</strong>
          <span>Wagers hit</span>
          <strong>{totalWagerHits}</strong>
          <span>Correct calls</span>
          <strong>{totalCorrectCalls}</strong>
        </div>
        <div className="modal-scroll-area">
          <ul className="stats-player-list">
            {metrics.map((player) => (
              <li key={player.id}>
                {player.avatar ? `${player.avatar} ` : ''}
                {player.name}
                <span>
                  {player.tropes} tropes · {player.bingos} bingo{player.bingos === 1 ? '' : 's'} · {player.wagerHits}{' '}
                  wager hits · {player.correctCalls}/{player.callsMade} calls
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
