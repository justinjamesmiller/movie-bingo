import { useEffect, useRef, useState, useCallback } from 'react';
import { GameClient } from './net/relay.js';
import { GENRES, SUBGENRES_BY_GENRE, CENTER_INDEX } from './data/tropes.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import Landing from './components/Landing.jsx';
import PlayersPanel from './components/PlayersPanel.jsx';
import BingoBoard from './components/BingoBoard.jsx';
import ClaimModal from './components/ClaimModal.jsx';
import ResetModal from './components/ResetModal.jsx';
import AcceptedTropesModal from './components/AcceptedTropesModal.jsx';
import AllTropesModal from './components/AllTropesModal.jsx';
import ProposeReplaceModal from './components/ProposeReplaceModal.jsx';
import JoinChoiceModal from './components/JoinChoiceModal.jsx';
import KickConfirmModal from './components/KickConfirmModal.jsx';
import ChangeNameModal from './components/ChangeNameModal.jsx';

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
  const [allTropesModalOpen, setAllTropesModalOpen] = useState(false);
  const [replaceProposal, setReplaceProposal] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [savedSession, setSavedSession] = useState(() => GameClient.getSavedSession());
  const [joinChoice, setJoinChoice] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [changeNameModalOpen, setChangeNameModalOpen] = useState(false);
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
          const replace = evt.kind === 'replace';
          if (evt.approved) {
            if (replace) {
              showToast(`✅ "${evt.text}" was swapped out for a new trope!`);
            } else {
              showToast(undo ? `✅ "${evt.text}" was unmarked.` : `✅ "${evt.text}" was confirmed and marked!`);
            }
          } else {
            showToast(`❌ "${evt.text}" did not reach majority agreement.`);
          }
        } else if (evt.type === 'claimCancelled') {
          showToast(`"${evt.text}" claim was cancelled.`);
        } else if (evt.type === 'promotedToHost') {
          showToast('The host disconnected — you are now the host.');
        } else if (evt.type === 'gameReset') {
          showToast('The host reset the game — new boards have been dealt.');
        } else if (evt.type === 'codeChanged') {
          showToast('A player was removed — the game code was rotated for security.');
        } else if (evt.type === 'kicked') {
          clientRef.current = null;
          setScreen('landing');
          setGameState(null);
          setMyId(null);
          setSavedSession(null);
          setError('You were removed from the game by the host.');
        }
      },
    });
    clientRef.current = client;
    return client;
  }

  async function handleHost(name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes) {
    setError('');
    setBusy(true);
    try {
      const client = makeClient();
      await client.hostGame(name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes);
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
      const result = await client.joinGame(code, name);
      if (result.needsChoice) {
        setJoinChoice({ name: result.name, options: result.options, allowNew: result.allowNew });
      } else {
        setScreen('game');
      }
    } catch (err) {
      setError(err.message || 'Could not join that game.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimSeat(seatId) {
    setError('');
    setBusy(true);
    try {
      await clientRef.current.claimDisconnectedSeat(seatId, joinChoice.name);
      setJoinChoice(null);
      setScreen('game');
    } catch (err) {
      setError(err.message || 'Could not reconnect as that player.');
      setJoinChoice(null);
      clientRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinAsNew() {
    setError('');
    setBusy(true);
    try {
      await clientRef.current.confirmNewJoin(joinChoice.name);
      setJoinChoice(null);
      setScreen('game');
    } catch (err) {
      setError(err.message || 'Could not join that game.');
      setJoinChoice(null);
      clientRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  function handleCancelJoinChoice() {
    clientRef.current?.destroy();
    clientRef.current = null;
    setJoinChoice(null);
  }

  async function handleRejoin() {
    setError('');
    setBusy(true);
    try {
      const client = makeClient();
      await client.rejoinGame();
      setScreen('game');
    } catch (err) {
      setError(err.message || 'Could not reconnect to that game.');
      setSavedSession(GameClient.getSavedSession());
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

  function handleConfirmReset(genres, subgenreSelections, freeSpace, generalPercents, totalTropes) {
    setResetModalOpen(false);
    clientRef.current.resetGame(genres, subgenreSelections, freeSpace, generalPercents, totalTropes);
  }

  function handleChallenge(text) {
    clientRef.current.challengeTrope(text);
    setTropesModalOpen(false);
  }

  function handleRequestReplace(text) {
    if (!gameState || !text) return;
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    setReplaceProposal({ text });
  }

  function handleConfirmReplace(genre, subgenre) {
    clientRef.current.proposeReplace(replaceProposal.text, genre, subgenre);
    setReplaceProposal(null);
    setTropesModalOpen(false);
    setAllTropesModalOpen(false);
  }

  function handleCancelReplace() {
    setReplaceProposal(null);
  }

  function handleProposeAccept(text) {
    if (!gameState) return;
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    clientRef.current.proposeAccept(text);
    setAllTropesModalOpen(false);
  }

  function handleCellLongPress(index) {
    if (!gameState) return;
    if (gameState.freeSpace && index === CENTER_INDEX) return;
    const me = gameState.players[myId];
    handleRequestReplace(me.board[index]);
  }

  function handleKickPlayer(id, name) {
    setKickTarget({ id, name });
  }

  function handleConfirmKick() {
    clientRef.current.kickPlayer(kickTarget.id);
    setKickTarget(null);
  }

  function handleConfirmChangeName(name) {
    clientRef.current.changeName(name);
    setChangeNameModalOpen(false);
  }

  function handleLeaveGame() {
    clientRef.current?.leaveGame();
    clientRef.current = null;
    setScreen('landing');
    setGameState(null);
    setMyId(null);
    setSavedSession(null);
  }

  if (screen === 'landing' || !gameState) {
    return (
      <>
        <header className="app-header">
          <h1>🎬 Movie Trope Bingo</h1>
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
        {joinChoice && (
          <JoinChoiceModal
            name={joinChoice.name}
            options={joinChoice.options}
            allowNew={joinChoice.allowNew}
            busy={busy}
            onClaimSeat={handleClaimSeat}
            onJoinAsNew={handleJoinAsNew}
            onCancel={handleCancelJoinChoice}
          />
        )}
      </>
    );
  }

  const me = gameState.players[myId];
  const players = Object.values(gameState.players).sort((a, b) => a.seat - b.seat);
  const hostId = gameState.seatOrder.find((id) => gameState.players[id]?.connected);
  const isHost = hostId === myId;
  const genreLabels = gameState.genres.map((id) => GENRES.find((g) => g.id === id)?.label || id).join(', ');
  const subgenreLabels = gameState.subgenreSelections.length
    ? gameState.subgenreSelections
        .map((s) => (SUBGENRES_BY_GENRE[s.genre] || []).find((sg) => sg.id === s.subgenre)?.label || s.subgenre)
        .join(', ')
    : 'Classic / Mixed only';
  const generalMixLabels = gameState.genres
    .map((id) => `${GENRES.find((g) => g.id === id)?.label || id} ${gameState.generalPercents[id]}%`)
    .join(', ');

  return (
    <>
      {!focusMode && (
        <header className="app-header">
          <h1>🎬 Movie Trope Bingo</h1>
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
              <div className="code-display">Genres: {genreLabels}</div>
              <div className="code-display">Sub-genres: {subgenreLabels}</div>
              <div className="code-display">General mix: {generalMixLabels}</div>
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
              <button className="btn" onClick={() => setAllTropesModalOpen(true)}>
                All Tropes ({gameState.tropePool.length})
              </button>
              <button className="btn" onClick={() => setFocusMode(true)}>
                🔍 Board Focus
              </button>
              <button className="btn" onClick={() => setChangeNameModalOpen(true)}>
                ✏️ Change Name
              </button>
              {isHost && (
                <button className="btn disagree" onClick={handleResetGame}>
                  Reset Game
                </button>
              )}
              <button className="btn disagree" onClick={handleLeaveGame}>
                🚪 Leave Game
              </button>
            </div>
          )}

          <div className="game-layout">
            {!focusMode && (
              <PlayersPanel
                players={players}
                hostId={hostId}
                myId={myId}
                isHost={isHost}
                wagerCount={me.wagered.length}
                maxWagers={MAX_WAGERS}
                started={gameState.started}
                onKick={handleKickPlayer}
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
                onCellLongPress={handleCellLongPress}
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
          currentGenres={gameState.genres}
          currentSubgenreSelections={gameState.subgenreSelections}
          currentFreeSpace={gameState.freeSpace}
          currentGeneralPercents={gameState.generalPercents}
          currentTotalTropes={gameState.totalTropes}
          onConfirm={handleConfirmReset}
          onCancel={() => setResetModalOpen(false)}
        />
      )}

      {tropesModalOpen && (
        <AcceptedTropesModal
          acceptedTropes={gameState.acceptedTropes}
          onChallenge={handleChallenge}
          onRequestReplace={handleRequestReplace}
          onClose={() => setTropesModalOpen(false)}
        />
      )}

      {allTropesModalOpen && (
        <AllTropesModal
          tropePool={gameState.tropePool}
          acceptedTropes={gameState.acceptedTropes}
          onPropose={handleProposeAccept}
          onRequestReplace={handleRequestReplace}
          onClose={() => setAllTropesModalOpen(false)}
        />
      )}

      {replaceProposal && (
        <ProposeReplaceModal
          text={replaceProposal.text}
          defaultGenre={gameState.genres[0]}
          defaultSubgenre="general"
          onConfirm={handleConfirmReplace}
          onCancel={handleCancelReplace}
        />
      )}

      {kickTarget && (
        <KickConfirmModal
          playerName={kickTarget.name}
          onConfirm={handleConfirmKick}
          onCancel={() => setKickTarget(null)}
        />
      )}

      {changeNameModalOpen && (
        <ChangeNameModal
          currentName={me.name}
          onConfirm={handleConfirmChangeName}
          onCancel={() => setChangeNameModalOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
