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
    onAssignHost: vi.fn(),
    onResignHost: vi.fn(),
    hostCount: 2,
    onResetGame: vi.fn(),
    onEndGame: vi.fn(),
    onResumeGame: vi.fn(),
    onViewRecap: vi.fn(),
    onLeaveGame: vi.fn(),
    onCopyInviteLink: vi.fn(),
    onShowInviteQr: vi.fn(),
    advancedGameplay: true,
    onToggleAdvancedGameplay: vi.fn(),
    onSubmitCustomTrope: vi.fn(),
    onRequestBoardSwap: vi.fn(),
    marathonEnabled: false,
    onShowMarathonStandings: vi.fn(),
    onShowStatsDashboard: vi.fn(),
    ...overrides,
  };
  render(<GameMenu {...props} />);
  return props;
}

describe('GameMenu', () => {
  it('shows game info and started-game actions', () => {
    renderMenu();

    expect(screen.getByRole('button', { name: 'Genres: Horror, Comedy' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Sub-genres: Slasher')).toBeNull();
    expect(screen.getByRole('button', { name: 'Explore & Stats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Host Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🎯 Manage Wagers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Accepted Tropes (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🏁 End Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🔄 Reset Game' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use Simple Options' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: '🎬 Set Movie / Show' })).toBeNull();
  });

  it('shows advanced game details when the genre summary is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Genres: Horror, Comedy' }));
    expect(screen.getByText('Sub-genres: Slasher')).toBeInTheDocument();
    expect(screen.getByText('General mix: Horror 50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Genres: Horror, Comedy' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Genres: Horror, Comedy' }));
    expect(screen.queryByText('Sub-genres: Slasher')).toBeNull();
  });

  it('hides general mix details when no subgenres are selected', () => {
    renderMenu({ subgenreLabels: 'Classic / Mixed only', generalMixLabels: '' });

    fireEvent.click(screen.getByRole('button', { name: 'Genres: Horror, Comedy' }));
    expect(screen.getByText('Sub-genres: Classic / Mixed only')).toBeInTheDocument();
    expect(screen.queryByText(/General mix:/)).toBeNull();
  });

  it('runs an action and closes the menu', () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Explore & Stats' }));
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
    expect(screen.getByRole('button', { name: '▶️ Resume Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🏁 End Game' })).toBeNull();
    expect(screen.queryByRole('button', { name: '📝 Submit Custom Trope' })).toBeNull();
  });

  it('runs the resume action and closes the menu', () => {
    const props = renderMenu({ gameOver: true });

    fireEvent.click(screen.getByRole('button', { name: '▶️ Resume Game' }));
    expect(props.onResumeGame).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('opens game stats and marathon history from the advanced menu', () => {
    const props = renderMenu({ marathonEnabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Explore & Stats' }));
    fireEvent.click(screen.getByRole('button', { name: '📊 Game Stats' }));
    expect(props.onShowStatsDashboard).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '🎬 Marathon History' }));
    expect(props.onShowMarathonStandings).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('hides advanced actions until advanced options are enabled', () => {
    renderMenu({ advancedGameplay: false });

    expect(screen.getByRole('button', { name: 'Advanced Options' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Tropes (40)' })).toBeNull();
    expect(screen.queryByRole('button', { name: '🎯 Manage Wagers' })).toBeNull();
    expect(screen.queryByRole('button', { name: '📊 Game Stats' })).toBeNull();
    expect(screen.queryByRole('button', { name: '⏳ Session Lifetime' })).toBeNull();
  });

  it('shows session lifetime only in advanced options for a host', () => {
    renderMenu({ advancedGameplay: true, isHost: true });
    expect(screen.queryByRole('button', { name: '⏳ Session Lifetime' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Host Settings' }));
    expect(screen.getByRole('button', { name: '⏳ Session Lifetime' })).toBeInTheDocument();
  });

  it('switches between advanced option sections instead of expanding them all at once', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Explore & Stats' }));
    expect(screen.getByRole('button', { name: 'All Tropes (40)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🎯 Manage Wagers' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'My Tools' }));
    expect(screen.queryByRole('button', { name: 'All Tropes (40)' })).toBeNull();
    expect(screen.getByRole('button', { name: '🎯 Manage Wagers' })).toBeInTheDocument();
  });

  it('lets any player access whole-board swap from My Tools', () => {
    renderMenu({ isHost: false });

    expect(screen.queryByRole('button', { name: 'Host Settings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'My Tools' }));
    expect(screen.getByRole('button', { name: '🔀 Swap My Whole Board' })).toBeInTheDocument();
  });
});
