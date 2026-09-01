// Chronological log of notable approved events (marks, replaces, wager
// changes, resets, etc.) -- replicated via `state.activityLog` so everyone
// sees the exact same feed, including anyone who looked away mid-game.
export default function ActivityFeedModal({ activityLog, onClose }) {
  const items = [...activityLog].reverse();

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>📜 Activity Feed</h3>
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
        <button className="btn cancel-claim-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
