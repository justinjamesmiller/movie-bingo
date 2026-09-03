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
    onResetGame: vi.fn(),
    onEndGame: vi.fn(),
    onViewRecap: vi.fn(),
    onLeaveGame: vi.fn(),
    onCopyCode: vi.fn(),
    onCopyInviteLink: vi.fn(),
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
    expect(screen.getByRole('button', { name: 'Accepted Tropes (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🎯 Manage Wagers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🏁 End Game' })).toBeInTheDocument();
  });

  it('runs an action and closes the menu', () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'All Tropes (40)' }));
    expect(props.onShowAllTropes).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses recap mode after the game ends', () => {
    renderMenu({ gameOver: true });

    expect(screen.getByRole('button', { name: '🏁 View Recap' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🏁 End Game' })).toBeNull();
    expect(screen.queryByRole('button', { name: '📝 Submit Custom Trope' })).toBeNull();
  });
});
