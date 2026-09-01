// Hamburger menu rolling up the secondary in-game buttons + game info chips,
// so the topbar stays uncluttered (especially on mobile).
export default function GameMenu({
  open,
  onToggle,
  onClose,
  genreLabels,
  subgenreLabels,
  generalMixLabels,
  started,
  gameOver,
  isHost,
  acceptedCount,
  tropePoolCount,
  onShowAcceptedTropes,
  onShowAssignWager,
  onShowAllTropes,
  onShowAllWagers,
  onShowActivityFeed,
  onBoardFocus,
  onChangeName,
  onResetGame,
  onEndGame,
  onViewRecap,
  onLeaveGame,
  onCopyCode,
  onCopyInviteLink,
  onSubmitCustomTrope,
}) {
  function pick(action) {
    action();
    onClose();
  }

  return (
    <div className="game-menu">
      <button className="btn hamburger-btn" onClick={onToggle} aria-label="Menu">
        ☰ Menu
      </button>
      {open && (
        <>
          <div className="game-menu-overlay" onClick={onClose} />
          <div className="game-menu-panel">
            <div className="game-menu-info">
              <div className="code-display">Genres: {genreLabels}</div>
              <div className="code-display">Sub-genres: {subgenreLabels}</div>
              <div className="code-display">General mix: {generalMixLabels}</div>
              <div className="game-menu-copy-row">
                <button className="btn" onClick={() => pick(onCopyCode)}>
                  📋 Copy Code
                </button>
                <button className="btn" onClick={() => pick(onCopyInviteLink)}>
                  🔗 Copy Invite Link
                </button>
              </div>
            </div>
            <div className="game-menu-actions">
              {started && (
                <button className="btn" onClick={() => pick(onShowAcceptedTropes)}>
                  Accepted Tropes ({acceptedCount})
                </button>
              )}
              {started && (
                <button className="btn" onClick={() => pick(onShowAssignWager)}>
                  🎯 Manage Wagers
                </button>
              )}
              <button className="btn" onClick={() => pick(onShowAllTropes)}>
                All Tropes ({tropePoolCount})
              </button>
              <button className="btn" onClick={() => pick(onShowAllWagers)}>
                🎯 All Wagers
              </button>
              {started && (
                <button className="btn" onClick={() => pick(onShowActivityFeed)}>
                  📜 Activity Feed
                </button>
              )}
              {started && !gameOver && (
                <button className="btn" onClick={() => pick(onSubmitCustomTrope)}>
                  📝 Submit Custom Trope
                </button>
              )}
              <button className="btn" onClick={() => pick(onBoardFocus)}>
                🔍 Board Focus
              </button>
              <button className="btn" onClick={() => pick(onChangeName)}>
                ✏️ Change Name
              </button>
              {gameOver && (
                <button className="btn" onClick={() => pick(onViewRecap)}>
                  🏁 View Recap
                </button>
              )}
              {isHost && started && !gameOver && (
                <button className="btn disagree" onClick={() => pick(onEndGame)}>
                  🏁 End Game
                </button>
              )}
              {isHost && (
                <button className="btn disagree" onClick={() => pick(onResetGame)}>
                  Reset Game
                </button>
              )}
              <button className="btn disagree" onClick={() => pick(onLeaveGame)}>
                🚪 Leave Game
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
