export default function AcceptedTropesModal({ acceptedTropes, onChallenge, onClose }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Accepted Tropes</h3>
        {acceptedTropes.length === 0 ? (
          <p className="hint">No tropes have been accepted yet.</p>
        ) : (
          <>
            <p className="hint">Click a trope to challenge it (asks the group to vote on undoing it).</p>
            <ul className="challenge-list">
              {acceptedTropes.map((text) => (
                <li key={text}>
                  <button className="btn challenge-item" onClick={() => onChallenge(text)}>
                    {text}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <button className="btn cancel-claim-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
