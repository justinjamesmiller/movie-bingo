import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';
import { useTropeDescription } from '../hooks/useTropeDescription.js';

export default function ClaimModal({ pendingClaim, myId, players, onAgree, onDisagree, onCancel }) {
  const { description } = useTropeDescription(pendingClaim?.text);
  if (!pendingClaim) return null;

  const claimant = players.find((p) => p.id === pendingClaim.byId);
  const isClaimant = pendingClaim.byId === myId;
  const isUndo = pendingClaim.kind === 'unmark';
  const isReplace = pendingClaim.kind === 'replace';
  const isWagerChange = pendingClaim.kind === 'wagerChange';
  const isReroll = pendingClaim.kind === 'reroll';
  const isCustom = pendingClaim.kind === 'mark' && pendingClaim.custom;
  const hasVoted = Object.prototype.hasOwnProperty.call(pendingClaim.votes, myId);
  const votesIn = Object.keys(pendingClaim.votes).length;
  const agreeCount = Object.values(pendingClaim.votes).filter(Boolean).length;
  const replaceGenreLabel = isReplace
    ? GENRES.find((g) => g.id === pendingClaim.genre)?.label || pendingClaim.genre
    : null;
  const replaceSubgenreLabel = isReplace
    ? (SUBGENRES_BY_GENRE[pendingClaim.genre] || []).find((s) => s.id === pendingClaim.subgenre)?.label ||
      pendingClaim.subgenre
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
              : isReroll
                ? ' wants a brand new board:'
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
        ) : isReroll ? (
          <p className="hint">
            Their 25 spaces would be re-dealt from the same trope pool. Tropes the group has already accepted stay
            marked, and their current wagers are cleared.
          </p>
        ) : (
          <p className="claim-text">{pendingClaim.text}</p>
        )}
        {description && !isWagerChange && !isReroll && (
          <p className="hint">
            <em>{description.what}</em>
          </p>
        )}
        {isReplace && (
          <p className="hint">
            The new trope would be drawn from:{' '}
            <strong>
              {replaceGenreLabel} — {replaceSubgenreLabel}
            </strong>
          </p>
        )}
        {!isClaimant && !hasVoted && (
          <div className="claim-vote-buttons">
            <button className="btn agree" onClick={onAgree}>
              {isReplace
                ? '👍 Agree, swap it out'
                : isWagerChange
                  ? '👍 Agree, allow it'
                  : isReroll
                    ? '👍 Agree, deal a new board'
                    : isCustom
                      ? '👍 Agree, add it'
                      : isUndo
                        ? '👍 Agree, undo it'
                        : '👍 Agree, it happened'}
            </button>
            <button className="btn disagree" onClick={onDisagree}>
              {isReplace
                ? '👎 Keep it as is'
                : isWagerChange
                  ? '👎 Deny it'
                  : isReroll
                    ? '👎 Keep their board'
                    : isCustom
                      ? '👎 Reject it'
                      : isUndo
                        ? '👎 Keep it marked'
                        : '👎 Disagree'}
            </button>
          </div>
        )}

        {(isClaimant || hasVoted) && <p className="hint">Waiting for the other players to vote…</p>}
        {isClaimant && (
          <button className="btn disagree cancel-claim-btn" onClick={onCancel}>
            Cancel / undo my claim
          </button>
        )}
        <p className="hint">
          {agreeCount} agree so far ({votesIn}/{pendingClaim.totalPlayers} voted, majority needed).
        </p>
      </div>
    </div>
  );
}
