import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerManagementModal from './PlayerManagementModal.jsx';

describe('PlayerManagementModal', () => {
  it.each([true, false])('offers self stats and editing without host-management actions (host: %s)', (isHost) => {
    const onViewStats = vi.fn();
    const onEditProfile = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'alice', name: 'Alice', avatar: '🎬' }}
        isHost={isHost}
        isSelf
        onViewStats={onViewStats}
        onEditProfile={onEditProfile}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Options for 🎬 Alice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '👑 Add Host' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose Name & Avatar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '📊 View Stats' }));
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit Name & Avatar' }));
    expect(onViewStats).toHaveBeenCalledTimes(1);
    expect(onEditProfile).toHaveBeenCalledTimes(1);
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

  it('lets a host restore a disconnected board onto the selected connected player', () => {
    const onRestoreBoard = vi.fn();
    render(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey', avatar: '🎬' }}
        isHost={false}
        canRestoreBoard
        disconnectedPlayers={[{ id: 'old-seat', name: 'Casey old seat', avatar: '🍿' }]}
        onRestoreBoard={onRestoreBoard}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Restore board from'), { target: { value: 'old-seat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore board and remove old seat' }));
    expect(onRestoreBoard).toHaveBeenCalledWith('old-seat');
  });

  it('hides board restoration when the viewer is not a host or no old seats exist', () => {
    const { rerender } = render(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey' }}
        isHost={false}
        canRestoreBoard={false}
        disconnectedPlayers={[{ id: 'old-seat', name: 'Casey old seat' }]}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Restore board from')).toBeNull();

    rerender(
      <PlayerManagementModal
        player={{ id: 'new-seat', name: 'Casey' }}
        isHost={false}
        canRestoreBoard
        disconnectedPlayers={[]}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Restore board from')).toBeNull();
  });
});
