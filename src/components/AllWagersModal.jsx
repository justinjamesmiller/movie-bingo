import ModalShell from './ModalShell.jsx';

export default function AllWagersModal({ players, acceptedTropes, onTropeClick, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>All Wagers</h3>
        {players.every((p) => p.wagered.length === 0) ? (
          <p className="hint">No one has wagered anything yet.</p>
        ) : (
          <ul className="wager-list">
            {players.map((p) => (
              <li key={p.id} className="wager-player">
                <div className="wager-player-name">
                  {p.avatar ? `${p.avatar} ` : ''}
                  {p.name}
                  {!p.connected ? ' (disconnected)' : ''}
                </div>
                {p.wagered.length === 0 ? (
                  <p className="hint">No wagers.</p>
                ) : (
                  <ul className="wager-player-items">
                    {p.wagered.map((index) => {
                      const text = p.board[index];
                      const accepted = acceptedTropes.includes(text);
                      return (
                        <li key={index} className={accepted ? 'accepted' : ''}>
                          <button
                            className={`btn challenge-item${accepted ? ' accepted' : ''}`}
                            onClick={() => onTropeClick(text, accepted)}
                          >
                            {text}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
