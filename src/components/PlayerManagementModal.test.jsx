import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerManagementModal from './PlayerManagementModal.jsx';

describe('PlayerManagementModal', () => {
  it.each([0, 10, 30, 300])('offers recovery with a %s-second response window and explicit confirmation', (timeout) => {
    const onRequestBoardRecovery = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'new', name: 'New session', connected: true }}
        isHost={false}
        canRestoreBoard
        recoverablePlayers={[{ id: 'old', name: 'Original player', connected: true }]}
        onRequestBoardRecovery={onRequestBoardRecovery}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Recover player from'), { target: { value: 'old' } });
    fireEvent.change(screen.getByLabelText('Response time'), { target: { value: String(timeout) } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover player', exact: true }));
    expect(onRequestBoardRecovery).not.toHaveBeenCalled();
    expect(screen.getByText(/Their current progress will be replaced/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: timeout === 0 ? 'Recover immediately' : 'Send recovery prompt' }),
    );
    expect(onRequestBoardRecovery).toHaveBeenCalledWith('old', timeout);
  });
  it.each([true, false])('offers self stats and editing without host-management actions (host: %s)', (isHost) => {
    const onViewStats = vi.fn();
    const onEditProfile = vi.fn();
    const onBadgeProgress = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'alice', name: 'Alice', avatar: '🎬' }}
        isHost={isHost}
        isSelf
        onViewStats={onViewStats}
        onEditProfile={onEditProfile}
        onBadgeProgress={onBadgeProgress}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Options for 🎬 Alice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👑 Add Host' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose Name & Avatar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '📊 View Stats' }));
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit Name & Avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Badge Progress' }));
    expect(onViewStats).toHaveBeenCalledTimes(1);
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onBadgeProgress).toHaveBeenCalledTimes(1);
  });

  it('lets a host add a player as host or propose a profile change', () => {
    const onAddHost = vi.fn();
    const onProposeProfile = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'bob', name: 'Bob', avatar: '🍿' }}
        isHost={false}
        onAddHost={onAddHost}
        onProposeProfile={onProposeProfile}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '👑 Add Host' }));
    fireEvent.click(screen.getByRole('button', { name: 'Propose Name & Avatar' }));
    expect(onAddHost).toHaveBeenCalledTimes(1);
    expect(onProposeProfile).toHaveBeenCalledTimes(1);
  });

  it('offers disconnected seats through the same confirmed recovery flow', () => {
    const onRequestBoardRecovery = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey', avatar: '🎬' }}
        isHost={false}
        canRestoreBoard
        recoverablePlayers={[{ id: 'old-seat', name: 'Casey old seat', avatar: '🍿', connected: false }]}
        onRequestBoardRecovery={onRequestBoardRecovery}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Recover player from'), { target: { value: 'old-seat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover player', exact: true }));
    expect(onRequestBoardRecovery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send recovery prompt' }));
    expect(onRequestBoardRecovery).toHaveBeenCalledWith('old-seat', 30);
  });

  it('hides board restoration when the viewer is not a host or no old seats exist', () => {
    const { rerender } = render(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey' }}
        isHost={false}
        canRestoreBoard={false}
        recoverablePlayers={[{ id: 'old-seat', name: 'Casey old seat' }]}
        onRequestBoardRecovery={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Recover player from')).toBeNull();

    rerender(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey' }}
        isHost={false}
        canRestoreBoard
        recoverablePlayers={[]}
        onRequestBoardRecovery={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Recover player from')).toBeNull();
  });
});
