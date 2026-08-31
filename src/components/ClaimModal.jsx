export default function ClaimModal({ pendingClaim, myId, players, onAgree, onDisagree }) {
  if (!pendingClaim) return null;

  const claimant = players.find((p) => p.id === pendingClaim.byId);
  const isClaimant = pendingClaim.byId === myId;
  const hasVoted = Object.prototype.hasOwnProperty.call(pendingClaim.votes, myId);
  const votesIn = Object.keys(pendingClaim.votes).length;
  const agreeCount = Object.values(pendingClaim.votes).filter(Boolean).length;

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{claimant ? claimant.name : 'A player'} claims this happened:</h3>
        <p className="claim-text">{pendingClaim.text}</p>
        {!isClaimant && !hasVoted && (
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={onAgree}>👍 Agree, it happened</button>
            <button className="btn disagree" onClick={onDisagree}>👎 Disagree</button>
          </div>
        )}
        {(isClaimant || hasVoted) && (
          <p className="hint">Waiting for the other players to vote…</p>
        )}
        <p className="hint">
          {agreeCount} agree so far ({votesIn}/{pendingClaim.totalPlayers} voted, majority needed).
        </p>
      </div>
    </div>
  );
}
