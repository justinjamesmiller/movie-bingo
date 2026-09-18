import ModalShell from './ModalShell.jsx';
import { getMarathonMetrics } from '../utils/gameStats.js';

export default function MarathonStandingsModal({ marathon, onClose }) {
  const watches = marathon?.watches || [];
  const standings = getMarathonMetrics(watches);

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal marathon-modal">
        <h3>🎬 Marathon History</h3>
        <p className="hint">
          {watches.length} completed watch{watches.length === 1 ? '' : 'es'}.
        </p>
        <div className="modal-scroll-area">
          {standings.length === 0 ? (
            <p className="hint">Finish a watch, then reset the game to add its results here.</p>
          ) : (
            <ol className="marathon-standings">
              {standings.map((player) => (
                <li key={player.id}>
                  <strong>
                    {player.avatar ? `${player.avatar} ` : ''}
                    {player.name}
                  </strong>
                  <span>
                    {player.watches} watch{player.watches === 1 ? '' : 'es'}
                  </span>
                  <small>
                    {player.tropes} tropes · {player.bingos} bingo{player.bingos === 1 ? '' : 's'} · {player.wagerHits}{' '}
                    wager hits · {player.correctCalls}/{player.callsMade} calls
                  </small>
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="hint">Totals are tracked across completed watches, without a score.</p>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
