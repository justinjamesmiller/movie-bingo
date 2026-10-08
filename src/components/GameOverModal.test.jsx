import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameOverModal from './GameOverModal.jsx';

function player(overrides) {
  return { id: '1', name: 'Alice', avatar: '🎬', board: [], wagered: [], marked: [], ...overrides };
}

describe('GameOverModal', () => {
  it('shows successful calls, a deduplicated multi-line finish, and disputed scene context', () => {
    render(
      <GameOverModal
        players={[player()]}
        onClose={vi.fn()}
        watchState={{
          acceptedCalls: { 'Jump Scare': [{ id: '1', name: 'Alice', avatar: '🎬' }] },
          bingoEvents: [
            { playerId: '1', claimId: 'double', newLines: 2, totalLines: 2 },
            { playerId: '1', claimId: 'double', newLines: 2, totalLines: 2 },
          ],
          claimHistory: [
            {
              id: 'debate',
              text: 'A clue appears',
              kind: 'mark',
              approved: false,
              proposerIds: ['1'],
              reasons: { 'Not clear enough': 2 },
              sceneContexts: [{ playerId: '1', timestamp: '12:34', note: 'Kitchen scene' }],
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Called it correctly' })).toBeInTheDocument();
    expect(screen.getByText('Jump Scare')).toBeInTheDocument();
    expect(screen.getAllByText(/2 lines completed at once/)).toHaveLength(1);
    expect(screen.getByText(/12:34.*Kitchen scene/)).toBeInTheDocument();
    expect(screen.getByText('Reasons: Not clear enough (2)')).toBeInTheDocument();
  });

  it('shows each player with their marked count, bingos, and wager hit rate', () => {
    const onCallScoreClick = vi.fn();
    render(
      <GameOverModal
        players={[
          player({ id: '1', name: 'Alice', marked: [0, 1], wagered: [0, 2] }),
          player({ id: '2', name: 'Bob', avatar: '🍿', marked: [0], wagered: [] }),
        ]}
        bingoCounts={{ 1: 1, 2: 0 }}
        callStats={{ 1: { made: 2, correct: 1 } }}
        onCallScoreClick={onCallScoreClick}
        onClose={vi.fn()}
      />,
    );
    const calls = screen.getByRole('button', { name: '📣 1/2 calls' });
    expect(calls.parentElement).toHaveTextContent('2 tropes marked · 1 bingo · 1/2 wagers hit');
    expect(screen.getByText(/1 tropes marked · 0 bingos · 0\/0 wagers hit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📣 0/0 calls' })).toBeNull();
    fireEvent.click(calls);
    expect(onCallScoreClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
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

  it('highlights the player with the most bingos', () => {
    render(
      <GameOverModal
        players={[player({ id: '1', name: 'Alice' }), player({ id: '2', name: 'Bob', avatar: '🍿' })]}
        bingoCounts={{ 1: 1, 2: 2 }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Bob/).textContent).toContain('🎉');
    expect(screen.getByText(/Alice/).textContent).not.toContain('🎉');
  });

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn();
    render(<GameOverModal players={[player()]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets non-hosts open the saved movie details from the recap', () => {
    const onMovieClick = vi.fn();
    render(
      <GameOverModal
        players={[player()]}
        movie={{ title: 'Cached Movie', poster: null }}
        isHost={false}
        onMovieClick={onMovieClick}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cached Movie' }));
    expect(onMovieClick).toHaveBeenCalledTimes(1);
  });

  it('does not label tied bingo, marked-trope, or wager totals as an exclusive leader', () => {
    render(
      <GameOverModal
        players={[
          player({ id: '1', name: 'Alice', marked: [0], wagered: [0] }),
          player({ id: '2', name: 'Bob', marked: [0], wagered: [0] }),
        ]}
        bingoCounts={{ 1: 1, 2: 1 }}
        onClose={vi.fn()}
      />,
    );
    for (const name of ['Alice', 'Bob']) {
      expect(screen.getByText(new RegExp(name)).textContent).not.toMatch(/🏆|🎉|🎯/);
    }
    expect(screen.getAllByText(/1 tropes marked · 1 bingo · 1\/1 wagers hit/)).toHaveLength(2);
  });
});
