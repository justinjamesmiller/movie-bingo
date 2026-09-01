import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';

export default function ClaimModal({ pendingClaim, myId, players, onAgree, onDisagree, onCancel }) {
  if (!pendingClaim) return null;

  const claimant = players.find((p) => p.id === pendingClaim.byId);
  const isClaimant = pendingClaim.byId === myId;
  const isUndo = pendingClaim.kind === 'unmark';
  const isReplace = pendingClaim.kind === 'replace';
  const isWagerChange = pendingClaim.kind === 'wagerChange';
  const isCustom = pendingClaim.kind === 'mark' && pendingClaim.custom;
  const hasVoted = Object.prototype.hasOwnProperty.call(pendingClaim.votes, myId);
  const votesIn = Object.keys(pendingClaim.votes).length;
  const agreeCount = Object.values(pendingClaim.votes).filter(Boolean).length;
  const replaceGenreLabel = isReplace ? GENRES.find((g) => g.id === pendingClaim.genre)?.label || pendingClaim.genre : null;
  const replaceSubgenreLabel = isReplace
    ? (SUBGENRES_BY_GENRE[pendingClaim.genre] || []).find((s) => s.id === pendingClaim.subgenre)?.label || pendingClaim.subgenre
    : null;
  const claimantLabel = claimant ? `${claimant.avatar ? `${claimant.avatar} ` : ''}${claimant.name}` : 'A player';

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>
          {claimantLabel}
          {isReplace
            ? ' wants to swap out this trope:'
            : isWagerChange
              ? ' wants to change their wagers:'
              : isCustom
                ? ' wants to add a new custom trope:'
                : isUndo
                  ? ' wants to undo this space:'
                  : ' claims this happened:'}
        </h3>
        {isWagerChange ? (
          <>
            {pendingClaim.removeTexts.length > 0 && (
              <>
                <p className="hint">Removing:</p>
                <ul className="claim-text-list">
                  {pendingClaim.removeTexts.map((text) => (
                    <li key={text}>🗑️ {text}</li>
                  ))}
                </ul>
              </>
            )}
            {pendingClaim.addTexts.length > 0 && (
              <>
                <p className="hint">Adding:</p>
                <ul className="claim-text-list">
                  {pendingClaim.addTexts.map((text) => (
                    <li key={text}>➕ {text}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="claim-text">{pendingClaim.text}</p>
        )}
        {isReplace && (
          <p className="hint">
            The new trope would be drawn from: <strong>{replaceGenreLabel} — {replaceSubgenreLabel}</strong>
          </p>
        )}
        {!isClaimant && !hasVoted && (
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={onAgree}>
              {isReplace ? '👍 Agree, swap it out' : isWagerChange ? '👍 Agree, allow it' : isCustom ? '👍 Agree, add it' : isUndo ? '👍 Agree, undo it' : '👍 Agree, it happened'}
            </button>
            <button className="btn disagree" onClick={onDisagree}>
              {isReplace ? '👎 Keep it as is' : isWagerChange ? '👎 Deny it' : isCustom ? '👎 Reject it' : isUndo ? '👎 Keep it marked' : '👎 Disagree'}
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
