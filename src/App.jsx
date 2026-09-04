import { useEffect, useRef, useState, useCallback } from 'react';
import { GameClient } from './net/relay.js';
import { GENRES, SUBGENRES_BY_GENRE, CENTER_INDEX } from './data/tropes.js';
import { getCompletedLines, getCompletedLineCells } from './utils/bingoLines.js';
import {
  isSoundMuted,
  setSoundMuted,
  playNewClaimSound,
  playApprovedSound,
  playDeniedSound,
  playBingoSound,
  playGameOverSound,
  playPersonalMarkSound,
} from './utils/sound.js';
import { vibrate, VIBRATE_PATTERN_MARK, VIBRATE_PATTERN_BINGO, VIBRATE_PATTERN_VOTE_NEEDED } from './utils/haptics.js';
import { clearTabAlert, setTabAlert } from './utils/tabAlert.js';
import { loadTropeDescriptions } from './data/tropeDescriptions.js';
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
import TropeInfoModal from './components/TropeInfoModal.jsx';
import ProposeReplaceModal from './components/ProposeReplaceModal.jsx';
import ManageWagersModal from './components/ManageWagersModal.jsx';
import JoinChoiceModal from './components/JoinChoiceModal.jsx';
import JoinPendingModal from './components/JoinPendingModal.jsx';
import JoinRequestModal from './components/JoinRequestModal.jsx';
import KickConfirmModal from './components/KickConfirmModal.jsx';
import ChangeNameModal from './components/ChangeNameModal.jsx';
import HelpModal from './components/HelpModal.jsx';
import GameMenu from './components/GameMenu.jsx';
import InviteQrModal from './components/InviteQrModal.jsx';
import WagerIntroModal from './components/WagerIntroModal.jsx';
import HostTransferModal from './components/HostTransferModal.jsx';
import PlayerManagementModal from './components/PlayerManagementModal.jsx';
import ProfileChangeProposalModal from './components/ProfileChangeProposalModal.jsx';
import HostPromotionModal from './components/HostPromotionModal.jsx';

const MAX_WAGERS = 5;

