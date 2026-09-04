// Chronological log of notable approved events (marks, replaces, wager
// changes, resets, etc.) -- replicated via `state.activityLog` so everyone
// sees the exact same feed, including anyone who looked away mid-game.
import ModalShell from './ModalShell.jsx';

export default function ActivityFeedModal({ activityLog, onClose }) {
  const items = [...activityLog].reverse();

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>📜 Activity Feed</h3>
        <div className="modal-scroll-area">
          {items.length === 0 ? (
            <p className="hint">Nothing has happened yet.</p>
          ) : (
            <ul className="activity-list">
              {items.map((item) => (
                <li key={item.id}>
                  <span className="activity-time">
                    {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="activity-text">{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
