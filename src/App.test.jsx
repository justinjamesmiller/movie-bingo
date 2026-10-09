import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeClientState() {
  return {
    code: 'ABCD',
    rev: 0,
    genres: ['horror'],
    subgenreSelections: [],
    freeSpace: false,
    generalPercents: { horror: 50 },
    totalTropes: 25,
    tropePool: Array.from({ length: 25 }, (_, index) => `Trope ${index + 1}`),
    players: {
      p1: {
        id: 'p1',
        name: 'Ashley',
        seat: 0,
        connected: true,
        avatar: '🎬',
        board: Array.from({ length: 25 }, (_, index) => `Trope ${index + 1}`),
        wagered: [],
        marked: [],
      },
      p2: {
        id: 'p2',
        name: 'Bob',
        seat: 1,
        connected: true,
        avatar: '🍿',
        board: Array.from({ length: 25 }, (_, index) => `Trope ${index + 1}`),
        wagered: [],
        marked: [],
      },
    },
    seatOrder: ['p1', 'p2'],
    hostIds: ['p1'],
    started: false,
    gameOver: false,
    pendingClaim: null,
    pendingJoinRequest: null,
    acceptedTropes: [],
    activityLog: [],
  };
}

let clientState = makeClientState();
let latestClient;
let joinResult = null;
let hostError = null;
let joinError = null;
let savedSession = null;
let rejoinError = null;
let savedSessionActive = true;
let savedSessionCleared = 0;

vi.mock('./net/relay.js', () => {
  class GameClient {
    static getSavedSession() {
      return savedSession;
    }

    static async isSavedSessionActive() {
      return savedSessionActive;
    }

    static clearSavedSession() {
      savedSessionCleared += 1;
      savedSession = null;
    }

    constructor({ onState, onEvent }) {
      this.onState = onState;
      this.onEvent = onEvent;
      latestClient = this;
    }

    async hostGame(name, ...options) {
      if (hostError) throw hostError;
      this.hostOptions = options;
      clientState.players.p1.name = name;
      this.onState(clientState, 'p1');
      return clientState.code;
    }

    async joinGame(code, name, hostRecoveryPassword) {
      if (joinError) throw joinError;
      clientState.hostIds = ['p2'];
      clientState.players.p1.name = name;
      this.joinOptions = { code, name, hostRecoveryPassword };
      this.onState(clientState, 'p1');
      return joinResult || { needsChoice: false };
    }

    async rejoinGame() {
      if (rejoinError) throw rejoinError;
      this.onState(clientState, 'p1');
    }

    destroy = vi.fn();
    leaveGame = vi.fn();
    startGame() {}
    setWager = vi.fn();
    claim = vi.fn();
    declareGameOver = vi.fn(() => {
      clientState.gameOver = true;
      this.onState(clientState, 'p1');
      this.onEvent({ type: 'gameOver' });
    });
    resumeGame = vi.fn(() => {
      clientState.gameOver = false;
      this.onState(clientState, 'p1');
      this.onEvent({ type: 'gameResumed' });
    });
    resetGame = vi.fn();
    setHostRecoveryPassword = vi.fn().mockResolvedValue({ ok: true });
    proposeAccept() {}
    proposeReplace() {}
    challengeTrope() {}
    recordTropeView = vi.fn();
    toggleCall = vi.fn((text) => {
      if (clientState.calls?.p1 === text) delete clientState.calls.p1;
      else clientState.calls = { ...clientState.calls, p1: text };
      this.onState(clientState, 'p1');
    });
    addHost = vi.fn((targetId) => {
      clientState.hostIds = [...clientState.hostIds, targetId];
      this.onState(clientState, 'p1');
    });
    restoreDisconnectedBoard = vi.fn();
    requestBoardRecovery = vi.fn();
    respondToBoardRecovery = vi.fn();
    cancelBoardRecovery = vi.fn();
    resignHost() {
      clientState.hostIds = clientState.hostIds.filter((id) => id !== 'p1');
      this.onState(clientState, 'p1');
    }
  }
  return { GameClient };
});

import App from './App.jsx';
import { version as appVersion } from '../package.json';
import { isSoundMuted, setSoundMuted } from './utils/sound.js';

async function hostTutorialView() {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  const view = render(<App />);
  fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
  fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
  await screen.findByText('Code: ABCD');
  return view;
}

