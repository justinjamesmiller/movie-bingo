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
      onOpenWagerIntro={vi.fn()}
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

  it('always offers optional wagers but hides wager copy until the player opts in', () => {
    const onOpenWagerIntro = vi.fn();
    renderPanel({ wageringEnabled: false, onOpenWagerIntro });

    expect(screen.getByRole('button', { name: '🎯 Optional Wagers' })).toBeInTheDocument();
    expect(screen.queryByText(/Pick 5 spaces/)).toBeNull();
    expect(screen.queryByText(/Wagered:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '🎯 Optional Wagers' }));
    expect(onOpenWagerIntro).toHaveBeenCalledTimes(1);
  });

  it('hides wager-hit stats only for players without wagers', () => {
    renderPanel({ players: [{ ...players[0], wagered: [] }, players[1]] });

    expect(screen.getByText('2 marked · 1 bingo')).toBeInTheDocument();
    expect(screen.queryByText(/2 marked · 1 bingo ·/)).toBeNull();
    expect(screen.getByText('0 marked · 0 bingos · 0/1 wagered marked')).toBeInTheDocument();
  });

  it('opens the profile editor when the current player clicks their name or avatar', () => {
    const onEditSelf = vi.fn();
    renderPanel({ onEditSelf });

    fireEvent.click(screen.getByRole('button', { name: 'Edit name and avatar' }));
    expect(onEditSelf).toHaveBeenCalledTimes(1);
  });

  it('hides host-only remove controls and pre-game copy when appropriate', () => {
    renderPanel({ isHost: false, started: true });

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByText(/Pick 5 spaces/)).toBeNull();
  });
});