function App() {
  const clientRef = useRef(null);
  const [screen, setScreen] = useState('landing');
  const [busy, setBusy] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
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
  const [wagerIntroOpen, setWagerIntroOpen] = useState(false);
  const [wageringEnabled, setWageringEnabled] = useState(false);
  const [advancedGameplay, setAdvancedGameplay] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [savedSession, setSavedSession] = useState(() => GameClient.getSavedSession());
  const [joinChoice, setJoinChoice] = useState(null);
  const [joinApprovalPending, setJoinApprovalPending] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [changeNameModalOpen, setChangeNameModalOpen] = useState(false);
  const [managedPlayer, setManagedPlayer] = useState(null);
  const [profileProposalTarget, setProfileProposalTarget] = useState(null);
  const [hostPromotion, setHostPromotion] = useState(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [hostTransferOpen, setHostTransferOpen] = useState(false);
  const [hostTransferLeaves, setHostTransferLeaves] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [inviteQrOpen, setInviteQrOpen] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [customTropeModalOpen, setCustomTropeModalOpen] = useState(false);
  const [boardSwapConfirmOpen, setBoardSwapConfirmOpen] = useState(false);
  const [tropeInfo, setTropeInfo] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [browserOffline, setBrowserOffline] = useState(() => !navigator.onLine);
  const [bingoBanner, setBingoBanner] = useState(null);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const loadingRequestRef = useRef(0);
  const prevClaimIdRef = useRef(null);
  const prevJoinRequestIdRef = useRef(null);
  const gameStateRef = useRef(null);
  const myIdRef = useRef(null);
  const prevGameCodeRef = useRef(null);
  const prevBingoCountsRef = useRef({});
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
    function handleOffline() {
      setBrowserOffline(true);
    }
    function handleOnline() {
      setBrowserOffline(false);
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Detects newly-completed bingo lines for every player from the replicated
  // marked arrays. Each client shows the celebration locally, with a different
  // message when the bingo belongs to someone else.
  useEffect(() => {
    if (!gameState || !myId) return;
    const me = gameState.players[myId];
    if (!me) return;
    setHighlightedCells(getCompletedLineCells(me.marked));
    const nextCounts = Object.fromEntries(
      Object.entries(gameState.players).map(([id, player]) => [id, getCompletedLines(player.marked).length]),
    );
    if (prevGameCodeRef.current !== gameState.code) {
      prevGameCodeRef.current = gameState.code;
      prevBingoCountsRef.current = nextCounts;
      return;
    }
    const previousCounts = prevBingoCountsRef.current;
    const newBingo = gameState.seatOrder
      .map((id) => ({
        id,
        player: gameState.players[id],
        count: nextCounts[id],
        previous: Object.prototype.hasOwnProperty.call(previousCounts, id) ? previousCounts[id] : nextCounts[id],
      }))
      .find(({ player, count, previous }) => player && count > previous);
    if (newBingo) {
      const multiple = newBingo.count > 1 ? ` (${newBingo.count} lines!)` : '';
      const name = newBingo.id === myId ? '' : ` for ${newBingo.player.name}`;
      setBingoBanner(`🎉 BINGO${name}!${multiple}`);
      playBingoSound();
      if (newBingo.id === myId) vibrate(VIBRATE_PATTERN_BINGO);
      clearTimeout(bingoBannerTimeoutRef.current);
      bingoBannerTimeoutRef.current = setTimeout(() => setBingoBanner(null), 4000);
    }
    prevBingoCountsRef.current = nextCounts;
  }, [gameState, myId]);

  // Alerts a player, on their device, that the group is waiting on their vote.
  useEffect(() => {
    const pending = gameState?.pendingClaim || null;
    const claimId = pending?.claimId || null;
    const needsMyVote =
      !!pending && pending.byId !== myId && !Object.prototype.hasOwnProperty.call(pending.votes, myId);
    if (claimId && claimId !== prevClaimIdRef.current && needsMyVote) {
      playNewClaimSound();
      vibrate(VIBRATE_PATTERN_VOTE_NEEDED);
    }
    prevClaimIdRef.current = claimId;
  }, [gameState?.pendingClaim?.claimId, myId]);

  // Same alert for the host, who is the one deciding on a mid-game join.
  useEffect(() => {
    const state = gameState;
    const amHost = !!state && state.seatOrder.find((id) => state.players[id]?.connected) === myId;
    const requesterId = amHost ? state?.pendingJoinRequest?.id || null : null;
    if (requesterId && requesterId !== prevJoinRequestIdRef.current) {
      playNewClaimSound();
      vibrate(VIBRATE_PATTERN_VOTE_NEEDED);
    }
    prevJoinRequestIdRef.current = requesterId;
  }, [gameState, myId]);

  // Keeps flashing the tab title for as long as the answer is outstanding.
  useEffect(() => {
    const state = gameState;
    const pending = state?.pendingClaim || null;
    const needsMyVote =
      !!pending && pending.byId !== myId && !Object.prototype.hasOwnProperty.call(pending.votes, myId);
    const amHost = !!state && state.seatOrder.find((id) => state.players[id]?.connected) === myId;
    const needsMyApproval = amHost && !!state?.pendingJoinRequest;
    if (needsMyVote || needsMyApproval) setTabAlert('🔔 Your answer is needed!');
    else clearTabAlert();
    return clearTabAlert;
  }, [gameState, myId]);

  // Fetch the explanations in the background once a game exists, so tapping a
  // space doesn't wait on a network round trip.
  useEffect(() => {
    if (gameState) loadTropeDescriptions().catch(() => {});
  }, [!gameState]);

  function toggleSoundMuted() {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundMutedState(next);
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

  async function handleCopyInviteLink() {
    const url = inviteUrl;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied to clipboard!');
    } catch {
      showToast('Could not copy — please copy it manually.');
    }
  }

  function handleShowInviteQr() {
    setInviteQrOpen(true);
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
    const remainingPlayers = Object.values(gameState?.players || {}).filter(
      (player) => player.id !== myId && player.connected,
    );
    if (isHost && remainingPlayers.length > 0) {
      setHostTransferLeaves(true);
      setHostTransferOpen(true);
    } else {
      handleLeaveGame();
    }
  }

  async function handleAssignHostAndLeave(targetId) {
    await clientRef.current?.addHost(targetId);
    setHostTransferOpen(false);
    handleLeaveGame();
  }

  async function handleAssignHost(targetId) {
    await clientRef.current?.addHost(targetId);
    setHostTransferOpen(false);
  }

  function handleResignHost() {
    clientRef.current?.resignHost();
  }

  function handleLeaveWithoutHostAssignment() {
    setHostTransferOpen(false);
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
          const reroll = evt.kind === 'reroll';
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
            } else if (reroll) {
              showToast(
                evt.byId === myIdRef.current
                  ? '🔀 Approved — here is your fresh board!'
                  : '🔀 A player was dealt a fresh board.',
              );
              if (evt.wagerFreed) setManageWagersOpen(true);
            } else if (mark && evt.custom) {
              showToast(`📝 Custom trope "${evt.text}" was approved and added!`);
            } else {
              showToast(undo ? `✅ "${evt.text}" was unmarked.` : `✅ "${evt.text}" was confirmed and marked!`);
            }
          } else {
            playDeniedSound();
            showToast(
              wagerChange
                ? '❌ The proposed wager changes did not reach majority agreement.'
                : reroll
                  ? '❌ The request for a fresh board did not reach majority agreement.'
                  : `❌ "${evt.text}" did not reach majority agreement.`,
            );
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
        } else if (evt.type === 'hostAdded') {
          setHostPromotion({ byName: evt.byName, byAvatar: evt.byAvatar });
        } else if (evt.type === 'gameReset') {
          showToast('The host reset the game — new boards have been dealt.');
          setGameOverModalOpen(false);
          setWageringEnabled(false);
          setAdvancedGameplay(false);
        } else if (evt.type === 'gameRestored') {
          showToast('Nobody else was still connected — your game was restored from where you left off.');
        } else if (evt.type === 'gameOver') {
          setSavedSession(null);
          playGameOverSound();
          showToast('🏁 The game has ended — check out the recap!');
          setGameOverModalOpen(true);
        } else if (evt.type === 'connectionStatus') {
          setConnectionStatus(evt.status);
        } else if (evt.type === 'codeChanged') {
          showToast('A player was removed — the game code was rotated for security.');
        } else if (evt.type === 'joinApproved') {
          setJoinApprovalPending(false);
          setScreen('game');
        } else if (evt.type === 'joinDenied') {
          clientRef.current = null;
          setJoinApprovalPending(false);
          setError(evt.reason || 'The host declined your request to join.');
          setConnectionStatus('connected');
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

  function discardClient() {
    clientRef.current?.destroy();
    clientRef.current = null;
    setConnectionStatus('connected');
  }

  async function handleHost(
    name,
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes,
    genrePercents,
    subgenrePercents,
  ) {
    const requestId = ++loadingRequestRef.current;
    setError('');
    setWageringEnabled(false);
    setAdvancedGameplay(false);
    setLoadingMessage('Creating game...');
    setBusy(true);
    try {
      const client = makeClient();
      await client.hostGame(
        name,
        genres,
        subgenreSelections,
        freeSpace,
        generalPercents,
        totalTropes,
        customTropes,
        genrePercents,
        subgenrePercents,
      );
      if (loadingRequestRef.current !== requestId) return;
      setScreen('game');
    } catch (err) {
      if (loadingRequestRef.current !== requestId) return;
      discardClient();
      setError(err.message || 'Could not host a game.');
    } finally {
      if (loadingRequestRef.current === requestId) {
        setBusy(false);
        setLoadingMessage('');
      }
    }
  }

  async function handleJoin(name, code) {
    setError('');
    setWageringEnabled(false);
    setAdvancedGameplay(false);
    if (code.length !== 4) {
      setError('Enter the 4-character game code.');
      return;
    }
    const requestId = ++loadingRequestRef.current;
    setLoadingMessage('Joining game...');
    setBusy(true);
    try {
      const client = makeClient();
      const result = await client.joinGame(code, name);
      if (loadingRequestRef.current !== requestId) return;
      if (result.needsChoice) {
        setJoinChoice({ name: result.name, options: result.options, allowNew: result.allowNew });
      } else if (result.needsApproval) {
        setJoinApprovalPending(true);
      } else {
        setScreen('game');
      }
    } catch (err) {
      if (loadingRequestRef.current !== requestId) return;
      discardClient();
      setError(err.message || 'Could not join that game.');
    } finally {
      if (loadingRequestRef.current === requestId) {
        setBusy(false);
        setLoadingMessage('');
      }
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
      discardClient();
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinAsNew() {
    setError('');
    setBusy(true);
    try {
      const result = await clientRef.current.confirmNewJoin(joinChoice.name);
      setJoinChoice(null);
      if (result.needsApproval) {
        setJoinApprovalPending(true);
      } else {
        setScreen('game');
      }
    } catch (err) {
      setError(err.message || 'Could not join that game.');
      setJoinChoice(null);
      discardClient();
    } finally {
      setBusy(false);
    }
  }

  function handleCancelJoinChoice() {
    clientRef.current?.destroy();
    clientRef.current = null;
    setJoinChoice(null);
    setConnectionStatus('connected');
  }

  function handleCancelJoinApproval() {
    clientRef.current?.destroy();
    clientRef.current = null;
    setJoinApprovalPending(false);
    setConnectionStatus('connected');
  }

  async function handleRejoin() {
    const requestId = ++loadingRequestRef.current;
    setError('');
    setLoadingMessage('Reconnecting to game...');
    setBusy(true);
    try {
      const client = makeClient();
      await client.rejoinGame();
      if (loadingRequestRef.current !== requestId) return;
      setScreen('game');
    } catch (err) {
      if (loadingRequestRef.current !== requestId) return;
      discardClient();
      setError(err.message || 'Could not reconnect to that game.');
      setSavedSession(GameClient.getSavedSession());
    } finally {
      if (loadingRequestRef.current === requestId) {
        setBusy(false);
        setLoadingMessage('');
      }
    }
  }

  function handleCancelLoading() {
    loadingRequestRef.current++;
    discardClient();
    setBusy(false);
    setLoadingMessage('');
  }

  function handleCellClick(index) {
    if (!gameState) return;
    if (gameState.freeSpace && index === CENTER_INDEX) return;
    const me = gameState.players[myId];

    if (!gameState.started) {
      const wagered = me.wagered.includes(index);
      setTropeInfo({
        text: me.board[index],
        marked: false,
        title: wageringEnabled ? (wagered ? 'Remove this wager?' : 'Wager this trope?') : 'Trope',
        actionHint: wageringEnabled
          ? wagered
            ? 'This removes the space from your wager picks before the game starts.'
            : `This adds the space to your wager picks before the game starts. You can wager up to ${MAX_WAGERS} spaces.`
          : 'You can read about this trope or propose swapping it out before the game starts.',
        confirmLabel: wageringEnabled ? (wagered ? '🎯 Remove wager' : '🎯 Wager this trope') : undefined,
        onConfirm: wageringEnabled ? () => handleTogglePregameWager(index) : null,
        onProposeSwap: () => handleProposeSwapFromInfo(me.board[index]),
      });
      return;
    }

    setTropeInfo({
      text: me.board[index],
      marked: me.marked.includes(index),
      onConfirm: () => handleConfirmTropeClaim(index),
      onProposeSwap: () => handleProposeSwapFromInfo(me.board[index]),
    });
  }

  function handleStartWagering() {
    setWagerIntroOpen(false);
    setWageringEnabled(true);
  }

  function handleSkipWagering() {
    setWagerIntroOpen(false);
    setWageringEnabled(false);
  }

  function handleTogglePregameWager(index) {
    setTropeInfo(null);
    if (!gameState || gameState.started) return;
    const me = gameState.players[myId];
    const pos = me.wagered.indexOf(index);
    const next = me.wagered.slice();
    if (pos !== -1) {
      next.splice(pos, 1);
    } else {
      if (next.length >= MAX_WAGERS) {
        showToast(`You can only wager ${MAX_WAGERS} spaces.`);
        return;
      }
      next.push(index);
    }
    clientRef.current.setWager(next);
  }

  function handleConfirmTropeClaim(index) {
    setTropeInfo(null);
    if (index == null) return;
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    clientRef.current.claim(index);
  }

  function handleAcceptedTropeInfo(text) {
    setTropeInfo({
      text,
      marked: true,
      title: 'Challenge this trope?',
      actionHint: 'This asks the group to vote on undoing this accepted trope.',
      confirmLabel: '👍 Challenge it',
      onConfirm: () => handleChallenge(text),
      onProposeSwap: () => handleProposeSwapFromInfo(text),
    });
  }

  function handlePoolTropeInfo(text, accepted) {
    setTropeInfo({
      text,
      marked: accepted,
      title: accepted ? 'Accepted trope' : 'Propose this trope?',
      actionHint: accepted
        ? 'The group already accepted this trope. You can still challenge it or propose swapping it out.'
        : "This asks the group to vote on marking it as having happened, even if it's not on your board.",
      confirmLabel: accepted ? '👍 Challenge it' : '👍 Propose it happened',
      onConfirm: () => (accepted ? handleChallenge(text) : handleProposeAccept(text)),
      onProposeSwap: () => handleProposeSwapFromInfo(text),
    });
  }

  function handleReadOnlyTropeInfo(text, accepted = false) {
    setTropeInfo({
      text,
      marked: accepted,
      title: accepted ? 'Accepted wagered trope' : 'Wagered trope',
      actionHint: accepted
        ? 'This wager has already been accepted by the group.'
        : 'This is one of the wagered tropes in this game.',
      onConfirm: null,
      onProposeSwap: () => handleProposeSwapFromInfo(text),
    });
  }

  function handleManagedWagerInfo({ text, marked, title, actionHint, confirmLabel, onConfirm }) {
    setTropeInfo({
      text,
      marked,
      title,
      actionHint,
      confirmLabel,
      onConfirm: () => {
        setTropeInfo(null);
        onConfirm();
      },
      onProposeSwap: () => handleProposeSwapFromInfo(text),
    });
  }

  function handleCloseTropeInfo() {
    setTropeInfo(null);
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
    setTropeInfo(null);
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
    setTropeInfo(null);
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
    setTropeInfo(null);
  }

  function handleProposeSwapFromInfo(text) {
    setTropeInfo(null);
    handleRequestReplace(text);
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

  function handleRequestBoardSwap() {
    if (gameState.pendingClaim) {
      showToast('A claim is already being voted on.');
      return;
    }
    setBoardSwapConfirmOpen(true);
  }

  function handleConfirmBoardSwap() {
    setBoardSwapConfirmOpen(false);
    clientRef.current.proposeBoardSwap();
  }

  function handleKickPlayer(id, name) {
    setKickTarget({ id, name });
  }

  function handleConfirmKick() {
    clientRef.current.kickPlayer(kickTarget.id);
    setKickTarget(null);
  }

  function handleApproveJoin() {
    clientRef.current.approveJoinRequest();
  }

  function handleDenyJoin() {
    clientRef.current.denyJoinRequest(false);
  }

  function handleDenyAndRotateJoin() {
    clientRef.current.denyJoinRequest(true);
  }

  function handleConfirmChangeName(name, avatar) {
    clientRef.current.changeName(name);
    clientRef.current.changeAvatar(avatar);
    setChangeNameModalOpen(false);
  }

  function handleManagePlayer(player) {
    if (isHost && player.id !== myId) setManagedPlayer(player);
  }

  function handleAddManagedHost() {
    clientRef.current?.addHost(managedPlayer.id);
    setManagedPlayer(null);
  }

  function handleOpenProfileProposal() {
    setProfileProposalTarget(managedPlayer);
    setManagedPlayer(null);
  }

  function handleProposeProfileChange(name, avatar) {
    clientRef.current?.proposeProfileChange(profileProposalTarget.id, name, avatar);
    setProfileProposalTarget(null);
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
            <button className="btn" onClick={() => setHelpModalOpen(true)}>
              ❓ Help
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </header>
        <main id="app">
          <Landing
            onHost={handleHost}
            onJoin={handleJoin}
            error={error}
            onDismissError={() => setError('')}
            busy={busy}
            loadingMessage={loadingMessage}
            onCancelLoading={handleCancelLoading}
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
        {joinApprovalPending && <JoinPendingModal onCancel={handleCancelJoinApproval} />}
        {helpModalOpen && <HelpModal onClose={() => setHelpModalOpen(false)} />}
      </>
    );
  }

  const me = gameState.players[myId];
  if (!me) return null;
  const players = Object.values(gameState.players).sort((a, b) => a.seat - b.seat);
  const activePlayerCount = players.filter((player) => player.connected).length;
  const bingoCounts = Object.fromEntries(players.map((p) => [p.id, getCompletedLines(p.marked).length]));
  const hostIds = gameState.hostIds?.length ? gameState.hostIds : [gameState.seatOrder[0]];
  const isHost = hostIds.includes(myId);
  const genreLabels = gameState.genres.map((id) => GENRES.find((g) => g.id === id)?.label || id).join(', ');
  const subgenreLabels = gameState.subgenreSelections.length
    ? gameState.subgenreSelections
        .map((s) => (SUBGENRES_BY_GENRE[s.genre] || []).find((sg) => sg.id === s.subgenre)?.label || s.subgenre)
        .join(', ')
    : 'Classic / Mixed only';
  const generalMixLabels = gameState.genres
    .filter((id) => gameState.subgenreSelections.some((selection) => selection.genre === id))
    .map((id) => `${GENRES.find((g) => g.id === id)?.label || id} ${gameState.generalPercents[id]}%`)
    .join(', ');
  const inviteUrl = `${window.location.origin}${window.location.pathname}?code=${gameState.code}`;

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
            <button className="btn" onClick={() => setHelpModalOpen(true)}>
              ❓ Help
            </button>
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
                  : 'Waiting for players — the host can start when everyone is ready.'}
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
                onResignHost={handleResignHost}
                hostCount={hostIds.length}
                onResetGame={handleResetGame}
                onEndGame={() => setEndGameConfirmOpen(true)}
                onViewRecap={() => setGameOverModalOpen(true)}
                onLeaveGame={() => setLeaveConfirmOpen(true)}
                onCopyInviteLink={handleCopyInviteLink}
                onShowInviteQr={handleShowInviteQr}
                advancedGameplay={advancedGameplay}
                onToggleAdvancedGameplay={() => setAdvancedGameplay((enabled) => !enabled)}
                onSubmitCustomTrope={() => setCustomTropeModalOpen(true)}
                onRequestBoardSwap={handleRequestBoardSwap}
              />
            </div>
          )}

          {!focusMode && gameState.started && <ReactionBar onReact={handleSendReaction} />}

          <div className="game-layout">
            {!focusMode && (
              <PlayersPanel
                players={players}
                hostIds={hostIds}
                myId={myId}
                isHost={isHost}
                wagerCount={me.wagered.length}
                maxWagers={MAX_WAGERS}
                started={gameState.started}
                bingoCounts={bingoCounts}
                onKick={handleKickPlayer}
                onEditSelf={() => setChangeNameModalOpen(true)}
                onManagePlayer={handleManagePlayer}
                wageringEnabled={wageringEnabled}
                onOpenWagerIntro={() => setWagerIntroOpen(true)}
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

      {wagerIntroOpen && <WagerIntroModal onAddWagers={handleStartWagering} onSkip={handleSkipWagering} />}

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

      {inviteQrOpen && <InviteQrModal inviteUrl={inviteUrl} onClose={() => setInviteQrOpen(false)} />}

      {tropesModalOpen && (
        <AcceptedTropesModal
          acceptedTropes={gameState.acceptedTropes}
          onTropeClick={handleAcceptedTropeInfo}
          onClose={() => setTropesModalOpen(false)}
        />
      )}

      {allTropesModalOpen && (
        <AllTropesModal
          tropePool={gameState.tropePool}
          acceptedTropes={gameState.acceptedTropes}
          onTropeClick={handlePoolTropeInfo}
          onClose={() => setAllTropesModalOpen(false)}
        />
      )}

      {allWagersModalOpen && (
        <AllWagersModal
          players={players}
          acceptedTropes={gameState.acceptedTropes}
          onTropeClick={handleReadOnlyTropeInfo}
          onClose={() => setAllWagersModalOpen(false)}
        />
      )}

      {replaceProposal && (
        <ProposeReplaceModal
          text={replaceProposal.text}
          defaultGenre={gameState.genres[0]}
          defaultSubgenre="general"
          playerCount={activePlayerCount}
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
          playerCount={activePlayerCount}
          onSubmit={handleSubmitWagerChange}
          onTropeClick={handleManagedWagerInfo}
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

      {isHost && gameState.pendingJoinRequest && (
        <JoinRequestModal
          name={gameState.pendingJoinRequest.name}
          onApprove={handleApproveJoin}
          onDeny={handleDenyJoin}
          onDenyAndRotate={handleDenyAndRotateJoin}
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

      {managedPlayer && (
        <PlayerManagementModal
          player={managedPlayer}
          isHost={hostIds.includes(managedPlayer.id)}
          onAddHost={handleAddManagedHost}
          onProposeProfile={handleOpenProfileProposal}
          onCancel={() => setManagedPlayer(null)}
        />
      )}

      {profileProposalTarget && (
        <ChangeNameModal
          currentName={profileProposalTarget.name}
          currentAvatar={profileProposalTarget.avatar}
          title={`Propose a name & avatar for ${profileProposalTarget.name}`}
          confirmLabel="Send Proposal"
          onConfirm={handleProposeProfileChange}
          onCancel={() => setProfileProposalTarget(null)}
        />
      )}

      {gameState.pendingProfileChanges?.[myId] && (
        <ProfileChangeProposalModal
          proposal={gameState.pendingProfileChanges[myId]}
          onAccept={() => clientRef.current?.respondToProfileChange(true)}
          onDecline={() => clientRef.current?.respondToProfileChange(false)}
        />
      )}

      {hostPromotion && (
        <HostPromotionModal
          promotedBy={hostPromotion.byName}
          promotedByAvatar={hostPromotion.byAvatar}
          onClose={() => setHostPromotion(null)}
        />
      )}

      {activityFeedOpen && (
        <ActivityFeedModal activityLog={gameState.activityLog || []} onClose={() => setActivityFeedOpen(false)} />
      )}

      {gameOverModalOpen && (
        <GameOverModal players={players} bingoCounts={bingoCounts} onClose={() => setGameOverModalOpen(false)} />
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

      {hostTransferOpen && (
        <HostTransferModal
          players={players.filter((player) => player.id !== myId && player.connected && !hostIds.includes(player.id))}
          onAssign={hostTransferLeaves ? handleAssignHostAndLeave : handleAssignHost}
          onLeaveWithoutAssign={hostTransferLeaves ? handleLeaveWithoutHostAssignment : undefined}
          onCancel={() => setHostTransferOpen(false)}
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
          playerCount={activePlayerCount}
          onSubmit={handleSubmitCustomTrope}
          onCancel={() => setCustomTropeModalOpen(false)}
        />
      )}

      {tropeInfo && (
        <TropeInfoModal
          text={tropeInfo.text}
          marked={tropeInfo.marked}
          title={tropeInfo.title}
          actionHint={tropeInfo.actionHint}
          confirmLabel={tropeInfo.confirmLabel}
          playerCount={activePlayerCount}
          onConfirm={tropeInfo.onConfirm}
          onCancel={handleCloseTropeInfo}
          onProposeSwap={tropeInfo.onProposeSwap}
        />
      )}

      {boardSwapConfirmOpen && (
        <ConfirmModal
          title={activePlayerCount === 1 ? 'Swap for a fresh board?' : 'Ask for a fresh board?'}
          message={
            activePlayerCount === 1
              ? 'This re-deals your 25 spaces from the same trope pool. Tropes already accepted stay marked, and your current wagers are cleared so you can re-place them.'
              : 'The other players vote on this. If they agree, your 25 spaces are re-dealt from the same trope pool — tropes the group already accepted stay marked, and your current wagers are cleared so you can re-place them.'
          }
          confirmLabel={activePlayerCount === 1 ? '🔀 Confirm' : '🔀 Ask the group'}
          onConfirm={handleConfirmBoardSwap}
          onCancel={() => setBoardSwapConfirmOpen(false)}
        />
      )}

      {helpModalOpen && <HelpModal onClose={() => setHelpModalOpen(false)} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
