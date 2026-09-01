import { useEffect, useRef, useState, useCallback } from 'react';
import { GameClient } from './net/relay.js';
import { SUBGENRES, CENTER_INDEX } from './data/tropes.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import Landing from './components/Landing.jsx';
import PlayersPanel from './components/PlayersPanel.jsx';
import BingoBoard from './components/BingoBoard.jsx';
import ClaimModal from './components/ClaimModal.jsx';
import ResetModal from './components/ResetModal.jsx';
import AcceptedTropesModal from './components/AcceptedTropesModal.jsx';

const MAX_WAGERS = 5;

function App() {
  const clientRef = useRef(null);
  const [screen, setScreen] = useState('landing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState(null);
  const [myId, setMyId] = useState(null);
  const [toast, setToast] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [tropesModalOpen, setTropesModalOpen] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem('bingo-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('bingo-theme', theme);
  }, [theme]);

  useEffect(() => {
    return () => clientRef.current?.destroy();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(''), 3500);
  }, []);

  function makeClient() {
    const client = new GameClient({
      onState: (state, id) => {
        setGameState({ ...state });
        setMyId(id);
      },
      onEvent: (evt) => {
        if (evt.type === 'claimResolved') {
          const undo = evt.kind === 'unmark';
          if (evt.approved) {
            showToast(undo ? `✅ "${evt.text}" was unmarked.` : `✅ "${evt.text}" was confirmed and marked!`);
          } else {
            showToast(`❌ "${evt.text}" did not reach majority agreement.`);
          }
        } else if (evt.type === 'claimCancelled') {
          showToast(`"${evt.text}" claim was cancelled.`);
        } else if (evt.type === 'promotedToHost') {
          showToast('The host disconnected — you are now the host.');
        } else if (evt.type === 'gameReset') {
          showToast('The host reset the game — new boards have been dealt.');
        }
      },
    });
    clientRef.current = client;
    return client;
  }

  async function handleHost(name, subgenre, freeSpace, generalPercent) {
    setError('');
    setBusy(true);
    try {
      const client = makeClient();
      await client.hostGame(name, subgenre, freeSpace, generalPercent);
      setScreen('game');
    } catch (err) {
      setError(err.message || 'Could not host a game.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(name, code) {
    setError('');
    if (code.length !== 4) {
      setError('Enter the 4-character game code.');
      return;
    }
    setBusy(true);
    try {
      const client = makeClient();
      await client.joinGame(code, name);
      setScreen('game');
    } catch (err) {
      setError(err.message || 'Could not join that game.');
    } finally {
      setBusy(false);
    }
  }

  function handleCellClick(index) {
    if (!gameState) return;
    if (gameState.freeSpace && index === CENTER_INDEX) return;
    const me = gameState.players[myId];
    const client = clientRef.current;

    if (!gameState.started) {
      const pos = me.wagered.indexOf(index);
      let next = me.wagered.slice();
      if (pos !== -1) {
        next.splice(pos, 1);
      } else {
        if (next.length >= MAX_WAGERS) {
          showToast(`You can only wager ${MAX_WAGERS} spaces.`);
          return;
        }
        next.push(index);
      }
      client.setWager(next);
      return;
    }

    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    client.claim(index);
  }

  function handleResetGame() {
    setResetModalOpen(true);
  }

  function handleConfirmReset(subgenre, freeSpace, generalPercent) {
    setResetModalOpen(false);
    clientRef.current.resetGame(subgenre, freeSpace, generalPercent);
  }

  function handleChallenge(text) {
    clientRef.current.challengeTrope(text);
    setTropesModalOpen(false);
  }

  if (screen === 'landing' || !gameState) {
    return (
      <>
        <header className="app-header">
          <h1>🎬 Movie Trope Bingo <span className="subtitle">— Horror Edition</span></h1>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </header>
        <main id="app">
          <Landing
            onHost={handleHost}
            onJoin={handleJoin}
            error={error}
            busy={busy}
            savedSession={savedSession}
            onRejoin={handleRejoin}
          />
        </main>
      </>
    );
  }

  const me = gameState.players[myId];
  const players = Object.values(gameState.players).sort((a, b) => a.seat - b.seat);
  const hostId = gameState.seatOrder.find((id) => gameState.players[id]?.connected);
  const isHost = hostId === myId;
  const subgenreLabel = SUBGENRES.find((g) => g.id === gameState.subgenre)?.label || 'Classic / Mixed Horror';

  return (
    <>
      {!focusMode && (
        <header className="app-header">
          <h1>🎬 Movie Trope Bingo <span className="subtitle">— Horror Edition</span></h1>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </header>
      )}
      <main id="app" className={focusMode ? 'focus-mode' : ''}>
        <section className="screen-game">
          {focusMode ? (
            <button className="btn focus-toggle-btn" onClick={() => setFocusMode(false)}>
              ✕ Unfocus
            </button>
          ) : (
            <div className="game-topbar">
              <div className="code-display">Code: {gameState.code}</div>
              <div className="code-display">Sub-genre: {subgenreLabel}</div>
              <div className="code-display">General mix: {gameState.generalPercent}%</div>
              <div className="game-status">
                {gameState.started
                  ? 'Game in progress — click a space when it happens on screen!'
                  : 'Waiting for players — pick your 5 wagered spaces, then the host starts the game.'}
              </div>
              {!gameState.started && isHost && (
                <button className="btn primary" onClick={() => clientRef.current.startGame()}>
                  Start Game
                </button>
              )}
              {gameState.started && (
                <button className="btn" onClick={() => setTropesModalOpen(true)}>
                  Accepted Tropes ({gameState.acceptedTropes.length})
                </button>
              )}
              <button className="btn" onClick={() => setFocusMode(true)}>
                🔍 Board Focus
              </button>
              {isHost && (
                <button className="btn disagree" onClick={handleResetGame}>
                  Reset Game
                </button>
              )}
            </div>
          )}

          <div className="game-layout">
            {!focusMode && (
              <PlayersPanel
                players={players}
                hostId={hostId}
                wagerCount={me.wagered.length}
                maxWagers={MAX_WAGERS}
                started={gameState.started}
              />
            )}
            <div className="board-wrap">
              <BingoBoard
                board={me.board}
                wagered={me.wagered}
                marked={me.marked}
                freeSpace={gameState.freeSpace}
                pending={!!gameState.pendingClaim}
                onCellClick={handleCellClick}
              />
            </div>
          </div>
        </section>
      </main>

      <ClaimModal
        pendingClaim={gameState.pendingClaim}
        myId={myId}
        players={players}
        onAgree={() => clientRef.current.vote(gameState.pendingClaim.claimId, true)}
        onDisagree={() => clientRef.current.vote(gameState.pendingClaim.claimId, false)}
        onCancel={() => clientRef.current.cancelClaim(gameState.pendingClaim.claimId)}
      />

      {resetModalOpen && (
        <ResetModal
          currentSubgenre={gameState.subgenre}
          currentFreeSpace={gameState.freeSpace}
          currentGeneralPercent={gameState.generalPercent}
          onConfirm={handleConfirmReset}
          onCancel={() => setResetModalOpen(false)}
        />
      )}

      {tropesModalOpen && (
        <AcceptedTropesModal
          acceptedTropes={gameState.acceptedTropes}
          onChallenge={handleChallenge}
          onClose={() => setTropesModalOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
