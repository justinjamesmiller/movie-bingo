import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function CallInfoModal({
  player,
  stats = {},
  history,
  activeCall,
  successfulCalls = {},
  gameOver = false,
  onClose,
}) {
  const calls = history ?? [
    ...Object.entries(successfulCalls)
      .filter(([, callers]) => callers.some((caller) => caller.id === player.id))
      .map(([text]) => ({ id: `legacy-scored-${text}`, text, status: 'scored' })),
    ...(activeCall ? [{ id: 'legacy-active', text: activeCall, status: 'active' }] : []),
  ];
  const statuses = {
    active: gameOver ? 'Not scored' : 'Waiting',
    scored: 'Scored',
    changed: 'Changed',
    withdrawn: 'Withdrawn',
    replaced: 'Trope replaced',
  };
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>Call it next</h3>
        <p>
          {formatPlayerName(player)}: {stats.correct || 0} correct / {stats.made || 0} calls made
        </p>
        <div className="modal-scroll-area">
          {calls.length > 0 ? (
            <ul className="claim-text-list" aria-label={`Calls made by ${player.name}`}>
              {calls.map((call) => (
                <li key={call.id}>
                  <strong>{call.text}</strong>
                  {' · '}
                  {statuses[call.status] || 'Not scored'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No individual calls were recorded for this player.</p>
          )}
          {calls.length < (stats.made || 0) && (
            <p className="hint">
              Some earlier calls were not recorded individually. Their totals are still included above.
            </p>
          )}
          <p className="hint">
            A call is a prediction, not a claim. During play, open an unaccepted trope on your board, choose Advanced
            actions, then Call it next. You can have one active call at a time, change it, or withdraw it there.
          </p>
          <p className="hint">
            The first number counts calls whose trope was later accepted by the group. The second counts calls made,
            including changed or withdrawn predictions. If a different trope is accepted first, you can keep or drop
            your call; a kept call can still become correct later. Calls do not add points or change your bingo score.
          </p>
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
