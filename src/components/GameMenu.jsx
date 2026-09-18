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
  onResignHost,
  hostCount,
  onResetGame,
  onEndGame,
  onResumeGame,
  onConfigureSession,
  onViewRecap,
  onLeaveGame,
  onCopyInviteLink,
  onShowInviteQr,
  advancedGameplay,
  onToggleAdvancedGameplay,
  onSubmitCustomTrope,
  onRequestBoardSwap,
  marathonEnabled,
  onShowMarathonStandings,
  onShowStatsDashboard,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [advancedSection, setAdvancedSection] = useState(null);

  function pick(action) {
    action();
    onClose();
  }

  function toggleAdvancedOptions() {
    if (advancedGameplay) setAdvancedSection(null);
    onToggleAdvancedGameplay();
  }

  function toggleAdvancedSection(section) {
    setAdvancedSection((current) => (current === section ? null : section));
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
              <button
                className="code-display menu-genre-toggle"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                Genres: {genreLabels}
              </button>
              {detailsOpen && (
                <>
                  <div className="code-display">Sub-genres: {subgenreLabels}</div>
                  {generalMixLabels && <div className="code-display">General mix: {generalMixLabels}</div>}
                </>
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
              <button className="btn menu-expander" aria-expanded={advancedGameplay} onClick={toggleAdvancedOptions}>
                {advancedGameplay ? 'Use Simple Options' : 'Advanced Options'}
              </button>
              {advancedGameplay && (
                <button
                  className="btn menu-section-toggle"
                  aria-expanded={advancedSection === 'explore'}
                  onClick={() => toggleAdvancedSection('explore')}
                >
                  Explore &amp; Stats
                </button>
              )}
              {advancedGameplay && advancedSection === 'explore' && (
                <div className="game-menu-section">
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
                  <button className="btn" onClick={() => pick(onShowStatsDashboard)}>
                    📊 Game Stats
                  </button>
                  {marathonEnabled && (
                    <button className="btn" onClick={() => pick(onShowMarathonStandings)}>
                      🎬 Marathon History
                    </button>
                  )}
                </div>
              )}
              {advancedGameplay && (
                <button
                  className="btn menu-section-toggle"
                  aria-expanded={advancedSection === 'personal'}
                  onClick={() => toggleAdvancedSection('personal')}
                >
                  My Tools
                </button>
              )}
              {advancedGameplay && advancedSection === 'personal' && (
                <div className="game-menu-section">
                  {started && (
                    <button className="btn" onClick={() => pick(onShowAssignWager)}>
                      🎯 Manage Wagers
                    </button>
                  )}
                  {started && !gameOver && (
                    <button className="btn" onClick={() => pick(onSubmitCustomTrope)}>
                      📝 Submit Custom Trope
                    </button>
                  )}
                  {started && !gameOver && (
                    <button className="btn" onClick={() => pick(onRequestBoardSwap)}>
                      🔀 Swap My Whole Board
                    </button>
                  )}
                  <button className="btn" onClick={() => pick(onBoardFocus)}>
                    🔍 Board Focus
                  </button>
                </div>
              )}
              {advancedGameplay && isHost && (
                <button
                  className="btn menu-section-toggle"
                  aria-expanded={advancedSection === 'host'}
                  onClick={() => toggleAdvancedSection('host')}
                >
                  Host Settings
                </button>
              )}
              {advancedGameplay && isHost && advancedSection === 'host' && (
                <div className="game-menu-section">
                  {hostCount > 1 && (
                    <button className="btn" onClick={() => pick(onResignHost)}>
                      Resign as Host
                    </button>
                  )}
                  {!gameOver && (
                    <button className="btn" onClick={() => pick(onConfigureSession)}>
                      ⏳ Session Lifetime
                    </button>
                  )}
                  <button className="btn disagree" onClick={() => pick(onResetGame)}>
                    🔄 Reset Game
                  </button>
                </div>
              )}
              {started && (
                <button className="btn" onClick={() => pick(onShowAcceptedTropes)}>
                  Accepted Tropes ({acceptedCount})
                </button>
              )}
              {gameOver && (
                <button className="btn" onClick={() => pick(onViewRecap)}>
                  🏁 View Recap
                </button>
              )}
              {isHost && started && gameOver && (
                <button className="btn primary" onClick={() => pick(onResumeGame)}>
                  ▶️ Resume Game
                </button>
              )}
              {isHost && started && !gameOver && (
                <button className="btn disagree" onClick={() => pick(onEndGame)}>
                  🏁 End Game
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