describe('App', () => {
  it('keeps wagering optional and forwards a confirmed pregame selection', async () => {
    await hostTutorialView();
    fireEvent.click(screen.getByRole('button', { name: '🎯 Optional Wagers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for Now' }));
    expect(latestClient.setWager).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '🎯 Optional Wagers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Wagers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board space: Trope 1' }));
    fireEvent.click(screen.getByRole('button', { name: '🎯 Wager this trope' }));
    expect(latestClient.setWager).toHaveBeenCalledWith([0]);
  });

  it('does not submit a cancelled trope and forwards a confirmed live claim', async () => {
    clientState.started = true;
    await hostTutorialView();
    fireEvent.click(screen.getByRole('button', { name: 'Board space: Trope 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(latestClient.claim).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Board space: Trope 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Submit to the group/ }));
    expect(latestClient.claim).toHaveBeenCalledWith(0, undefined);
  });
  it('requires end-game confirmation, opens the recap, and resumes without resetting the board', async () => {
    clientState.started = true;
    const board = [...clientState.players.p1.board];
    await hostTutorialView();
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🏁 End Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(latestClient.declareGameOver).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🏁 End Game' }));
    fireEvent.click(screen.getByRole('button', { name: '🏁 End Game' }));
    expect(latestClient.declareGameOver).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Close', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '▶️ Resume Game' }));
    expect(latestClient.resumeGame).toHaveBeenCalledTimes(1);
    expect(clientState.gameOver).toBe(false);
    expect(clientState.players.p1.board).toEqual(board);
  });

  it('cancels reset without mutation and forwards explicitly confirmed setup changes', async () => {
    clientState.started = true;
    await hostTutorialView();
    const openReset = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
      const advanced = screen.queryByRole('button', { name: 'Advanced Options', exact: true });
      if (advanced) fireEvent.click(advanced);
      const hostSection = screen.getByRole('button', { name: 'Host Settings' });
      if (hostSection.getAttribute('aria-expanded') !== 'true') fireEvent.click(hostSection);
      fireEvent.click(screen.getByRole('button', { name: '🔄 Reset Game' }));
      await screen.findByRole('heading', { name: 'Reset the game?' });
    };
    await openReset();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(latestClient.resetGame).not.toHaveBeenCalled();
    await openReset();
    fireEvent.change(screen.getByLabelText('Total unique tropes in play'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Game', exact: true }));
    expect(latestClient.resetGame).toHaveBeenCalledTimes(1);
    expect(latestClient.resetGame.mock.calls[0][4]).toBe(40);
    expect(screen.queryByRole('heading', { name: 'Reset the game?' })).toBeNull();
  });
  it.each([true, false])('shows a five-minute recovery countdown to the challenged player: %s', async (isSource) => {
    vi.useFakeTimers();
    clientState.started = true;
    clientState.players.p3 = { ...clientState.players.p2, id: 'p3', name: 'New device', seat: 2 };
    clientState.seatOrder.push('p3');
    clientState.pendingBoardRecovery = {
      id: 'recovery-test',
      sourceId: isSource ? 'p1' : 'p2',
      targetId: 'p3',
      byId: isSource ? 'p2' : 'p1',
      expiresAt: Date.now() + 300_000,
    };
    render(<App />);
    if (isSource) {
      fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Ashley' } });
      fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
    } else fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: isSource ? 'Join Game' : 'Host Game', exact: true })),
    );
    expect(screen.getByRole('timer', { name: 'Recovery countdown' })).toHaveTextContent('5:00');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('4:59');
    fireEvent.click(screen.getByRole('button', { name: isSource ? "I'm still playing" : 'Cancel recovery' }));
    expect(isSource ? latestClient.respondToBoardRecovery : latestClient.cancelBoardRecovery).toHaveBeenCalledWith(
      'recovery-test',
    );
  });
  it('shows badge progress before earning a badge and updates it from shared evidence', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game', exact: true }));
    await screen.findByRole('button', { name: 'Menu', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Your player options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Badge Progress' }));
    expect(screen.getByRole('heading', { name: 'Badge Progress' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Team Player progress' })).toHaveAttribute('value', '0');
    act(() => {
      clientState.superlativeStats = { p1: { otherApprovalVotes: 2 } };
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.getByRole('heading', { name: 'Team Player' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Consensus Builder progress' })).toHaveAttribute('value', '2');
    expect(screen.queryByRole('status', { name: 'New awards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(await screen.findByRole('status', { name: 'New awards' })).toHaveTextContent(
      'Ashley earned the badge Team Player',
    );
  });

  it('announces other players upgrades without replaying initial or repeated badges', async () => {
    clientState.started = true;
    clientState.superlativeStats = { p2: { otherApprovalVotes: 1 } };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game', exact: true }));
    await screen.findByRole('button', { name: 'Menu', exact: true });
    expect(screen.queryByRole('status', { name: 'New awards' })).toBeNull();
    act(() => {
      clientState.superlativeStats.p2.otherApprovalVotes = 3;
      latestClient.onState(clientState, 'p1');
    });
    const announcement = await screen.findByRole('status', { name: 'New awards' });
    expect(announcement).toHaveTextContent('Bob earned the badge Consensus Builder');
    act(() => latestClient.onState(clientState, 'p1'));
    expect(screen.getAllByRole('status', { name: 'New awards' })).toHaveLength(1);
    act(() => {
      clientState.started = false;
      clientState.superlativeStats = {};
      latestClient.onState(clientState, 'p1');
    });
    await waitFor(() => expect(screen.queryByRole('status', { name: 'New awards' })).toBeNull());
  });

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    clientState = makeClientState();
    joinResult = null;
    hostError = null;
    joinError = null;
    savedSession = null;
    rejoinError = null;
    savedSessionActive = true;
    savedSessionCleared = 0;
    savedSessionActive = true;
    savedSessionCleared = 0;
    localStorage.setItem('bingo-tutorial-enabled', 'false');
  });

  it('automatically guides a new host and pauses while they browse a real trope modal', async () => {
    localStorage.removeItem('bingo-tutorial-enabled');
    const { container } = await hostTutorialView();
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
    expect(screen.getByText(/Host guide.*Getting ready/)).toBeInTheDocument();
    expect(container.querySelector('[data-tutorial="sound"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Browse a trope' }));
    expect(latestClient.recordTropeView).toHaveBeenCalledWith('Trope 1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Trope', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Explore your board');
  });

  it('lets a bingo celebration take priority over tutorial tips and resumes afterward', async () => {
    localStorage.setItem('bingo-tutorial-enabled', 'true');
    clientState.started = true;
    clientState.players.p1.marked = [0, 1, 2, 3];
    await hostTutorialView();
    await screen.findByRole('dialog');
    vi.useFakeTimers();
    act(() => {
      clientState.players.p1.marked.push(4);
      clientState.acceptedTropes = clientState.players.p1.board.slice(0, 5);
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.getByText('🎉 BINGO!')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
  });

  it('recommends sound but only unmutes when the player chooses to enable it', async () => {
    localStorage.setItem('bingo-tutorial-enabled', 'true');
    setSoundMuted(true);
    try {
      await hostTutorialView();
      await screen.findByRole('dialog');
      expect(isSoundMuted()).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(isSoundMuted()).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Previous tutorial step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }));
      expect(isSoundMuted()).toBe(false);
      expect(screen.getByRole('button', { name: 'Mute sound' })).toBeInTheDocument();
    } finally {
      setSoundMuted(false);
    }
  });

  it('remembers opting out and lets the player opt back in from the simple menu', async () => {
    localStorage.setItem('bingo-tutorial-enabled', 'true');
    const first = await hostTutorialView();
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial on this device' }));
    expect(localStorage.getItem('bingo-tutorial-enabled')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    first.unmount();
    await hostTutorialView();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '📖 Start tutorial' }));
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
    expect(localStorage.getItem('bingo-tutorial-enabled')).toBe('true');
  });

  it('switches from finished setup guidance to live-play tips and yields to votes', async () => {
    localStorage.setItem('bingo-tutorial-enabled', 'true');
    await hostTutorialView();
    await screen.findByRole('dialog');
    while (screen.queryByRole('button', { name: 'Next', exact: true }))
      fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish guide' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      clientState.started = true;
      latestClient.onState(clientState, 'p1');
    });
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
    expect(screen.getByText(/Host guide.*Playing/)).toBeInTheDocument();
    act(() => {
      clientState.pendingClaim = {
        claimId: 'guided-vote',
        byId: 'p2',
        text: 'Trope 2',
        kind: 'mark',
        votes: { p2: true },
        totalPlayers: 2,
      };
      latestClient.onState(clientState, 'p1');
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /\bAgree\b/i })).toBeInTheDocument();
    act(() => {
      clientState.pendingClaim = null;
      latestClient.onState(clientState, 'p1');
    });
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
  });

  it('persists accessibility settings locally and uses the readable board layout', async () => {
    localStorage.removeItem('bingo-accessibility');
    const first = await hostTutorialView();
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Options', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'My Tools', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Accessibility', exact: true }));
    for (const label of ['Larger text', 'Board as a readable list', 'Show space state labels', 'Reduce animations'])
      fireEvent.click(screen.getByRole('checkbox', { name: label }));
    expect(document.body).toHaveClass('large-text', 'reduce-motion');
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(document.querySelector('.bingo-board')).toHaveClass('bingo-board-list');
    expect(document.querySelector('.cell-state-labels')).toHaveTextContent('Unaccepted');
    expect(JSON.parse(localStorage.getItem('bingo-accessibility')).listView).toBe(true);
    first.unmount();
    const second = await hostTutorialView();
    expect(document.querySelector('.bingo-board')).toHaveClass('bingo-board-list');
    second.unmount();
    localStorage.removeItem('bingo-accessibility');
  });

  it('starts with a usable theme when storage is blocked and matchMedia is unavailable', () => {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'bingo-theme') throw new Error('Storage is blocked');
      return originalGetItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'bingo-theme') throw new Error('Storage is blocked');
      return originalSetItem.call(this, key, value);
    });
    vi.stubGlobal('matchMedia', undefined);

    try {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Movie\/TV Trope Bingo/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
      expect(document.body).toHaveClass('dark');
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      document.body.classList.remove('dark');
    }
  });

  it('ignores an invalid saved theme and falls back to the system preference', () => {
    localStorage.setItem('bingo-theme', 'sepia');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    try {
      render(<App />);
      expect(document.body).toHaveClass('dark');
    } finally {
      vi.unstubAllGlobals();
      document.body.classList.remove('dark');
      localStorage.removeItem('bingo-theme');
    }
  });

  it('shows the package version on the home screen and in the game', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    expect(screen.getByText(`v${appVersion}`, { exact: true })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(screen.getByText(`v${appVersion}`, { exact: true })).toBeInTheDocument();
  });

  it.each([false, true])(
    'automatically shows the appropriate player guide on joining (started: %s)',
    async (started) => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
      localStorage.setItem('bingo-tutorial-enabled', 'true');
      clientState.started = started;
      render(<App />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Guest' } });
      fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
      fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
      await screen.findByText('Code: ABCD');
      await screen.findByRole('dialog');
      expect(
        screen.getByText(new RegExp(`Player guide.*${started ? 'Playing' : 'Getting ready'}`)),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(
        screen.getByRole('heading', { name: started ? 'Spot it, then claim it' : 'Add a little friendly suspense' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Start when everyone is ready')).toBeNull();
    },
  );

  it.each([false, true])(
    'keeps reconnect UI non-blocking during play (started: %s) and preserves lobby controls',
    async (started) => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
      clientState.started = started;
      const { container } = render(<App />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
      fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
      await screen.findByText('Code: ABCD');

      vi.useFakeTimers();
      try {
        act(() => latestClient.onEvent({ type: 'connectionStatus', status: 'disconnected' }));
        act(() => vi.advanceTimersByTime(3999));
        expect(container.querySelector('.connection-banner')).toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(container.querySelector('.connection-banner')).toHaveTextContent(
          'Connection lost — trying to reconnect',
        );
        expect(container.querySelector('.connection-banner')).toHaveAttribute('role', 'status');
        expect(container.querySelectorAll('.reconnect-panel')).toHaveLength(started ? 0 : 1);
        expect(container.querySelectorAll('.bingo-cell')).toHaveLength(25);
        if (started) {
          expect(screen.queryByRole('button', { name: 'Cancel reconnect' })).toBeNull();
          expect(screen.queryByRole('button', { name: /↻ Reconnect/ })).toBeNull();
          fireEvent.click(screen.getByText('Trope 1', { exact: true }));
          expect(screen.getByRole('heading', { name: 'Claim this trope?' })).toBeInTheDocument();
        } else {
          expect(screen.getByRole('button', { name: 'Cancel reconnect' })).toBeInTheDocument();
        }
        act(() => latestClient.onEvent({ type: 'connectionStatus', status: 'connected' }));
        expect(container.querySelector('.connection-banner')).toBeNull();
        expect(container.querySelector('.reconnect-panel')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(['missing events', 'local events', 'simultaneous players', 'other player'])(
    'celebrates a single mark completing two lines (%s)',
    async (scenario) => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
      clientState.started = true;
      clientState.bingoEvents = [];
      const completingPlayer = scenario === 'other player' ? 'p2' : 'p1';
      clientState.players[completingPlayer].marked = [1, 2, 3, 4, 5, 10, 15, 20];
      if (scenario === 'simultaneous players') clientState.players.p2.marked = [...clientState.players.p1.marked];
      render(<App />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
      fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
      await screen.findByText('Code: ABCD');
      vi.useFakeTimers();
      act(() => {
        clientState.players[completingPlayer].marked.push(0);
        clientState.acceptedTropes = clientState.players[completingPlayer].marked.map(
          (index) => clientState.players[completingPlayer].board[index],
        );
        if (scenario !== 'missing events')
          clientState.bingoEvents = [
            { id: 'first-line', playerId: completingPlayer, count: 1 },
            { id: 'second-line', playerId: completingPlayer, count: 2 },
          ];
        if (scenario === 'simultaneous players') {
          clientState.players.p2.marked.push(0);
          clientState.bingoEvents.push(
            { id: 'bob-one', playerId: 'p2', count: 1 },
            { id: 'bob-two', playerId: 'p2', count: 2 },
          );
        }
        latestClient.onState(clientState, 'p1');
      });
      const message = scenario === 'other player' ? '🎉 BINGO for 🍿 Bob! (2 lines!)' : '🎉 BINGO! (2 lines!)';
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(document.querySelectorAll('.bingo-cell.bingo-line')).toHaveLength(scenario === 'other player' ? 0 : 9);
      try {
        act(() => vi.advanceTimersByTime(4000));
        act(() => latestClient.onState(clientState, 'p1'));
        expect(screen.queryByText(message)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('restarts confetti when the same two-line bingo is completed again while its banner is visible', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    clientState.started = true;
    clientState.bingoEvents = [];
    clientState.players.p1.marked = [1, 2, 3, 4, 5, 10, 15, 20];
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    vi.useFakeTimers();
    act(() => {
      clientState.players.p1.marked.push(0);
      latestClient.onState(clientState, 'p1');
    });
    const originalConfetti = document.querySelector('.bingo-confetti');
    expect(originalConfetti).toBeInTheDocument();
    act(() => {
      clientState.players.p1.marked = clientState.players.p1.marked.filter((index) => index !== 0);
      latestClient.onState(clientState, 'p1');
    });
    act(() => {
      clientState.players.p1.marked.push(0);
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.getByText('🎉 BINGO! (2 lines!)')).toBeInTheDocument();
    expect(document.querySelector('.bingo-confetti')).not.toBe(originalConfetti);
    expect(document.querySelectorAll('.bingo-confetti')).toHaveLength(14);
  });

  it('does not replay historical bingo celebrations from the first loaded state', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    clientState.started = true;
    clientState.players.p1.marked = [0, 1, 2, 3, 4, 5, 10, 15, 20];
    clientState.bingoEvents = [
      { id: 'old-one', playerId: 'p1', count: 1 },
      { id: 'old-two', playerId: 'p1', count: 2 },
    ];
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(screen.queryByText(/🎉 BINGO/)).toBeNull();
  });

  it('hosts a game and renders the simple gameplay screen from relay state', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    const nameInput = screen.getByPlaceholderText('e.g. Ashley');
    const blur = vi.spyOn(nameInput, 'blur');
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));

    expect(await screen.findByText('Code: ABCD')).toBeInTheDocument();
    expect(blur).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Advanced Options' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👑 Add Host' })).toBeNull();
  });

  it('passes the optional host recovery password to room creation without persisting it', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.change(screen.getByLabelText('Host recovery password (optional)'), { target: { value: 'xy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    expect(latestClient.hostOptions.at(-1)).toBe('xy');
    expect(localStorage.getItem('movie-bingo-session') || '').not.toContain('xy');
    expect(sessionStorage.getItem('movie-bingo-session') || '').not.toContain('xy');
  });

  it('returns to host setup and destroys the client when game creation fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    hostError = new Error('Temporary host failure.');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));

    expect(await screen.findByText('Temporary host failure.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Host Game' })).toBeInTheDocument();
    expect(latestClient.destroy).toHaveBeenCalledOnce();
  });

  it('returns to join setup and destroys the client when joining fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    joinError = new Error('Temporary join failure.');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Guest' } });
    fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));

    expect(await screen.findByText('Temporary join failure.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Game' })).toBeInTheDocument();
    expect(latestClient.destroy).toHaveBeenCalledOnce();
  });

  it('preserves the reconnect option and reports an error when restoring a saved session fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    savedSession = { code: 'ABCD', myId: 'p1', name: 'Ashley', avatar: '🎬' };
    rejoinError = new Error('The host is unavailable.');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect to ABCD' }));

    expect(await screen.findByText('The host is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect to ABCD' })).toBeInTheDocument();
    expect(latestClient.destroy).toHaveBeenCalledOnce();
  });

  it('shows Reconnect only after the server confirms the saved game is active', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    savedSession = { code: 'ABCD', myId: 'p1', name: 'Ashley', avatar: '🎬' };
    savedSessionActive = true;
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Reconnect to ABCD' })).toBeInTheDocument();
  });

  it('hides and clears Reconnect when the server reports the saved game expired', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    savedSession = { code: 'ABCD', myId: 'p1', name: 'Ashley', avatar: '🎬' };
    savedSessionActive = false;
    render(<App />);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reconnect to ABCD' })).toBeNull());
    expect(savedSessionCleared).toBe(1);
    expect(savedSession).toBeNull();
  });

  it('requires a host handoff before leaving a game with connected players', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🚪 Leave Game', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🚪 Leave', exact: true }));
    expect(screen.getByRole('heading', { name: 'Assign a New Host' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(screen.getByText('Code: ABCD')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🚪 Leave Game', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '🚪 Leave', exact: true }));
    const transferModal = screen.getByRole('heading', { name: 'Assign a New Host' }).closest('.modal-content');
    fireEvent.click(within(transferModal).getByRole('button', { name: '🍿 Bob', exact: true }));

    expect(await screen.findByRole('heading', { name: 'Join a Game' })).toBeInTheDocument();
    expect(latestClient.addHost).toHaveBeenCalledWith('p2');
    expect(latestClient.leaveGame).toHaveBeenCalledOnce();
  });

  it('shows a visible notice when the secure relay rejects an update', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    act(() => latestClient.onEvent({ type: 'relayError', message: 'Only an authorized host can publish state.' }));

    expect(screen.getByText('Only an authorized host can publish state.')).toHaveClass('toast');
  });

  it('shows a retry notice when a concurrent host update wins', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    act(() => latestClient.onEvent({ type: 'stateConflict' }));

    expect(screen.getByText(/Your change was not saved; please retry/)).toHaveClass('toast');
  });

  it('lets a host save a recovery password from Host Settings', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Host Settings' }));
    fireEvent.click(screen.getByRole('button', { name: '🔑 Host recovery password' }));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'long secure phrase' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long secure phrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set recovery password' }));

    expect(latestClient.setHostRecoveryPassword).toHaveBeenCalledWith('long secure phrase');
    expect(await screen.findByText(/Host recovery password saved/)).toBeInTheDocument();
  });

  it('passes a typed host recovery password through joining without persisting it', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Are you a Host?' }));
    fireEvent.change(screen.getByLabelText('Host recovery password'), {
      target: { value: 'long secure phrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    await screen.findByText('Code: ABCD');

    expect(latestClient.joinOptions.hostRecoveryPassword).toBe('long secure phrase');
    expect(localStorage.getItem('bingo-theme')).not.toContain('long secure phrase');
    expect(sessionStorage.getItem('movie-bingo-session') || '').not.toContain('long secure phrase');
  });

  it.each([
    ['approval', { type: 'joinApproved' }, true],
    ['denial', { type: 'joinDenied', reason: 'The host declined your request to join.' }, false],
  ])('handles mid-game join %s without leaving the player in a stale screen', async (_outcome, event, approved) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    joinResult = { needsApproval: true };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Sidney'), { target: { value: 'Guest' } });
    fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(await screen.findByRole('heading', { name: '⏳ Waiting for the host' })).toBeInTheDocument();

    act(() => latestClient.onEvent(event));

    if (approved) {
      expect(await screen.findByText('Code: ABCD')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: '⏳ Waiting for the host' })).toBeNull();
    } else {
      expect(await screen.findByText('The host declined your request to join.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Join Game' })).toBeInTheDocument();
    }
  });

  it.each(['kicked', 'sessionExpired'])('returns to the landing screen after %s', async (eventType) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    act(() => latestClient.onEvent({ type: eventType }));

    expect(await screen.findByRole('heading', { name: 'Join a Game' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Host a New Game' })).toBeInTheDocument();
    expect(
      screen.getByText(
        eventType === 'kicked'
          ? 'You were removed from the game by the host.'
          : 'This game session expired while everyone was away.',
      ),
    ).toBeInTheDocument();
  });

  it('shows only independently earned distinctions, without a first-acceptance gate', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(container.querySelectorAll('.superlative-badge')).toHaveLength(0);

    act(() => {
      clientState.players.p1.wagered = [0, 1, 2, 3, 4];
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.getByRole('button', { name: 'Badge: Full House' })).toBeInTheDocument();
    expect(container.querySelectorAll('.superlative-badge')).toHaveLength(1);
    act(() => {
      clientState.players.p1.wagered = [];
      clientState.acceptedTropes = ['Trope 1'];
      clientState.players.p1.marked = [0];
      clientState.players.p2.marked = [0];
      clientState.superlativeMilestones = { p1: { firstAccepted: true } };
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.getByRole('button', { name: 'Superlative: First Trope Accepted' }).closest('li')).toHaveTextContent(
      'Ashley',
    );
    expect(container.querySelectorAll('.superlative-badge')).toHaveLength(1);
  });

  it.each([true, false])(
    'opens self options with stats and profile editing for every player (host: %s)',
    async (host) => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
      clientState.hostIds = host ? ['p1'] : ['p2'];
      render(<App />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
      fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
      await screen.findByText('Code: ABCD');
      fireEvent.click(screen.getByRole('button', { name: 'Your player options' }));
      expect(screen.getByRole('heading', { name: 'Options for 🎬 Ashley' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '👑 Add Host' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '📊 View Stats' }));
      expect(await screen.findByRole('heading', { name: "🎬 Ashley's Stats" })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Options for 🎬 Ashley' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Your player options' }));
      fireEvent.click(screen.getByRole('button', { name: '✏️ Edit Name & Avatar' }));
      expect(screen.getByRole('heading', { name: 'Change your name & avatar' })).toBeInTheDocument();
      expect(screen.getByLabelText('New name')).toHaveValue('Ashley');
    },
  );

  it('lets a host add another host from the players list and then resign through the menu', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: '🍿 Bob' }));
    expect(screen.getByRole('heading', { name: 'Manage 🍿 Bob' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '👑 Add Host' }));

    expect(await screen.findAllByText('HOST')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Host Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resign as Host' }));
    expect(await screen.findAllByText('HOST')).toHaveLength(1);
  });

  it('lets the host choose a disconnected seat when managing a connected player', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    clientState.started = true;
    clientState.players.p2.name = 'Casey';
    clientState.players.p3 = {
      ...clientState.players.p2,
      id: 'p3',
      name: 'Casey previous seat',
      seat: 2,
      connected: false,
    };
    clientState.seatOrder.push('p3');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: '🍿 Casey' }));
    expect(screen.getByLabelText('Recover player from')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Recover player from'), { target: { value: 'p3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover player', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Send recovery prompt' }));
    expect(latestClient.requestBoardRecovery).toHaveBeenCalledWith('p2', 'p3', 30);
  });

  it('keeps All Tropes open after proposing a trope from its list', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore & Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'All Tropes (25)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trope 1' }));
    fireEvent.click(screen.getByRole('button', { name: '👍 Propose it happened' }));

    expect(screen.getByRole('heading', { name: 'All Tropes (25)' })).toBeInTheDocument();
  });

  it('shows the saved proposal context read-only for an accepted trope', async () => {
    clientState.started = true;
    clientState.acceptedTropes = ['Trope 1'];
    clientState.claimHistory = [
      {
        id: 'claim-1',
        text: 'Trope 1',
        approved: true,
        sceneContexts: [
          { playerId: 'p2', timestamp: 'Around the halfway point', note: 'Kitchen scene' },
          { playerId: 'p1', timestamp: 'Near the ending', note: '' },
        ],
      },
    ];
    await hostTutorialView();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore & Stats' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accepted Tropes (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trope 1', exact: true }));

    expect(screen.getByText('Original proposal context')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Ashley')).toBeInTheDocument();
    expect(screen.getByText('Around the halfway point')).toBeInTheDocument();
    expect(screen.getByText('Kitchen scene')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movie timestamp')).toBeNull();
    expect(screen.queryByLabelText('Scene note')).toBeNull();
  });

  it('offers to keep or drop a missed call and preserves the call when kept', async () => {
    clientState.started = true;
    clientState.calls = { p1: 'Trope 1', p2: 'Trope 1' };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    act(() =>
      latestClient.onEvent({
        type: 'claimResolved',
        kind: 'mark',
        approved: true,
        text: 'Trope 2',
        byId: 'p2',
        missedCalls: [
          { playerId: 'p1', text: 'Trope 1' },
          { playerId: 'p2', text: 'Trope 1' },
        ],
      }),
    );
    expect(screen.getByRole('heading', { name: "Your call didn't happen next" })).toBeInTheDocument();
    expect(screen.getByText(/Trope 2.*Trope 1.*keep the call/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my call' }));
    expect(clientState.calls.p1).toBe('Trope 1');
    expect(latestClient.toggleCall).not.toHaveBeenCalled();

    act(() =>
      latestClient.onEvent({
        type: 'claimResolved',
        kind: 'mark',
        approved: true,
        text: 'Trope 3',
        byId: 'p2',
        missedCalls: [{ playerId: 'p1', text: 'Trope 1' }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Drop my call' }));
    expect(latestClient.toggleCall).toHaveBeenCalledWith('Trope 1');
    expect(clientState.calls.p1).toBeUndefined();
    expect(screen.queryByRole('heading', { name: "Your call didn't happen next" })).toBeNull();
  });

  it('clears a stale missed-call prompt when the call changes and ignores another players missed call', async () => {
    clientState.started = true;
    clientState.calls = { p1: 'Trope 1', p2: 'Trope 2' };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    act(() =>
      latestClient.onEvent({
        type: 'claimResolved',
        kind: 'mark',
        approved: true,
        text: 'Trope 3',
        byId: 'p2',
        missedCalls: [{ playerId: 'p2', text: 'Trope 2' }],
      }),
    );
    expect(screen.queryByRole('heading', { name: "Your call didn't happen next" })).toBeNull();
    act(() =>
      latestClient.onEvent({
        type: 'claimResolved',
        kind: 'mark',
        approved: true,
        text: 'Trope 4',
        byId: 'p2',
        missedCalls: [{ playerId: 'p1', text: 'Trope 1' }],
      }),
    );
    expect(screen.getByRole('heading', { name: "Your call didn't happen next" })).toBeInTheDocument();
    act(() => {
      clientState.calls.p1 = 'Trope 5';
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.queryByRole('heading', { name: "Your call didn't happen next" })).toBeNull();
    expect(clientState.calls.p1).toBe('Trope 5');
  });

  it('shows shared caller avatars on the board and all caller names when a space is clicked', async () => {
    clientState.started = true;
    clientState.calls = { p1: 'Trope 1', p2: 'Trope 1' };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(screen.queryByText(/Game in progress/)).toBeNull();
    const indicator = screen.getByLabelText('Called by Ashley, Bob');
    fireEvent.click(indicator);
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show players calling this trope' })[0]);
    expect(screen.getByRole('heading', { name: 'Called to happen next' })).toBeInTheDocument();
    const callers = screen.getByRole('list', { name: 'Players calling this trope' });
    expect(
      within(callers)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['🎬 Ashley', '🍿 Bob']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    fireEvent.click(indicator);
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Show players calling this trope' })[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('renders shared superlatives without changing them based on viewer-local clicks', async () => {
    clientState.started = true;
    clientState.acceptedTropes = ['Trope 1'];
    clientState.players.p1.marked = [0];
    clientState.players.p2.marked = [0];
    clientState.superlativeStats = {
      p1: { views: 6, submissions: 2, viewedTropes: clientState.players.p1.board.slice(0, 5) },
      p2: { views: 10, submissions: 2, viewedTropes: clientState.players.p2.board.slice(0, 7) },
    };
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(screen.getByRole('button', { name: 'Superlative: Most Thoughtful' }).closest('li')).toHaveTextContent('Bob');
    fireEvent.click(screen.getByText('Trope 2', { exact: true }));
    expect(latestClient.recordTropeView).toHaveBeenCalledWith('Trope 2');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(screen.getByRole('button', { name: 'Superlative: Most Thoughtful' }).closest('li')).toHaveTextContent('Bob');
  });

  it.each([true, false])(
    'opens saved movie details from the title with editing only for hosts (host: %s)',
    async (host) => {
      clientState.started = true;
      clientState.hostIds = host ? ['p1'] : ['p2'];
      clientState.movie = {
        title: 'Cached Movie',
        year: '2024',
        type: 'movie',
        director: 'A Director',
        actors: 'An Actor',
      };
      render(<App />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
      fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
      await screen.findByText('Code: ABCD');
      fireEvent.click(screen.getByRole('button', { name: /Now watching.*Cached Movie/ }));
      expect(await screen.findByText('Directed by A Director')).toBeInTheDocument();
      expect(screen.getByText('Starring An Actor')).toBeInTheDocument();
      if (host) {
        expect(screen.getByLabelText('Manual title')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Use manual title' })).toBeDisabled();
      } else {
        expect(screen.queryByLabelText('Manual title')).toBeNull();
        expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeInTheDocument();
      }
    },
  );

  it('restores called-hit markings and exposes the successful callers without replaying acceptance animation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    clientState.started = true;
    clientState.players.p1.marked = [0];
    clientState.acceptedTropes = ['Trope 1'];
    clientState.acceptedCalls = {
      'Trope 1': [
        { id: 'p2', name: 'Earlier Bob', avatar: '🎬' },
        { id: 'former', name: 'Former Player', avatar: '⭐' },
      ],
    };
    const { container } = render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    expect(screen.getByText('Trope 1', { exact: true })).toHaveClass('call-hit', 'marked');
    expect(container.querySelector('.call-hit-flash')).toBeNull();
    fireEvent.click(screen.getByRole('img', { name: 'Called trope accepted' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Show successful callers' })[0]);
    expect(screen.getByRole('heading', { name: 'Called it correctly' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Players who called this trope correctly' })).toHaveTextContent('🍿 Bob');
    expect(screen.getByRole('list', { name: 'Players who called this trope correctly' })).toHaveTextContent(
      '⭐ Former Player',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    act(() => {
      clientState.players.p1.marked = [];
      clientState.acceptedTropes = [];
      clientState.acceptedCalls = {};
      latestClient.onState(clientState, 'p1');
    });
    expect(screen.queryByRole('img', { name: 'Called trope accepted' })).toBeNull();
  });

  it('includes player avatars in activity approval notifications', async () => {
    clientState.started = true;
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');
    act(() =>
      latestClient.onEvent({
        type: 'claimResolved',
        kind: 'mark',
        approved: true,
        text: 'Trope 1',
        byId: 'p2',
        approvedBy: [
          { id: 'p1', name: 'Ashley', avatar: '🎬' },
          { id: 'p2', name: 'Bob', avatar: '🍿' },
        ],
      }),
    );
    expect(screen.getByText(/Approved by/)).toHaveTextContent('Approved by 🎬 Ashley and 🍿 Bob.');
  });

  it.each([false, true])('opens call explanations from the live list and recap (recap: %s)', async (recap) => {
    clientState.started = true;
    clientState.gameOver = recap;
    clientState.callStats = { p1: { made: 3, correct: 1 }, p2: { made: 0, correct: 0 } };
    clientState.callHistory = {
      p1: [
        { id: 'call-1', text: 'Trope 1', status: 'scored' },
        { id: 'call-2', text: 'Trope 2', status: 'withdrawn' },
        { id: 'call-3', text: 'Trope 3', status: 'active' },
      ],
      p2: [{ id: 'other-call', text: 'Another player trope', status: 'scored' }],
    };
    await hostTutorialView();
    if (recap) {
      fireEvent.click(screen.getByRole('button', { name: 'Menu', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: '🏁 View Recap' }));
    }
    const root = recap ? document.querySelector('.recap-list') : document.querySelector('.players-panel');
    expect(within(root).queryByRole('button', { name: '📣 0/0 calls' })).toBeNull();
    fireEvent.click(within(root).getByRole('button', { name: '📣 1/3 calls' }));
    const explanation = screen.getByRole('heading', { name: 'Call it next', exact: true }).parentElement;
    expect(explanation).toHaveTextContent('🎬 Ashley: 1 correct / 3 calls made');
    expect(explanation).toHaveTextContent('Advanced actions, then Call it next');
    expect(explanation).toHaveTextContent('including changed or withdrawn predictions');
    const calls = within(explanation).getByRole('list', { name: 'Calls made by Ashley' });
    expect(
      within(calls)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Trope 1 · Scored', 'Trope 2 · Withdrawn', `Trope 3 · ${recap ? 'Not scored' : 'Waiting'}`]);
    expect(calls).not.toHaveTextContent('Another player trope');
    fireEvent.click(within(explanation).getByRole('button', { name: 'Close', exact: true }));
    expect(screen.queryByRole('heading', { name: 'Call it next', exact: true })).toBeNull();
    if (recap) expect(screen.getByRole('heading', { name: '🏁 Game Over — Recap' })).toBeInTheDocument();
  });

  it('shows known legacy calls with an honest notice about missing history', async () => {
    clientState.started = true;
    clientState.callStats = { p1: { made: 4, correct: 2 } };
    clientState.calls = { p1: 'Trope 2' };
    clientState.acceptedCalls = {
      'Trope 1': [{ id: 'p1', name: 'Ashley', avatar: '🎬' }],
      'Other player call': [{ id: 'p2', name: 'Bob', avatar: '🍿' }],
    };
    await hostTutorialView();
    fireEvent.click(screen.getByRole('button', { name: '📣 2/4 calls' }));
    const calls = screen.getByRole('list', { name: 'Calls made by Ashley' });
    expect(calls).toHaveTextContent('Trope 1 · Scored');
    expect(calls).toHaveTextContent('Trope 2 · Waiting');
    expect(calls).not.toHaveTextContent('Other player call');
    expect(screen.getByText(/Some earlier calls were not recorded individually/)).toBeInTheDocument();
  });

  it('switches the page theme from the guided theme step', async () => {
    localStorage.setItem('bingo-tutorial-enabled', 'true');
    await hostTutorialView();
    await screen.findByRole('dialog');
    while (!screen.queryByRole('heading', { name: 'Choose light or dark' })) {
      fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    }
    expect(document.querySelector('[data-tutorial="theme"]')).toBeInTheDocument();
    const wasDark = document.body.classList.contains('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle light/dark mode' }));
    expect(document.body.classList.contains('dark')).toBe(!wasDark);
    expect(localStorage.getItem('bingo-theme')).toBe(wasDark ? 'light' : 'dark');
  });
});
