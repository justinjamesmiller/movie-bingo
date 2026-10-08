import { useEffect, useRef, useState, useCallback } from 'react';
import { version as appVersion } from '../package.json';
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
import FinaleBanner from './components/FinaleBanner.jsx';
import ReactionBar from './components/ReactionBar.jsx';
import ReactionOverlay from './components/ReactionOverlay.jsx';
import CustomTropeModal from './components/CustomTropeModal.jsx';
import ClaimModal from './components/ClaimModal.jsx';
import ClaimQueueModal from './components/ClaimQueueModal.jsx';
import AccessibilityModal from './components/AccessibilityModal.jsx';
import ResetModal from './components/ResetModal.jsx';
import AcceptedTropesModal from './components/AcceptedTropesModal.jsx';
import AllTropesModal from './components/AllTropesModal.jsx';
import AllWagersModal from './components/AllWagersModal.jsx';
import ActivityFeedModal from './components/ActivityFeedModal.jsx';
import GameOverModal from './components/GameOverModal.jsx';
import CallInfoModal from './components/CallInfoModal.jsx';
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
import GuidedTutorial from './components/GuidedTutorial.jsx';
import GameMenu from './components/GameMenu.jsx';
import InviteQrModal from './components/InviteQrModal.jsx';
import WagerIntroModal from './components/WagerIntroModal.jsx';
import HostTransferModal from './components/HostTransferModal.jsx';
import PlayerManagementModal from './components/PlayerManagementModal.jsx';
import ProfileChangeProposalModal from './components/ProfileChangeProposalModal.jsx';
import HostPromotionModal from './components/HostPromotionModal.jsx';
import SessionLifetimeModal from './components/SessionLifetimeModal.jsx';
import HostRecoveryPasswordModal from './components/HostRecoveryPasswordModal.jsx';
import MovieIdentityModal from './components/MovieIdentityModal.jsx';
import ReplacementPickerModal from './components/ReplacementPickerModal.jsx';
import SuperlativeModal from './components/SuperlativeModal.jsx';
import { formatPlayerName } from './utils/playerName.js';
import MarathonStandingsModal from './components/MarathonStandingsModal.jsx';
import PlayerStatsModal from './components/PlayerStatsModal.jsx';
import StatsDashboardModal from './components/StatsDashboardModal.jsx';
import TropeAdvancedActionsModal from './components/TropeAdvancedActionsModal.jsx';
import { getPlayerSuperlatives } from './utils/superlatives.js';
import { getGameTheme } from './utils/gameTheme.js';

const MAX_WAGERS = 5;
const CONNECTION_LOST_GRACE_MS = 4000;
const TUTORIAL_PREFERENCE_KEY = 'bingo-tutorial-enabled';
const ACCESSIBILITY_KEY = 'bingo-accessibility';

