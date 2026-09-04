import { useState } from 'react';

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
  onResignHost,
  hostCount,
  onResetGame,
  onEndGame,
  onViewRecap,
  onLeaveGame,
  onCopyInviteLink,
  onShowInviteQr,
  advancedGameplay,
  onToggleAdvancedGameplay,
  onSubmitCustomTrope,
  onRequestBoardSwap,
}) {
  const [advancedDetails, setAdvancedDetails] = useState(false);

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
              {advancedDetails ? (
                <>
                  <div className="code-display">Sub-genres: {subgenreLabels}</div>
                  {generalMixLabels && <div className="code-display">General mix: {generalMixLabels}</div>}
                  <button className="btn" onClick={() => setAdvancedDetails(false)}>
                    Simple Details
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => setAdvancedDetails(true)}>
                  Advanced Details
                </button>
              )}
              <div className="game-menu-copy-row">
                <button className="btn" onClick={() => pick(onCopyInviteLink)}>
                  🔗 Copy Invite Link
                </button>
                <button className="btn" onClick={() => pick(onShowInviteQr)}>
                  QR Code
                </button>
              </div>
            </div>
            <div className="game-menu-actions">
              <button className="btn" onClick={onToggleAdvancedGameplay}>
                {advancedGameplay ? 'Use Simple Gameplay' : 'Advanced Gameplay'}
              </button>
              {started && (
                <button className="btn" onClick={() => pick(onShowAcceptedTropes)}>
                  Accepted Tropes ({acceptedCount})
                </button>
              )}
              {advancedGameplay && started && (
                <button className="btn" onClick={() => pick(onShowAssignWager)}>
                  🎯 Manage Wagers
                </button>
              )}
              {advancedGameplay && (
                <button className="btn" onClick={() => pick(onShowAllTropes)}>
                  All Tropes ({tropePoolCount})
                </button>
              )}
              {advancedGameplay && (
                <button className="btn" onClick={() => pick(onShowAllWagers)}>
                  🎯 All Wagers
                </button>
              )}
              {advancedGameplay && started && (
                <button className="btn" onClick={() => pick(onShowActivityFeed)}>
                  📜 Activity Feed
                </button>
              )}
              {advancedGameplay && started && !gameOver && (
                <button className="btn" onClick={() => pick(onSubmitCustomTrope)}>
                  📝 Submit Custom Trope
                </button>
              )}
              {advancedGameplay && started && !gameOver && (
                <button className="btn" onClick={() => pick(onRequestBoardSwap)}>
                  🔀 Swap My Whole Board
                </button>
              )}
              {advancedGameplay && (
                <button className="btn" onClick={() => pick(onBoardFocus)}>
                  🔍 Board Focus
                </button>
              )}
              {advancedGameplay && (
                <button className="btn" onClick={() => pick(onChangeName)}>
                  ✏️ Change Name and Avatar
                </button>
              )}
              {advancedGameplay && isHost && hostCount > 1 && (
                <button className="btn" onClick={() => pick(onResignHost)}>
                  Resign as Host
                </button>
              )}
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
              {advancedGameplay && isHost && (
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
