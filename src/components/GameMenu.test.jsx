import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameMenu from './GameMenu.jsx';

function renderMenu(overrides = {}) {
  const props = {
    open: true,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    genreLabels: 'Horror, Comedy',
    subgenreLabels: 'Slasher',
    generalMixLabels: 'Horror 50%',
    started: true,
    gameOver: false,
    isHost: true,
    acceptedCount: 2,
    tropePoolCount: 40,
    onShowAcceptedTropes: vi.fn(),
    onShowAssignWager: vi.fn(),
    onShowAllTropes: vi.fn(),
    onShowAllWagers: vi.fn(),
    onShowActivityFeed: vi.fn(),
    onBoardFocus: vi.fn(),
    onChangeName: vi.fn(),
    onAssignHost: vi.fn(),
    onResignHost: vi.fn(),
    hostCount: 2,
    onResetGame: vi.fn(),
    onEndGame: vi.fn(),
    onViewRecap: vi.fn(),
    onLeaveGame: vi.fn(),
    onCopyInviteLink: vi.fn(),
    onShowInviteQr: vi.fn(),
    advancedGameplay: true,
    onToggleAdvancedGameplay: vi.fn(),
    onSubmitCustomTrope: vi.fn(),
    onRequestBoardSwap: vi.fn(),
    ...overrides,
  };
  render(<GameMenu {...props} />);
  return props;
}

describe('GameMenu', () => {
  it('shows game info and started-game actions', () => {
    renderMenu();

    expect(screen.getByText('Genres: Horror, Comedy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced Details' })).toBeInTheDocument();
    expect(screen.queryByText('Sub-genres: Slasher')).toBeNull();
    expect(screen.getByRole('button', { name: 'Accepted Tropes (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🎯 Manage Wagers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resign as Host' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🏁 End Game' })).toBeInTheDocument();
  });

  it('toggles advanced game details', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Details' }));
    expect(screen.getByText('Sub-genres: Slasher')).toBeInTheDocument();
    expect(screen.getByText('General mix: Horror 50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple Details' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simple Details' }));
    expect(screen.queryByText('Sub-genres: Slasher')).toBeNull();
    expect(screen.getByRole('button', { name: 'Advanced Details' })).toBeInTheDocument();
  });

  it('hides general mix details when no subgenres are selected', () => {
    renderMenu({ subgenreLabels: 'Classic / Mixed only', generalMixLabels: '' });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Details' }));
    expect(screen.getByText('Sub-genres: Classic / Mixed only')).toBeInTheDocument();
    expect(screen.queryByText(/General mix:/)).toBeNull();
  });

  it('runs an action and closes the menu', () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'All Tropes (40)' }));
    expect(props.onShowAllTropes).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the QR invite action and closes the menu', () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'QR Code' }));
    expect(props.onShowInviteQr).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses recap mode after the game ends', () => {
    renderMenu({ gameOver: true });

    expect(screen.getByRole('button', { name: '🏁 View Recap' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🏁 End Game' })).toBeNull();
    expect(screen.queryByRole('button', { name: '📝 Submit Custom Trope' })).toBeNull();
  });

  it('hides advanced actions until advanced gameplay is enabled', () => {
    renderMenu({ advancedGameplay: false });

    expect(screen.getByRole('button', { name: 'Advanced Gameplay' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Tropes (40)' })).toBeNull();
    expect(screen.queryByRole('button', { name: '🎯 Manage Wagers' })).toBeNull();
  });
});