function initialTheme() {
  try {
    const saved = localStorage.getItem('bingo-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Theme preference is optional; blocked storage should not prevent startup.
  }
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function initialAccessibility() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  return Object.fromEntries(
    ['largeText', 'listView', 'showStateLabels', 'reduceMotion'].map((key) => [key, saved[key] === true]),
  );
}

function initialTutorialPreference() {
  try {
    return localStorage.getItem(TUTORIAL_PREFERENCE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function formatNameList(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function blurActiveTextField() {
  const activeElement = document.activeElement;
  if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') activeElement.blur();
}

function formatApprovedBy(approvedBy) {
  const names = (approvedBy || []).map((player) => formatPlayerName(player)).filter(Boolean);
  return names.length > 0 ? ` Approved by ${formatNameList(names)}.` : '';
}

function formatDisagreeRationales(counts) {
  const reasons = Object.entries(counts || {}).map(([reason, count]) => `${reason} (${count})`);
  return reasons.length > 0 ? ` Reasons: ${reasons.join(', ')}.` : '';
}

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
  const [claimQueueOpen, setClaimQueueOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibility, setAccessibility] = useState(initialAccessibility);
  const [allWagersModalOpen, setAllWagersModalOpen] = useState(false);
  const [replaceProposal, setReplaceProposal] = useState(null);
  const [manageWagersOpen, setManageWagersOpen] = useState(false);
  const [wagerIntroOpen, setWagerIntroOpen] = useState(false);
  const [wageringEnabled, setWageringEnabled] = useState(false);
  const [advancedGameplay, setAdvancedGameplay] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [savedSession, setSavedSession] = useState(() => GameClient.getSavedSession());
  const [savedSessionStatus, setSavedSessionStatus] = useState(() =>
    GameClient.getSavedSession() ? 'checking' : 'none',
  );
  const [joinChoice, setJoinChoice] = useState(null);
  const [joinApprovalPending, setJoinApprovalPending] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [changeNameModalOpen, setChangeNameModalOpen] = useState(false);
  const [managedPlayer, setManagedPlayer] = useState(null);
  const [profileProposalTarget, setProfileProposalTarget] = useState(null);
  const [hostPromotion, setHostPromotion] = useState(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [tutorialEnabled, setTutorialEnabled] = useState(initialTutorialPreference);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialRun, setTutorialRun] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [hostTransferOpen, setHostTransferOpen] = useState(false);
  const [hostTransferLeaves, setHostTransferLeaves] = useState(false);
  const [sessionLifetimeModalOpen, setSessionLifetimeModalOpen] = useState(false);
  const [hostRecoveryPasswordOpen, setHostRecoveryPasswordOpen] = useState(false);
  const [movieIdentityModalOpen, setMovieIdentityModalOpen] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [inviteQrOpen, setInviteQrOpen] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [customTropeModalOpen, setCustomTropeModalOpen] = useState(false);
  const [boardSwapConfirmOpen, setBoardSwapConfirmOpen] = useState(false);
  const [tropeInfo, setTropeInfo] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [connectionLost, setConnectionLost] = useState(false);
  const [reconnectCancelled, setReconnectCancelled] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(() => !navigator.onLine);
  const [bingoBanner, setBingoBanner] = useState(null);
  const [finaleBanner, setFinaleBanner] = useState(false);
  const [highlightedCells, setHighlightedCells] = useState(new Set());
  const [superlativeInfo, setSuperlativeInfo] = useState(null);
  const [callInfoPlayer, setCallInfoPlayer] = useState(null);
  const [marathonStandingsOpen, setMarathonStandingsOpen] = useState(false);
  const [playerStatsTargetId, setPlayerStatsTargetId] = useState(null);
  const [statsDashboardOpen, setStatsDashboardOpen] = useState(false);
  const [tropeAdvancedActions, setTropeAdvancedActions] = useState(null);
  const [missedCall, setMissedCall] = useState(null);
  const loadingRequestRef = useRef(0);
  const prevClaimIdRef = useRef(null);
  const prevJoinRequestIdRef = useRef(null);
  const gameStateRef = useRef(null);
  const myIdRef = useRef(null);
  const bingoBannerTimeoutRef = useRef(null);
  const bingoBannerIdRef = useRef(0);
  const finaleBannerTimeoutRef = useRef(null);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('bingo-theme', theme);
    } catch {
      // Theme preference is optional; blocked storage should not break toggling.
    }
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle('large-text', accessibility.largeText);
    document.body.classList.toggle('reduce-motion', accessibility.reduceMotion);
    try {
      localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(accessibility));
    } catch {
      return;
    }
    return () => {
      document.body.classList.remove('large-text', 'reduce-motion');
    };
  }, [accessibility]);

  useEffect(() => {
    const gameTheme = gameState
      ? getGameTheme(
          gameState.movie?.themeGenres || gameState.genres,
          gameState.movie?.themeSubgenreSelections || gameState.subgenreSelections,
          theme,
        )
      : null;
    if (gameTheme) {
      document.body.style.setProperty('--theme-accent', gameTheme.accent);
      document.body.style.setProperty('--theme-accent-hover', gameTheme.accentHover);
    } else {
      document.body.style.removeProperty('--theme-accent');
      document.body.style.removeProperty('--theme-accent-hover');
    }
  }, [gameState?.genres, gameState?.subgenreSelections, gameState?.movie, theme]);

  useEffect(() => {
    return () => clientRef.current?.destroy();
  }, []);

  useEffect(() => {
    return () => clearTimeout(finaleBannerTimeoutRef.current);
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

  useEffect(() => {
    let current = true;
    if (!savedSession) {
      setSavedSessionStatus('none');
      return () => {
        current = false;
      };
    }
    if (browserOffline) {
      setSavedSessionStatus('unavailable');
      return () => {
        current = false;
      };
    }
    setSavedSessionStatus('checking');
    GameClient.isSavedSessionActive(savedSession)
      .then((active) => {
        if (!current) return;
        if (active) {
          setSavedSessionStatus('active');
        } else {
          GameClient.clearSavedSession();
          setSavedSession(null);
          setSavedSessionStatus('none');
        }
      })
      .catch(() => {
        if (current) setSavedSessionStatus('unavailable');
      });
    return () => {
      current = false;
    };
  }, [savedSession, browserOffline]);

  // Only surface a drop that persists -- a transient websocket blip usually
  // heals within a second or two and isn't worth alarming the table over.
  useEffect(() => {
    const lost = connectionStatus === 'disconnected' || browserOffline;
    if (!lost) {
      setConnectionLost(false);
      return undefined;
    }
    const timer = setTimeout(() => setConnectionLost(true), CONNECTION_LOST_GRACE_MS);
    return () => clearTimeout(timer);
  }, [connectionStatus, browserOffline]);

  useEffect(() => {
    setTutorialActive(tutorialEnabled && screen === 'game' && !gameState?.gameOver);
  }, [screen, gameState?.started, gameState?.gameOver, tutorialEnabled]);

  function saveTutorialPreference(enabled) {
    setTutorialEnabled(enabled);
    try {
      localStorage.setItem(TUTORIAL_PREFERENCE_KEY, String(enabled));
    } catch {
      return;
    }
  }

  function pauseTutorial() {
    setTutorialActive(false);
    document.querySelector('[data-tutorial="menu"]')?.focus({ preventScroll: true });
  }

  function startTutorial() {
    saveTutorialPreference(true);
    setTutorialRun((run) => run + 1);
    setTutorialActive(true);
    setFocusMode(false);
  }

  // Highlights every completed line on the local board.
  useEffect(() => {
    if (!gameState || !myId) return;
    const me = gameState.players[myId];
    if (!me) return;
    setHighlightedCells(getCompletedLineCells(me.marked));
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

  function handleSubmitCustomTrope(text, sceneContext) {
    clientRef.current.proposeCustomTrope(text, sceneContext);
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

  function handleResumeGame() {
    clientRef.current.resumeGame();
  }

  function handleUpdateSessionLifetime(extended, hours) {
    clientRef.current.updateSessionLifetime(extended, hours);
    setSessionLifetimeModalOpen(false);
  }

  function handleUpdateMovie(movie) {
    clientRef.current.updateMovie(movie);
    setMovieIdentityModalOpen(false);
  }

  function handleChooseReplacement(text) {
    clientRef.current.chooseReplacement(text);
  }

  function handleCycleReplacement() {
    clientRef.current.cycleReplacement();
  }

  function handleCancelReplacement() {
    clientRef.current.cancelReplacement();
  }

  function handleConfirmEndGame() {
    setEndGameConfirmOpen(false);
    handleEndGame();
  }

  function handleDismissFinaleBanner() {
    clearTimeout(finaleBannerTimeoutRef.current);
    setFinaleBanner(false);
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
    let previousBingoCounts = null;
    let previousBingoCode = null;
    const client = new GameClient({
      onState: (state, id) => {
        const nextCounts = Object.fromEntries(
          Object.entries(state.players).map(([playerId, player]) => [
            playerId,
            getCompletedLines(player.marked).length,
          ]),
        );
        const completions =
          previousBingoCounts && previousBingoCode === state.code
            ? state.seatOrder
                .map((playerId) => ({ playerId, player: state.players[playerId], count: nextCounts[playerId] }))
                .filter(({ playerId, player, count }) => player && count > (previousBingoCounts[playerId] ?? count))
            : [];
        const completion = completions.find((event) => event.playerId === id) || completions[0];
        previousBingoCounts = nextCounts;
        previousBingoCode = state.code;
        if (completion) {
          const name = completion.playerId === id ? '' : ` for ${formatPlayerName(completion.player)}`;
          bingoBannerIdRef.current += 1;
          setBingoBanner({
            id: bingoBannerIdRef.current,
            message: `🎉 BINGO${name}!${completion.count > 1 ? ` (${completion.count} lines!)` : ''}`,
          });
          playBingoSound();
          if (completion.playerId === id) vibrate(VIBRATE_PATTERN_BINGO);
          clearTimeout(bingoBannerTimeoutRef.current);
          bingoBannerTimeoutRef.current = setTimeout(() => setBingoBanner(null), 4000);
        }
        setGameState({ ...state });
        setMyId(id);
        setMissedCall((previous) =>
          previous && state.started && !state.gameOver && state.calls?.[id] === previous.text ? previous : null,
        );
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
          const missed = evt.approved && mark && evt.missedCalls?.find((call) => call.playerId === myIdRef.current);
          if (missed) setMissedCall({ text: missed.text, acceptedText: evt.text });
          if (evt.approved) {
            const approvedByText = formatApprovedBy(evt.approvedBy);
            if (mark && affectsMe) {
              playPersonalMarkSound();
              vibrate(VIBRATE_PATTERN_MARK);
            } else {
              playApprovedSound();
            }
            if (replace) {
              showToast(
                evt.wagerFreed
                  ? `✅ "${evt.text}" was approved for replacement.${approvedByText} Your wager will be freed when the proposer confirms a new trope.`
                  : `✅ "${evt.text}" was approved for replacement.${approvedByText}`,
              );
              if (evt.wagerFreed) setManageWagersOpen(true);
            } else if (wagerChange) {
              showToast(`✅ Wager changes approved!${approvedByText}`);
            } else if (reroll) {
              showToast(
                evt.byId === myIdRef.current
                  ? `🔀 Approved — here is your fresh board!${approvedByText}`
                  : `🔀 A player was dealt a fresh board.${approvedByText}`,
              );
              if (evt.wagerFreed) setManageWagersOpen(true);
            } else if (mark && evt.custom) {
              showToast(`📝 Custom trope "${evt.text}" was approved and added!${approvedByText}`);
            } else {
              showToast(
                undo
                  ? `✅ "${evt.text}" was unmarked.${approvedByText}`
                  : `✅ "${evt.text}" was confirmed and marked!${approvedByText}`,
              );
            }
          } else {
            playDeniedSound();
            showToast(
              wagerChange
                ? '❌ The proposed wager changes did not reach majority agreement.'
                : reroll
                  ? '❌ The request for a fresh board did not reach majority agreement.'
                  : `❌ "${evt.text}" did not reach majority agreement.${formatDisagreeRationales(evt.disagreeRationaleCounts)}`,
            );
          }
        } else if (evt.type === 'proposalRejected') {
          showToast(evt.message);
        } else if (evt.type === 'stateConflict') {
          showToast('Another host saved newer game state. Your change was not saved; please retry.');
        } else if (evt.type === 'relayError') {
          showToast(evt.message || 'The secure game relay rejected an update.');
        } else if (evt.type === 'reaction') {
          const state = gameStateRef.current;
          const from = state?.players?.[evt.from];
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const entry = {
            id,
            emoji: evt.emoji,
            name: from ? formatPlayerName(from) : 'Someone',
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
          setMissedCall(null);
          showToast('The host reset the game — new boards have been dealt.');
          setGameOverModalOpen(false);
          setWageringEnabled(false);
          setAdvancedGameplay(false);
        } else if (evt.type === 'gameRestored') {
          showToast('Nobody else was still connected — your game was restored from where you left off.');
        } else if (evt.type === 'gameOver') {
          setSavedSession(null);
          playGameOverSound();
          setFinaleBanner(true);
          clearTimeout(finaleBannerTimeoutRef.current);
          finaleBannerTimeoutRef.current = setTimeout(() => setFinaleBanner(false), 5000);
          showToast('🏁 The game has ended — check out the recap!');
          setGameOverModalOpen(true);
        } else if (evt.type === 'gameResumed') {
          setSavedSession(GameClient.getSavedSession());
          setFinaleBanner(false);
          clearTimeout(finaleBannerTimeoutRef.current);
          showToast('▶️ The game was resumed — after-credits tropes are back in play.');
          setGameOverModalOpen(false);
        } else if (evt.type === 'sessionLifetimeUpdated') {
          showToast(`Session countdown restarted for ${evt.hours} hours.`);
        } else if (evt.type === 'sessionExpired') {
          setScreen('landing');
          setGameState(null);
          setMyId(null);
          setSavedSession(null);
          setError('This game session expired while everyone was away.');
          setConnectionStatus('connected');
        } else if (evt.type === 'replacementResolved' && evt.wagerFreed) {
          setManageWagersOpen(true);
        } else if (evt.type === 'connectionStatus') {
          setConnectionStatus(evt.status);
          if (evt.status === 'connected') setReconnectCancelled(false);
        } else if (evt.type === 'reconnectCancelled') {
          setReconnectCancelled(true);
        } else if (evt.type === 'reconnectStarted') {
          setReconnectCancelled(false);
        } else if (evt.type === 'codeChanged') {
          showToast('A player was removed — the game code was rotated for security.');
        } else if (evt.type === 'joinApproved') {
          setJoinApprovalPending(false);
          blurActiveTextField();
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
    movie,
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
        movie,
      );
      if (loadingRequestRef.current !== requestId) return;
      blurActiveTextField();
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

  async function handleJoin(name, code, hostRecoveryPassword) {
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
      const result = await client.joinGame(code, name, hostRecoveryPassword);
      if (loadingRequestRef.current !== requestId) return;
      if (result.needsChoice) {
        setJoinChoice({ name: result.name, options: result.options, allowNew: result.allowNew });
      } else if (result.needsApproval) {
        setJoinApprovalPending(true);
      } else {
        blurActiveTextField();
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

  async function handleSetHostRecoveryPassword(password) {
    try {
      await clientRef.current.setHostRecoveryPassword(password);
      setHostRecoveryPasswordOpen(false);
      showToast('Host recovery password saved. Keep it somewhere safe.');
    } catch (err) {
      showToast(err.message || 'Could not save the host recovery password.');
    }
  }

  async function handleClaimSeat(seatId) {
    setError('');
    setBusy(true);
    try {
      await clientRef.current.claimDisconnectedSeat(seatId, joinChoice.name);
      setJoinChoice(null);
      blurActiveTextField();
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
        blurActiveTextField();
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
      blurActiveTextField();
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
    recordTropeView(me.board[index]);

    if (!gameState.started) {
      const wagered = me.wagered.includes(index);
      const accepted = gameState.acceptedTropes.includes(me.board[index]);
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
        onProposeSwap: accepted ? undefined : () => handleProposeSwapFromInfo(me.board[index]),
      });
      return;
    }

    setTropeInfo({
      text: me.board[index],
      marked: me.marked.includes(index),
      onConfirm: (sceneContext) => handleConfirmTropeClaim(index, sceneContext),
      onAdvancedActions: gameState.acceptedTropes.includes(me.board[index])
        ? undefined
        : () => setTropeAdvancedActions({ text: me.board[index] }),
    });
  }

  function recordTropeView(text) {
    clientRef.current?.recordTropeView(text);
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

  function handleConfirmTropeClaim(index, sceneContext) {
    setTropeInfo(null);
    if (index == null) return;
    clientRef.current.claim(index, sceneContext);
  }

  function handleAcceptedTropeInfo(text) {
    recordTropeView(text);
    setTropeInfo({
      text,
      marked: true,
      title: 'Challenge this trope?',
      actionHint: 'This asks the group to vote on undoing this accepted trope.',
      confirmLabel: '👍 Challenge it',
      onConfirm: (sceneContext) => handleChallenge(text, sceneContext),
    });
  }

  function handlePoolTropeInfo(text, accepted) {
    recordTropeView(text);
    setTropeInfo({
      text,
      marked: accepted,
      title: accepted ? 'Accepted trope' : 'Propose this trope?',
      actionHint: accepted
        ? 'The group already accepted this trope. You can still challenge it.'
        : "This asks the group to vote on marking it as having happened, even if it's not on your board.",
      confirmLabel: accepted ? '👍 Challenge it' : '👍 Propose it happened',
      onConfirm: (sceneContext) =>
        accepted ? handleChallenge(text, sceneContext) : handleProposeAccept(text, sceneContext),
      onProposeSwap: accepted ? undefined : () => handleProposeSwapFromInfo(text),
    });
  }

  function handleReadOnlyTropeInfo(text, accepted = false) {
    recordTropeView(text);
    setTropeInfo({
      text,
      marked: accepted,
      title: accepted ? 'Accepted wagered trope' : 'Wagered trope',
      actionHint: accepted
        ? 'This wager has already been accepted by the group.'
        : 'This is one of the wagered tropes in this game.',
      onConfirm: null,
      onProposeSwap: accepted ? undefined : () => handleProposeSwapFromInfo(text),
    });
  }

  function handleManagedWagerInfo({ text, marked, title, actionHint, confirmLabel, onConfirm }) {
    recordTropeView(text);
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
      onProposeSwap: marked ? undefined : () => handleProposeSwapFromInfo(text),
    });
  }

  function handleCloseTropeInfo() {
    setTropeInfo(null);
  }

  function handleResetGame() {
    setResetModalOpen(true);
  }

  function handleConfirmReset(
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes,
    genrePercents,
    subgenrePercents,
    movie,
  ) {
    setResetModalOpen(false);
    clientRef.current.resetGame(
      genres,
      subgenreSelections,
      freeSpace,
      generalPercents,
      totalTropes,
      customTropes,
      genrePercents,
      subgenrePercents,
      movie,
    );
  }

  function handleChallenge(text, sceneContext) {
    clientRef.current.challengeTrope(text, sceneContext);
    setTropeInfo(null);
  }

  function handleRequestReplace(text) {
    if (!gameState || !text) return;
    setReplaceProposal({ text });
  }

  function handleConfirmReplace(genre, subgenre, sceneContext) {
    clientRef.current.proposeReplace(replaceProposal.text, genre, subgenre, sceneContext);
    setReplaceProposal(null);
    setTropeInfo(null);
  }

  function handleCancelReplace() {
    setReplaceProposal(null);
  }

  function handleProposeAccept(text, sceneContext) {
    if (!gameState) return;
    clientRef.current.proposeAccept(text, sceneContext);
    setTropeInfo(null);
  }

  function handleProposeSwapFromInfo(text) {
    setTropeInfo(null);
    handleRequestReplace(text);
  }

  function handleToggleCall(text) {
    clientRef.current.toggleCall(text);
    setTropeAdvancedActions(null);
    setTropeInfo(null);
  }

  function handleAdvancedSwap(text) {
    setTropeAdvancedActions(null);
    handleProposeSwapFromInfo(text);
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
    setKickTarget({ id, name, avatar: gameState.players[id]?.avatar });
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
    if (player.id === myId || isHost) setManagedPlayer(player);
  }

  function handleAddManagedHost() {
    clientRef.current?.addHost(managedPlayer.id);
    setManagedPlayer(null);
  }

  function handleRestoreDisconnectedBoard(sourceId) {
    clientRef.current?.restoreDisconnectedBoard(managedPlayer.id, sourceId);
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
    setMissedCall(null);
  }

  function handleDropMissedCall() {
    if (gameStateRef.current?.calls?.[myIdRef.current] === missedCall?.text) {
      clientRef.current?.toggleCall(missedCall.text);
    }
    setMissedCall(null);
  }

  function handleCancelReconnect() {
    clientRef.current?.cancelReconnect();
  }

  function handleRetryReconnect() {
    clientRef.current?.retryReconnect();
  }

  if (screen === 'landing' || !gameState) {
    return (
      <>
        {connectionLost && <div className="connection-banner">⚠️ Connection lost — trying to reconnect…</div>}
        <header className="app-header">
          <div className="app-brand">
            <h1>🎬 Movie/TV Trope Bingo</h1>
            <span className="app-version">v{appVersion}</span>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={toggleSoundMuted}
              data-tutorial="sound"
              aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
              title={soundMuted ? 'Unmute sound' : 'Mute sound'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
            <button className="icon-btn" onClick={() => setHelpModalOpen(true)} aria-label="Help" title="Help">
              ❓
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
            savedSession={savedSessionStatus === 'active' ? savedSession : null}
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
  const playerStatsTarget = players.find((player) => player.id === playerStatsTargetId) || null;
  const calledText = gameState.calls?.[myId];
  const calledIndexes = calledText ? [me.board.indexOf(calledText)].filter((index) => index !== -1) : [];
  const callersByText = Object.create(null);
  for (const player of players) {
    const text = gameState.calls?.[player.id];
    if (!text) continue;
    callersByText[text] ||= [];
    callersByText[text].push(player);
  }
  const activePlayerCount = players.filter((player) => player.connected).length;
  const successfulCallersByText = Object.fromEntries(
    Object.entries(gameState.acceptedCalls || {})
      .filter(([text]) => gameState.acceptedTropes.includes(text))
      .map(([text, callers]) => [
        text,
        callers.map((caller) => players.find((player) => player.id === caller.id) || caller),
      ]),
  );
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
  const playerSuperlatives = getPlayerSuperlatives(players, gameState);

  return (
    <>
      {connectionLost && (
        <div className="connection-banner" role="status" aria-live="polite">
          {reconnectCancelled ? '⚠️ Connection lost — reconnect paused.' : '⚠️ Connection lost — trying to reconnect…'}
        </div>
      )}
      {!focusMode && (
        <header className="app-header">
          <div className="app-brand">
            <h1>🎬 Movie/TV Trope Bingo</h1>
            <span className="app-version">v{appVersion}</span>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={toggleSoundMuted}
              data-tutorial="sound"
              aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
              title={soundMuted ? 'Unmute sound' : 'Mute sound'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
            <button className="icon-btn" onClick={() => setHelpModalOpen(true)} aria-label="Help" title="Help">
              ❓
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </header>
      )}
      <BingoBanner key={bingoBanner?.id} message={bingoBanner?.message} />
      <FinaleBanner visible={finaleBanner} onDismiss={handleDismissFinaleBanner} />
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
              {gameState.movie && (
                <button
                  className={`movie-banner${isHost ? ' movie-banner-editable' : ''}`}
                  onClick={() => setMovieIdentityModalOpen(true)}
                >
                  {gameState.movie.poster && <img src={gameState.movie.poster} alt="" />}
                  <span className="movie-banner-copy">
                    <small>Now watching</small>
                    <strong>{gameState.movie.title}</strong>
                  </span>
                </button>
              )}
              {!gameState.started && (
                <div className="game-status">Waiting for players — the host can start when everyone is ready.</div>
              )}
              {!gameState.started && isHost && (
                <button className="btn primary" data-tutorial="start" onClick={() => clientRef.current.startGame()}>
                  Start Game
                </button>
              )}
              {!gameState.started && (
                <button className="btn" data-tutorial="wagers" onClick={() => setWagerIntroOpen(true)}>
                  🎯 {wageringEnabled ? 'Choose Wagers' : 'Optional Wagers'}
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
                onResignHost={handleResignHost}
                hostCount={hostIds.length}
                onResetGame={handleResetGame}
                onEndGame={() => setEndGameConfirmOpen(true)}
                onResumeGame={handleResumeGame}
                onConfigureSession={() => setSessionLifetimeModalOpen(true)}
                onSetHostRecoveryPassword={
                  isHost && myId === gameState.seatOrder[0] ? () => setHostRecoveryPasswordOpen(true) : undefined
                }
                onViewRecap={() => setGameOverModalOpen(true)}
                onLeaveGame={() => setLeaveConfirmOpen(true)}
                onCopyInviteLink={handleCopyInviteLink}
                onShowInviteQr={handleShowInviteQr}
                advancedGameplay={advancedGameplay}
                onToggleAdvancedGameplay={() => setAdvancedGameplay((enabled) => !enabled)}
                onSubmitCustomTrope={() => setCustomTropeModalOpen(true)}
                onRequestBoardSwap={handleRequestBoardSwap}
                onShowMarathonStandings={() => setMarathonStandingsOpen(true)}
                onShowStatsDashboard={() => setStatsDashboardOpen(true)}
                queueCount={gameState.claimQueue?.length || 0}
                onShowClaimQueue={() => setClaimQueueOpen(true)}
                onAccessibility={() => setAccessibilityOpen(true)}
                tutorialActive={tutorialActive}
                onStartTutorial={startTutorial}
                onPauseTutorial={pauseTutorial}
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
                onEditSelf={() => handleManagePlayer(me)}
                onManagePlayer={handleManagePlayer}
                onViewPlayerStats={(player) => setPlayerStatsTargetId(player.id)}
                callStats={gameState.callStats}
                onCallScoreClick={setCallInfoPlayer}
                wageringEnabled={wageringEnabled}
                superlatives={playerSuperlatives}
                onSuperlativeClick={(player) =>
                  setSuperlativeInfo({ award: playerSuperlatives[player.id], name: player.name, avatar: player.avatar })
                }
              />
            )}
            <div className="board-wrap" data-tutorial="board">
              {connectionLost && !gameState.started && (
                <div className="reconnect-panel" role="status" aria-live="polite">
                  {reconnectCancelled ? (
                    <>
                      <strong>Disconnected</strong>
                      <p>Reconnect was paused. Your board is still here.</p>
                      <button className="btn primary" onClick={handleRetryReconnect}>
                        ↻ Reconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="loading-spinner" aria-hidden="true" />
                      <strong>Reconnecting…</strong>
                      <p>Your board is preserved while we restore the connection.</p>
                      <button className="btn" onClick={handleCancelReconnect}>
                        Cancel reconnect
                      </button>
                    </>
                  )}
                </div>
              )}
              <BingoBoard
                board={me.board}
                wagered={me.wagered}
                marked={me.marked}
                calledIndexes={calledIndexes}
                callersByText={callersByText}
                successfulCallersByText={successfulCallersByText}
                listView={accessibility.listView}
                showStateLabels={accessibility.showStateLabels}
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
        onDisagree={(rationale) => clientRef.current.vote(gameState.pendingClaim.claimId, false, rationale)}
        onCancel={() => clientRef.current.cancelClaim(gameState.pendingClaim.claimId)}
        onBrowseQueue={() => setAllTropesModalOpen(true)}
        onShowQueue={() => setClaimQueueOpen(true)}
      />
      {claimQueueOpen && (
        <ClaimQueueModal
          queue={gameState.claimQueue || []}
          players={players}
          myId={myId}
          onWithdraw={(id) => clientRef.current.withdrawQueuedClaim(id)}
          onBrowse={() => {
            setClaimQueueOpen(false);
            setAllTropesModalOpen(true);
          }}
          onClose={() => setClaimQueueOpen(false)}
        />
      )}

      {wagerIntroOpen && <WagerIntroModal onAddWagers={handleStartWagering} onSkip={handleSkipWagering} />}

      {resetModalOpen && (
        <ResetModal
          currentGenres={gameState.genres}
          currentSubgenreSelections={gameState.subgenreSelections}
          currentFreeSpace={gameState.freeSpace}
          currentGeneralPercents={gameState.generalPercents}
          currentGenrePercents={gameState.genrePercents}
          currentSubgenrePercents={gameState.subgenrePercents}
          currentTotalTropes={gameState.totalTropes}
          onConfirm={handleConfirmReset}
          onCancel={() => setResetModalOpen(false)}
        />
      )}

      {inviteQrOpen && <InviteQrModal inviteUrl={inviteUrl} onClose={() => setInviteQrOpen(false)} />}

      {tropesModalOpen && (
        <AcceptedTropesModal
          board={me.board}
          wageredTexts={me.wagered.map((index) => me.board[index])}
          calledTexts={[...Object.values(gameState.calls || {}), ...Object.keys(gameState.acceptedCalls || {})]}
          acceptedTropes={gameState.acceptedTropes}
          onTropeClick={handleAcceptedTropeInfo}
          onClose={() => setTropesModalOpen(false)}
        />
      )}

      {allTropesModalOpen && (
        <AllTropesModal
          board={me.board}
          wageredTexts={me.wagered.map((index) => me.board[index])}
          calledTexts={[...Object.values(gameState.calls || {}), ...Object.keys(gameState.acceptedCalls || {})]}
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
          playerAvatar={kickTarget.avatar}
          onConfirm={handleConfirmKick}
          onCancel={() => setKickTarget(null)}
        />
      )}

      {isHost && gameState.pendingJoinRequest && (
        <JoinRequestModal
          name={gameState.pendingJoinRequest.name}
          avatar={gameState.pendingJoinRequest.avatar}
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
          isSelf={managedPlayer.id === myId}
          canRestoreBoard={
            isHost &&
            managedPlayer.connected &&
            gameState.started &&
            !gameState.gameOver &&
            !gameState.pendingClaim &&
            !gameState.pendingReplacement &&
            !gameState.claimQueue?.length
          }
          disconnectedPlayers={players.filter(
            (player) => !player.connected && !hostIds.includes(player.id) && player.id !== managedPlayer.id,
          )}
          onAddHost={handleAddManagedHost}
          onRestoreBoard={handleRestoreDisconnectedBoard}
          onProposeProfile={handleOpenProfileProposal}
          onEditProfile={() => {
            setManagedPlayer(null);
            setChangeNameModalOpen(true);
          }}
          onViewStats={() => {
            setPlayerStatsTargetId(managedPlayer.id);
            setManagedPlayer(null);
          }}
          onCancel={() => setManagedPlayer(null)}
        />
      )}

      {profileProposalTarget && (
        <ChangeNameModal
          currentName={profileProposalTarget.name}
          currentAvatar={profileProposalTarget.avatar}
          title={`Propose a name & avatar for ${formatPlayerName(profileProposalTarget)}`}
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

      {marathonStandingsOpen && (
        <MarathonStandingsModal marathon={gameState.marathon} onClose={() => setMarathonStandingsOpen(false)} />
      )}

      {playerStatsTarget && (
        <PlayerStatsModal
          player={playerStatsTarget}
          marathon={gameState.marathon}
          freeSpace={gameState.freeSpace}
          callStats={gameState.callStats?.[playerStatsTarget.id]}
          onCallScoreClick={setCallInfoPlayer}
          onClose={() => setPlayerStatsTargetId(null)}
        />
      )}

      {statsDashboardOpen && (
        <StatsDashboardModal
          players={players}
          acceptedTropes={gameState.acceptedTropes}
          freeSpace={gameState.freeSpace}
          callStats={gameState.callStats}
          onCallScoreClick={setCallInfoPlayer}
          onClose={() => setStatsDashboardOpen(false)}
        />
      )}

      {gameOverModalOpen && (
        <GameOverModal
          watchState={gameState}
          onCallScoreClick={setCallInfoPlayer}
          players={players}
          bingoCounts={bingoCounts}
          callStats={gameState.callStats}
          movie={gameState.movie}
          isHost={isHost}
          onMovieClick={() => setMovieIdentityModalOpen(true)}
          superlatives={playerSuperlatives}
          onSuperlativeClick={(player) =>
            setSuperlativeInfo({ award: playerSuperlatives[player.id], name: player.name, avatar: player.avatar })
          }
          onClose={() => setGameOverModalOpen(false)}
        />
      )}

      {callInfoPlayer && (
        <CallInfoModal
          player={players.find((player) => player.id === callInfoPlayer.id) || callInfoPlayer}
          stats={gameState.callStats?.[callInfoPlayer.id]}
          history={gameState.callHistory?.[callInfoPlayer.id]}
          activeCall={gameState.calls?.[callInfoPlayer.id]}
          successfulCalls={gameState.acceptedCalls}
          gameOver={gameState.gameOver}
          onClose={() => setCallInfoPlayer(null)}
        />
      )}

      {sessionLifetimeModalOpen && (
        <SessionLifetimeModal
          currentExtended={gameState.sessionExtended}
          currentHours={gameState.sessionLifetimeHours}
          onConfirm={handleUpdateSessionLifetime}
          onCancel={() => setSessionLifetimeModalOpen(false)}
        />
      )}

      {hostRecoveryPasswordOpen && (
        <HostRecoveryPasswordModal
          onConfirm={handleSetHostRecoveryPassword}
          onCancel={() => setHostRecoveryPasswordOpen(false)}
        />
      )}

      {movieIdentityModalOpen && (
        <MovieIdentityModal
          currentMovie={gameState.movie}
          readOnly={!isHost}
          onConfirm={handleUpdateMovie}
          onCancel={() => setMovieIdentityModalOpen(false)}
        />
      )}

      {gameState.pendingReplacement && gameState.pendingReplacement.byId === myId && (
        <ReplacementPickerModal
          replacement={gameState.pendingReplacement}
          onCycle={handleCycleReplacement}
          onChoose={handleChooseReplacement}
          onCancel={handleCancelReplacement}
        />
      )}

      {superlativeInfo && (
        <SuperlativeModal
          award={superlativeInfo.award}
          playerName={superlativeInfo.name}
          playerAvatar={superlativeInfo.avatar}
          onClose={() => setSuperlativeInfo(null)}
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

      {accessibilityOpen && (
        <AccessibilityModal
          value={accessibility}
          onChange={setAccessibility}
          onClose={() => setAccessibilityOpen(false)}
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
          key={tropeInfo.text}
          text={tropeInfo.text}
          marked={tropeInfo.marked}
          title={tropeInfo.title}
          actionHint={tropeInfo.actionHint}
          confirmLabel={tropeInfo.confirmLabel}
          playerCount={activePlayerCount}
          onConfirm={tropeInfo.onConfirm}
          callers={callersByText[tropeInfo.text] || []}
          successfulCallers={successfulCallersByText[tropeInfo.text] || []}
          onCancel={handleCloseTropeInfo}
          onProposeSwap={tropeInfo.onProposeSwap}
          onAdvancedActions={tropeInfo.onAdvancedActions}
          actionsAvailable={!gameState.acceptedTropes.includes(tropeInfo.text)}
          allowSceneContext={gameState.started && !gameState.gameOver}
        />
      )}

      {tropeAdvancedActions && !gameState.acceptedTropes.includes(tropeAdvancedActions.text) && (
        <TropeAdvancedActionsModal
          text={tropeAdvancedActions.text}
          called={gameState.calls?.[myId] === tropeAdvancedActions.text}
          onToggleCall={() => handleToggleCall(tropeAdvancedActions.text)}
          onSwap={() => handleAdvancedSwap(tropeAdvancedActions.text)}
          onClose={() => setTropeAdvancedActions(null)}
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

      {tutorialEnabled && tutorialActive && !gameState.gameOver && (
        <GuidedTutorial
          key={tutorialRun}
          isHost={isHost}
          started={gameState.started}
          soundMuted={soundMuted}
          suspended={focusMode || connectionLost || !!bingoBanner || finaleBanner}
          onEnableSound={() => {
            setSoundMuted(false);
            setSoundMutedState(false);
          }}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onBrowse={() => {
            const index = me.board.findIndex(
              (text, position) => !me.marked.includes(position) && !(gameState.freeSpace && position === CENTER_INDEX),
            );
            handleCellClick(index === -1 ? 0 : index);
          }}
          onWagers={() => setWagerIntroOpen(true)}
          onMenu={() => setMenuOpen(true)}
          onAdvanced={() => {
            setAdvancedGameplay(true);
            setMenuOpen(true);
          }}
          onPause={pauseTutorial}
          onFinish={pauseTutorial}
          onDisable={() => {
            saveTutorialPreference(false);
            pauseTutorial();
          }}
        />
      )}

      {missedCall &&
        calledText === missedCall.text &&
        !gameState.gameOver &&
        !gameState.pendingClaim &&
        !gameState.pendingReplacement && (
          <ConfirmModal
            title="Your call didn't happen next"
            message={`"${missedCall.acceptedText}" was accepted after your call of "${missedCall.text}", so your called trope didn't happen next. Would you like to keep the call or drop it?`}
            confirmLabel="Drop my call"
            cancelLabel="Keep my call"
            onConfirm={handleDropMissedCall}
            onCancel={() => setMissedCall(null)}
          />
        )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
