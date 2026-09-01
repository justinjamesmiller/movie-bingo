import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameOverModal from './GameOverModal.jsx';

function player(overrides) {
  return { id: '1', name: 'Alice', avatar: '🎬', board: [], wagered: [], marked: [], ...overrides };
}

describe('GameOverModal', () => {
  it('shows each player with their marked count and wager hit rate', () => {
    render(
      <GameOverModal
        players={[
          player({ id: '1', name: 'Alice', marked: [0, 1], wagered: [0, 2] }),
          player({ id: '2', name: 'Bob', avatar: '🍿', marked: [0], wagered: [] }),
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 tropes marked · 1\/2 wagers hit/)).toBeInTheDocument();
    expect(screen.getByText(/1 tropes marked · 0\/0 wagers hit/)).toBeInTheDocument();
  });

  it('crowns the player with the most tropes marked', () => {
    render(
      <GameOverModal
        players={[player({ id: '1', name: 'Alice', marked: [0, 1, 2] }), player({ id: '2', name: 'Bob', marked: [0] })]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Alice/).textContent).toContain('🏆');
    expect(screen.getByText(/Bob/).textContent).not.toContain('🏆');
  });

  it('does not show a crown when no one has marked anything', () => {
    render(<GameOverModal players={[player({ marked: [] })]} onClose={vi.fn()} />);
    expect(screen.getByText(/Alice/).textContent).not.toContain('🏆');
  });

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn();
    render(<GameOverModal players={[player()]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
