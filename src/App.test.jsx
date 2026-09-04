import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('./net/relay.js', () => {
  class GameClient {
    static getSavedSession() {
      return null;
    }

    constructor({ onState }) {
      this.onState = onState;
    }

    async hostGame(name) {
      clientState.players.p1.name = name;
      this.onState(clientState, 'p1');
      return clientState.code;
    }

    destroy() {}
    startGame() {}
    proposeAccept() {}
    proposeReplace() {}
    challengeTrope() {}
    addHost(targetId) {
      clientState.hostIds = [...clientState.hostIds, targetId];
      this.onState(clientState, 'p1');
    }
    resignHost() {
      clientState.hostIds = clientState.hostIds.filter((id) => id !== 'p1');
      this.onState(clientState, 'p1');
    }
  }
  return { GameClient };
});

import App from './App.jsx';

describe('App', () => {
  beforeEach(() => {
    clientState = makeClientState();
  });

  it('hosts a game and renders the simple gameplay screen from relay state', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));

    expect(await screen.findByText('Code: ABCD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Advanced Gameplay' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👑 Add Host' })).toBeNull();
  });

  it('lets a host add another host from the players list and then resign through the menu', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: '🍿 Bob' }));
    expect(screen.getByRole('heading', { name: 'Manage Bob' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '👑 Add Host' }));

    expect(await screen.findAllByText('HOST')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Gameplay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resign as Host' }));
    expect(await screen.findAllByText('HOST')).toHaveLength(1);
  });

  it('keeps All Tropes open after proposing a trope from its list', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ashley'), { target: { value: 'Ashley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    await screen.findByText('Code: ABCD');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Gameplay' }));
    fireEvent.click(screen.getByRole('button', { name: 'All Tropes (25)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trope 1' }));
    fireEvent.click(screen.getByRole('button', { name: '👍 Propose it happened' }));

    expect(screen.getByRole('heading', { name: 'All Tropes (25)' })).toBeInTheDocument();
  });
});
