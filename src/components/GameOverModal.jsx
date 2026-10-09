// Host-declared end-of-game recap -- summarizes every player's marked
// trope count and wagered-trope hit rate, using data already fully
// replicated to every client (no protocol changes needed beyond the
// gameOver flag itself).
import ModalShell from './ModalShell.jsx';
import SuperlativeBadge from './SuperlativeBadge.jsx';
import { formatPlayerName } from '../utils/playerName.js';

export default function GameOverModal({
  players,
  bingoCounts = {},
  callStats = {},
  awards = {},
  movie,
  isHost = false,
  onMovieClick,
  onAwardClick,
  onCallScoreClick,
  onClose,
  watchState = {},
}) {
  const successfulCalls = Object.entries(watchState.acceptedCalls || {});
  const debates = (watchState.claimHistory || [])
    .filter((entry) => !entry.approved || entry.kind === 'unmark')
    .slice(-10)
    .reverse();
  const seenBingos = new Set();
  const multiBingos = (watchState.bingoEvents || []).filter((event) => {
    const key = `${event.playerId}:${event.claimId}`;
    if (!event.claimId || !(event.newLines >= 2) || seenBingos.has(key)) return false;
    seenBingos.add(key);
    return true;
  });
  const withStats = players.map((p) => {
    const wageredHit = p.wagered.filter((i) => p.marked.includes(i)).length;
    return {
      ...p,
      markedCount: p.marked.length,
      bingoCount: bingoCounts[p.id] || 0,
      wageredHit,
      wageredTotal: p.wagered.length,
      callsMade: callStats[p.id]?.made || 0,
      correctCalls: callStats[p.id]?.correct || 0,
    };
  });
  function soleLeader(metric) {
    const top = Math.max(0, ...withStats.map((player) => player[metric]));
    const leaders = withStats.filter((player) => player[metric] === top);
    return top > 0 && leaders.length === 1 ? leaders[0].id : null;
  }
  const topMarked = soleLeader('markedCount');
  const topBingos = soleLeader('bingoCount');
  const topWagered = soleLeader('wageredHit');

  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content list-modal">
        <h3>🏁 Game Over — Recap</h3>
        {movie && (
          <button className={`recap-movie${isHost ? ' recap-movie-editable' : ''}`} onClick={() => onMovieClick?.()}>
            {movie.poster && <img src={movie.poster} alt="" />}
            <span>{movie.title}</span>
          </button>
        )}
        <div className="modal-scroll-area">
          {successfulCalls.length > 0 && (
            <section className="recap-highlights">
              <h4>Called it correctly</h4>
              <ul>
                {successfulCalls.map(([text, callers]) => (
                  <li key={text}>
                    <strong>{text}</strong>
                    <br />
                    {callers
                      .map((caller) => formatPlayerName(players.find((player) => player.id === caller.id) || caller))
                      .join(', ')}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {multiBingos.length > 0 && (
            <section className="recap-highlights">
              <h4>Multi-line bingo moments</h4>
              <ul>
                {multiBingos.map((event) => (
                  <li key={`${event.playerId}:${event.claimId}`}>
                    {formatPlayerName(
                      players.find((player) => player.id === event.playerId) || {
                        name: event.playerName,
                        avatar: event.playerAvatar,
                      },
                    )}{' '}
                    · {event.newLines} lines completed at once ({event.totalLines} total)
                  </li>
                ))}
              </ul>
            </section>
          )}
          {debates.length > 0 && (
            <section className="recap-highlights">
              <h4>Debated moments</h4>
              <ul>
                {debates.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.text}</strong> · {entry.approved ? 'Acceptance undone' : 'Not accepted'}
                    <p className="hint">
                      {entry.proposerIds
                        .map((id) =>
                          formatPlayerName(
                            players.find((player) => player.id === id) ||
                              entry.proposers?.find((player) => player.id === id),
                          ),
                        )
                        .join(', ')}
                    </p>
                    {entry.sceneContexts?.map((context) => (
                      <p className="hint" key={context.playerId}>
                        {context.timestamp && `${context.timestamp} · `}
                        {context.note}
                      </p>
                    ))}
                    {Object.keys(entry.reasons || {}).length > 0 && (
                      <p className="hint">
                        Reasons:{' '}
                        {Object.entries(entry.reasons)
                          .map(([reason, count]) => `${reason} (${count})`)
                          .join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ul className="recap-list">
            {withStats.map((p) => (
              <li key={p.id} className="recap-player">
                <div className="recap-player-name">
                  {p.avatar ? `${p.avatar} ` : ''}
                  {p.name}
                  {p.id === topMarked && ' 🏆'}
                  {p.id === topBingos && ' 🎉'}
                  {p.id === topWagered && ' 🎯'}
                </div>
                <div className="hint">
                  {p.markedCount} tropes marked · {p.bingoCount} bingo{p.bingoCount === 1 ? '' : 's'} · {p.wageredHit}/
                  {p.wageredTotal} wagers hit
                  {p.callsMade > 0 && (
                    <>
                      {' · '}
                      <button
                        className="player-profile-button"
                        onClick={() => onCallScoreClick?.(p)}
                        title="About call-it scores"
                      >
                        📣 {p.correctCalls}/{p.callsMade} calls
                      </button>
                    </>
                  )}
                </div>
                {awards[p.id] && (
                  <div className="player-awards" aria-label={`${p.name} awards`}>
                    {[...awards[p.id].superlatives, ...awards[p.id].badges].map((award) => (
                      <SuperlativeBadge key={award.id} award={award} onClick={() => onAwardClick?.(p, award)} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="hint">🏆 most tropes marked · 🎉 most bingos · 🎯 most wagers hit</p>
        <button className="btn modal-footer" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
