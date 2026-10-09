import ModalShell from './ModalShell.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function SuperlativeModal({ award, playerName, playerAvatar, progress = [], onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content superlative-modal">
        <span className="superlative-modal-kicker">
          {award?.kind === 'superlative' ? 'GAME SUPERLATIVE' : award ? 'BADGE' : 'BADGE PROGRESS'}
        </span>
        <h3>{award?.name || 'Badge Progress'}</h3>
        <p className="superlative-player">{formatPlayerName({ name: playerName, avatar: playerAvatar })}</p>
        {award && <p className="hint">{award.description}</p>}
        <section className="badge-progress" aria-label="Upcoming badges">
          <h4>Next milestones</h4>
          {progress.length ? (
            progress.map((goal) => (
              <div className="badge-progress-goal" key={goal.id}>
                <strong>{goal.name}</strong>
                <p className="hint">{goal.description}</p>
                <progress value={goal.value} max={goal.target} aria-label={`${goal.name} progress`} />
                <span>
                  {goal.value} of {goal.target} {goal.label.toLowerCase()}
                </span>
              </div>
            ))
          ) : (
            <p className="hint">No higher milestones remaining for this watch.</p>
          )}
        </section>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
