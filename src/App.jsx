import { useEffect, useRef, useState, useCallback } from 'react';
import { GameClient } from './net/relay.js';
import { GENRES, SUBGENRES_BY_GENRE, CENTER_INDEX } from './data/tropes.js';
import { getCompletedLines, getCompletedLineCells } from './utils/bingoLines.js';
import { isSoundMuted, setSoundMuted, playNewClaimSound, playApprovedSound, playDeniedSound, playBingoSound, playGameOverSound, playPersonalMarkSound } from './utils/sound.js';
import { isVibrationMuted, setVibrationMuted, vibrate, VIBRATE_PATTERN_MARK, VIBRATE_PATTERN_BINGO } from './utils/haptics.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import Landing from './components/Landing.jsx';
import PlayersPanel from './components/PlayersPanel.jsx';
import BingoBoard from './components/BingoBoard.jsx';
import BingoBanner from './components/BingoBanner.jsx';
import ReactionBar from './components/ReactionBar.jsx';
import ReactionOverlay from './components/ReactionOverlay.jsx';
import CustomTropeModal from './components/CustomTropeModal.jsx';
import ClaimModal from './components/ClaimModal.jsx';
import ResetModal from './components/ResetModal.jsx';
import AcceptedTropesModal from './components/AcceptedTropesModal.jsx';
import AllTropesModal from './components/AllTropesModal.jsx';
import AllWagersModal from './components/AllWagersModal.jsx';
import ActivityFeedModal from './components/ActivityFeedModal.jsx';
import GameOverModal from './components/GameOverModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import ProposeReplaceModal from './components/ProposeReplaceModal.jsx';
import ManageWagersModal from './components/ManageWagersModal.jsx';
import JoinChoiceModal from './components/JoinChoiceModal.jsx';
import KickConfirmModal from './components/KickConfirmModal.jsx';
import ChangeNameModal from './components/ChangeNameModal.jsx';
import HelpModal from './components/HelpModal.jsx';
import GameMenu from './components/GameMenu.jsx';

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
  const [allWagersModalOpen, setAllWagersModalOpen] = useState(false);
  const [replaceProposal, setReplaceProposal] = useState(null);
  const [manageWagersOpen, setManageWagersOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [savedSession, setSavedSession] = useState(() => GameClient.getSavedSession());
  const [joinChoice, setJoinChoice] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [changeNameModalOpen, setChangeNameModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [vibrationMuted, setVibrationMutedState] = useState(() => isVibrationMuted());
  const [customTropeModalOpen, setCustomTropeModalOpen] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [browserOffline, setBrowserOffline] = useState(() => !navigator.onLine);
  const [bingoBanner, setBingoBanner] = useState(null);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const prevClaimIdRef = useRef(null);
  const gameStateRef = useRef(null);
  const myIdRef = useRef(null);
  const prevGameCodeRef = useRef(null);
  const prevBingoCountRef = useRef(0);
  const bingoBannerTimeoutRef = useRef(null);
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

  useEffect(() => {
    function handleOffline() { setBrowserOffline(true); }
    function handleOnline() { setBrowserOffline(false); }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Detects newly-completed bingo lines on my own board and fires the
  // celebration banner + sound once per new line (baseline resets whenever
  // the game code changes, so reconnecting mid-game doesn't re-celebrate
  // lines that were already completed before the reconnect).
  useEffect(() => {
    if (!gameState || !myId) return;
    const me = gameState.players[myId];
    if (!me) return;
    setHighlightedCells(getCompletedLineCells(me.marked));
    const lineCount = getCompletedLines(me.marked).length;
    if (prevGameCodeRef.current !== gameState.code) {
      prevGameCodeRef.current = gameState.code;
      prevBingoCountRef.current = lineCount;
      return;
    }
    if (lineCount > prevBingoCountRef.current) {
      setBingoBanner(`🎉 BINGO!${lineCount > 1 ? ` (${lineCount} lines!)` : ''}`);
      playBingoSound();
      vibrate(VIBRATE_PATTERN_BINGO);
      clearTimeout(bingoBannerTimeoutRef.current);
      bingoBannerTimeoutRef.current = setTimeout(() => setBingoBanner(null), 4000);
    }
    prevBingoCountRef.current = lineCount;
  }, [gameState, myId]);

  // Plays a notification tone when someone ELSE starts a new claim/vote.
  useEffect(() => {
    const claimId = gameState?.pendingClaim?.claimId || null;
    if (claimId && claimId !== prevClaimIdRef.current && gameState.pendingClaim.byId !== myId) {
      playNewClaimSound();
    }
    prevClaimIdRef.current = claimId;
  }, [gameState?.pendingClaim?.claimId, myId]);

  function toggleSoundMuted() {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundMutedState(next);
  }

  function toggleVibrationMuted() {
    const next = !vibrationMuted;
    setVibrationMuted(next);
    setVibrationMutedState(next);
  }

  function handleSendReaction(emoji) {
    clientRef.current.sendReaction(emoji);
  }

  function handleSubmitCustomTrope(text) {
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    clientRef.current.proposeCustomTrope(text);
    setCustomTropeModalOpen(false);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(gameState.code);
      showToast('Code copied to clipboard!');
    } catch {
      showToast('Could not copy — please copy it manually.');
    }
  }

  async function handleCopyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}?code=${gameState.code}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied to clipboard!');
    } catch {
      showToast('Could not copy — please copy it manually.');
    }
  }

  function handleEndGame() {
    clientRef.current.declareGameOver();
  }

  function handleConfirmEndGame() {
    setEndGameConfirmOpen(false);
    handleEndGame();
  }

  function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    handleLeaveGame();
  }

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
        gameStateRef.current = state;
        myIdRef.current = id;
      },
      onEvent: (evt) => {
        if (evt.type === 'claimResolved') {
          const undo = evt.kind === 'unmark';
          const replace = evt.kind === 'replace';
          const wagerChange = evt.kind === 'wagerChange';
          const mark = evt.kind === 'mark';
          const state = gameStateRef.current;
          const me = state && myIdRef.current ? state.players[myIdRef.current] : null;
          const affectsMe = mark && !!me && (evt.byId === myIdRef.current || me.board.includes(evt.text));
          if (evt.approved) {
            if (mark && affectsMe) {
              playPersonalMarkSound();
              vibrate(VIBRATE_PATTERN_MARK);
            } else {
              playApprovedSound();
            }
            if (replace) {
              showToast(
                evt.wagerFreed
                  ? `✅ "${evt.text}" was swapped out for a new trope! Your wager on it was freed up — pick a new space to wager.`
                  : `✅ "${evt.text}" was swapped out for a new trope!`,
              );
              if (evt.wagerFreed) setManageWagersOpen(true);
            } else if (wagerChange) {
              showToast('✅ Wager changes approved!');
            } else if (mark && evt.custom) {
              showToast(`📝 Custom trope "${evt.text}" was approved and added!`);
            } else {
              showToast(undo ? `✅ "${evt.text}" was unmarked.` : `✅ "${evt.text}" was confirmed and marked!`);
            }
          } else {
            playDeniedSound();
            showToast(wagerChange ? '❌ The proposed wager changes did not reach majority agreement.' : `❌ "${evt.text}" did not reach majority agreement.`);
          }
        } else if (evt.type === 'reaction') {
          const state = gameStateRef.current;
          const from = state?.players?.[evt.from];
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const entry = {
            id,
            emoji: evt.emoji,
            name: from ? `${from.avatar ? `${from.avatar} ` : ''}${from.name}` : 'Someone',
            offset: 10 + Math.random() * 80,
          };
          setReactions((prev) => [...prev, entry]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2600);
        } else if (evt.type === 'claimCancelled') {
          showToast(`"${evt.text}" claim was cancelled.`);
        } else if (evt.type === 'promotedToHost') {
          showToast('The host disconnected — you are now the host.');
        } else if (evt.type === 'gameReset') {
          showToast('The host reset the game — new boards have been dealt.');
          setGameOverModalOpen(false);
        } else if (evt.type === 'gameOver') {
          playGameOverSound();
          showToast('🏁 The game has ended — check out the recap!');
          setGameOverModalOpen(true);
        } else if (evt.type === 'connectionStatus') {
          setConnectionStatus(evt.status);
        } else if (evt.type === 'codeChanged') {
          showToast('A player was removed — the game code was rotated for security.');
        } else if (evt.type === 'kicked') {
          clientRef.current = null;
          setScreen('landing');
          setGameState(null);
          setMyId(null);
          setSavedSession(null);
          setError('You were removed from the game by the host.');
          setConnectionStatus('connected');
        }
      },
    });
    clientRef.current = client;
    return client;
  }

  async function handleHost(name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes, customTropes) {
    setError('');
    setBusy(true);
    try {
      const client = makeClient();
      await client.hostGame(name, genres, subgenreSelections, freeSpace, generalPercents, totalTropes, customTropes);
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

  function handleConfirmReset(genres, subgenreSelections, freeSpace, generalPercents, totalTropes, customTropes) {
    setResetModalOpen(false);
    clientRef.current.resetGame(genres, subgenreSelections, freeSpace, generalPercents, totalTropes, customTropes);
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

  function handleSubmitWagerChange(add, remove) {
    if (!add.length && !remove.length) return;
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    clientRef.current.proposeWagerChange(add, remove);
    setManageWagersOpen(false);
  }

  function handleKickPlayer(id, name) {
    setKickTarget({ id, name });
  }

  function handleConfirmKick() {
    clientRef.current.kickPlayer(kickTarget.id);
    setKickTarget(null);
  }

  function handleConfirmChangeName(name, avatar) {
    clientRef.current.changeName(name);
    clientRef.current.changeAvatar(avatar);
    setChangeNameModalOpen(false);
  }

  function handleLeaveGame() {
    clientRef.current?.leaveGame();
    clientRef.current = null;
    setScreen('landing');
    setGameState(null);
    setMyId(null);
    setSavedSession(null);
    setConnectionStatus('connected');
  }

  if (screen === 'landing' || !gameState) {
    return (
      <>
        {(connectionStatus === 'disconnected' || browserOffline) && (
          <div className="connection-banner">⚠️ Connection lost — trying to reconnect…</div>
        )}
        <header className="app-header">
          <h1>🎬 Movie/TV Trope Bingo</h1>
          <div className="header-actions">
            <button className="btn" onClick={toggleSoundMuted} aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}>
              {soundMuted ? '🔇' : '🔊'}
            </button>
            <button className="btn" onClick={toggleVibrationMuted} aria-label={vibrationMuted ? 'Unmute vibration' : 'Mute vibration'}>
              {vibrationMuted ? '📴' : '📳'}
            </button>
            <button className="btn" onClick={() => setHelpModalOpen(true)}>❓ Help</button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
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
        {helpModalOpen && <HelpModal onClose={() => setHelpModalOpen(false)} />}
      </>
    );
  }

  const me = gameState.players[myId];
  if (!me) return null;
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
      {(connectionStatus === 'disconnected' || browserOffline) && (
        <div className="connection-banner">⚠️ Connection lost — trying to reconnect…</div>
      )}
      {!focusMode && (
        <header className="app-header">
          <h1>🎬 Movie/TV Trope Bingo</h1>
          <div className="header-actions">
            <button className="btn" onClick={toggleSoundMuted} aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}>
              {soundMuted ? '🔇' : '🔊'}
            </button>
            <button className="btn" onClick={toggleVibrationMuted} aria-label={vibrationMuted ? 'Unmute vibration' : 'Mute vibration'}>
              {vibrationMuted ? '📴' : '📳'}
            </button>
            <button className="btn" onClick={() => setHelpModalOpen(true)}>❓ Help</button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </header>
      )}
      <BingoBanner message={bingoBanner} />
      <ReactionOverlay reactions={reactions} />
      <main id="app" className={focusMode ? 'focus-mode' : ''}>
        <section className="screen-game">
          {focusMode ? (
            <button className="btn focus-toggle-btn" onClick={() => setFocusMode(false)}>
              ✕ Unfocus
            </button>
          ) : (
            <div className="game-topbar">
              <div className="code-display">Code: {gameState.code}</div>
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
              <GameMenu
                open={menuOpen}
                onToggle={() => setMenuOpen((v) => !v)}
                onClose={() => setMenuOpen(false)}
                genreLabels={genreLabels}
                subgenreLabels={subgenreLabels}
                generalMixLabels={generalMixLabels}
                started={gameState.started}
                gameOver={gameState.gameOver}
                isHost={isHost}
                acceptedCount={gameState.acceptedTropes.length}
                tropePoolCount={gameState.tropePool.length}
                onShowAcceptedTropes={() => setTropesModalOpen(true)}
                onShowAssignWager={() => setManageWagersOpen(true)}
                onShowAllTropes={() => setAllTropesModalOpen(true)}
                onShowAllWagers={() => setAllWagersModalOpen(true)}
                onShowActivityFeed={() => setActivityFeedOpen(true)}
                onBoardFocus={() => setFocusMode(true)}
                onChangeName={() => setChangeNameModalOpen(true)}
                onResetGame={handleResetGame}
                onEndGame={() => setEndGameConfirmOpen(true)}
                onViewRecap={() => setGameOverModalOpen(true)}
                onLeaveGame={() => setLeaveConfirmOpen(true)}
                onCopyCode={handleCopyCode}
                onCopyInviteLink={handleCopyInviteLink}
                onSubmitCustomTrope={() => setCustomTropeModalOpen(true)}
              />
            </div>
          )}

          {!focusMode && gameState.started && (
            <ReactionBar onReact={handleSendReaction} />
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
                highlightedCells={highlightedCells}
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

      {allWagersModalOpen && (
        <AllWagersModal
          players={players}
          acceptedTropes={gameState.acceptedTropes}
          onClose={() => setAllWagersModalOpen(false)}
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

      {manageWagersOpen && (
        <ManageWagersModal
          board={me.board}
          wagered={me.wagered}
          marked={me.marked}
          freeSpaceIndex={gameState.freeSpace ? CENTER_INDEX : -1}
          onSubmit={handleSubmitWagerChange}
          onCancel={() => setManageWagersOpen(false)}
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
          currentAvatar={me.avatar}
          onConfirm={handleConfirmChangeName}
          onCancel={() => setChangeNameModalOpen(false)}
        />
      )}

      {activityFeedOpen && (
        <ActivityFeedModal
          activityLog={gameState.activityLog || []}
          onClose={() => setActivityFeedOpen(false)}
        />
      )}

      {gameOverModalOpen && (
        <GameOverModal
          players={players}
          onClose={() => setGameOverModalOpen(false)}
        />
      )}

      {leaveConfirmOpen && (
        <ConfirmModal
          title="Leave the game?"
          message="You'll be disconnected and returned to the home screen. You can rejoin later with the game code if it's still active."
          confirmLabel="🚪 Leave"
          onConfirm={handleConfirmLeave}
          onCancel={() => setLeaveConfirmOpen(false)}
        />
      )}

      {endGameConfirmOpen && (
        <ConfirmModal
          title="End the game?"
          message="This shows the final recap to everyone and stops further claims/wagers. You can still reset afterward to start a new game."
          confirmLabel="🏁 End Game"
          onConfirm={handleConfirmEndGame}
          onCancel={() => setEndGameConfirmOpen(false)}
        />
      )}

      {customTropeModalOpen && (
        <CustomTropeModal
          onSubmit={handleSubmitCustomTrope}
          onCancel={() => setCustomTropeModalOpen(false)}
        />
      )}

      {helpModalOpen && <HelpModal onClose={() => setHelpModalOpen(false)} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
