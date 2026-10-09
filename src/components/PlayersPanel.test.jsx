import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayersPanel from './PlayersPanel.jsx';

const players = [
  { id: 'p1', name: 'Alice', avatar: '🎬', connected: true, wagered: [0, 1, 2, 3, 4], marked: [0, 2] },
  { id: 'p2', name: 'Bob', avatar: '🍿', connected: false, wagered: [1], marked: [] },
];

function renderPanel(overrides = {}) {
  return render(
    <PlayersPanel
      players={players}
      hostIds={['p1']}
      myId="p1"
      isHost
      wagerCount={3}
      maxWagers={5}
      started={false}
      bingoCounts={{ p1: 1, p2: 0 }}
      onKick={vi.fn()}
      wageringEnabled
      {...overrides}
    />,
  );
}

describe('PlayersPanel', () => {
  it('shows player status, readiness, bingo counts, and pre-game wager hint', () => {
    renderPanel();

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText('HOST')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('2 marked · 1 bingo · 2/5 wagered marked')).toBeInTheDocument();
    expect(screen.getByText(/Bob \(disconnected\)/)).toBeInTheDocument();
    expect(screen.getByText('0 marked · 0 bingos · 0/1 wagered marked')).toBeInTheDocument();
    expect(screen.getByText('Wagered: 3 / 5')).toBeInTheDocument();
  });

  it('lets the host request removing another player', () => {
    const onKick = vi.fn();
    renderPanel({ onKick });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onKick).toHaveBeenCalledWith('p2', 'Bob');
  });

  it('hides wager copy until the player opts in', () => {
    renderPanel({ wageringEnabled: false });

    expect(screen.queryByText(/Pick 5 spaces/)).toBeNull();
    expect(screen.queryByText(/Wagered:/)).toBeNull();
  });

  it('hides wager-hit stats only for players without wagers', () => {
    renderPanel({ players: [{ ...players[0], wagered: [] }, players[1]] });

    expect(screen.getByText('2 marked · 1 bingo')).toBeInTheDocument();
    expect(screen.queryByText(/2 marked · 1 bingo ·/)).toBeNull();
    expect(screen.getByText('0 marked · 0 bingos · 0/1 wagered marked')).toBeInTheDocument();
  });

  it('shows call metrics only after a player makes a call', () => {
    const onCallScoreClick = vi.fn();
    renderPanel({ callStats: { p1: { made: 2, correct: 1 }, p2: { made: 0, correct: 0 } }, onCallScoreClick });

    expect(screen.getByRole('button', { name: '📣 1/2 calls' }).closest('.player-stats')).toHaveTextContent('2 marked');
    expect(screen.getByText('0 marked · 0 bingos · 0/1 wagered marked')).not.toHaveTextContent('calls');
    fireEvent.click(screen.getByRole('button', { name: '📣 1/2 calls' }));
    expect(onCallScoreClick).toHaveBeenCalledWith(players[0]);
    expect(screen.queryByRole('button', { name: '📣 0/0 calls' })).toBeNull();
  });

  it('opens player options when the current player clicks their name or avatar', () => {
    const onEditSelf = vi.fn();
    renderPanel({ onEditSelf });

    fireEvent.click(screen.getByRole('button', { name: 'Your player options' }));
    expect(onEditSelf).toHaveBeenCalledTimes(1);
  });

  it('shows multiple badges alongside a current superlative and opens the selected award', () => {
    const onAwardClick = vi.fn();
    const patternHunter = { id: 'pattern-hunter', kind: 'badge', name: 'Pattern Hunter' };
    const wagerArchitect = { id: 'wager-architect', kind: 'badge', name: 'Wager Architect' };
    const almostBingos = { id: 'most-almost-bingos', kind: 'superlative', name: 'Most Almost-Bingos' };
    renderPanel({
      onAwardClick,
      awards: { p1: { superlatives: [almostBingos], badges: [wagerArchitect, patternHunter] } },
    });

    expect(screen.getByRole('button', { name: 'Superlative: Most Almost-Bingos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Badge: Wager Architect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Badge: Pattern Hunter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Badge: Wager Architect' }));
    expect(onAwardClick).toHaveBeenCalledWith(players[0], wagerArchitect);
  });

  it('hides host-only remove controls and pre-game copy when appropriate', () => {
    renderPanel({ isHost: false, started: true });

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByText(/Pick 5 spaces/)).toBeNull();
  });
});
