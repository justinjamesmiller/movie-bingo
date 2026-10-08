import { getCurrentPlayerMetrics, getMarathonMetrics } from '../utils/gameStats.js';
import ModalShell from './ModalShell.jsx';

export default function PlayerStatsModal({ player, marathon, freeSpace, callStats, onCallScoreClick, onClose }) {
  const current = getCurrentPlayerMetrics(player, freeSpace, callStats);
  const marathonTotals = getMarathonMetrics(marathon?.watches).find((entry) => entry.id === player.id);
  const hasMarathon = (marathon?.watches?.length || 0) > 0;

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>
          {player.avatar ? `${player.avatar} ` : ''}
          {player.name}'s Stats
        </h3>
        <div className="stats-grid">
          <span>Current tropes</span>
          <strong>{current.tropes}</strong>
          <span>Current bingos</span>
          <strong>{current.bingos}</strong>
          <span>Wagers hit</span>
          <strong>
            {current.wagerHits} / {current.wagers}
          </strong>
          {current.callsMade > 0 && (
            <>
              <span>Calls</span>
              <button
                className="player-profile-button"
                onClick={() => onCallScoreClick?.(player)}
                title="About call-it scores"
              >
                {current.callsMade} made · {current.correctCalls} correct
              </button>
            </>
          )}
          {hasMarathon && (
            <>
              <span>Marathon watches</span>
              <strong>{marathonTotals?.watches || 0}</strong>
            </>
          )}
          {hasMarathon && marathonTotals?.callsMade > 0 && (
            <>
              <span>Marathon calls</span>
              <strong>
                {marathonTotals?.callsMade || 0} made · {marathonTotals?.correctCalls || 0} correct
              </strong>
            </>
          )}
          {hasMarathon && (
            <>
              <span>Marathon tropes</span>
              <strong>{marathonTotals?.tropes || 0}</strong>
            </>
          )}
          {hasMarathon && (
            <>
              <span>Marathon bingos</span>
              <strong>{marathonTotals?.bingos || 0}</strong>
            </>
          )}
          {hasMarathon && (
            <>
              <span>Marathon wager hits</span>
              <strong>{marathonTotals?.wagerHits || 0}</strong>
            </>
          )}
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
