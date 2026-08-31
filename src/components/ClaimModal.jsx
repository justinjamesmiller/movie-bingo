export default function ClaimModal({ pendingClaim, myId, players, onAgree, onDisagree, onCancel }) {
  if (!pendingClaim) return null;

  const claimant = players.find((p) => p.id === pendingClaim.byId);
  const isClaimant = pendingClaim.byId === myId;
  const isUndo = pendingClaim.kind === 'unmark';
  const hasVoted = Object.prototype.hasOwnProperty.call(pendingClaim.votes, myId);
  const votesIn = Object.keys(pendingClaim.votes).length;
  const agreeCount = Object.values(pendingClaim.votes).filter(Boolean).length;

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>
          {claimant ? claimant.name : 'A player'}
          {isUndo ? ' wants to undo this space:' : ' claims this happened:'}
        </h3>
        <p className="claim-text">{pendingClaim.text}</p>
        {!isClaimant && !hasVoted && (
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={onAgree}>
              {isUndo ? '👍 Agree, undo it' : '👍 Agree, it happened'}
            </button>
            <button className="btn disagree" onClick={onDisagree}>
              {isUndo ? '👎 Keep it marked' : '👎 Disagree'}
            </button>
          </div>
        )}
        {(isClaimant || hasVoted) && (
          <p className="hint">Waiting for the other players to vote…</p>
        )}
        {isClaimant && (
          <button className="btn disagree cancel-claim-btn" onClick={onCancel}>Cancel / undo my claim</button>
        )}
        <p className="hint">
          {agreeCount} agree so far ({votesIn}/{pendingClaim.totalPlayers} voted, majority needed).
        </p>
      </div>
    </div>
  );
}
