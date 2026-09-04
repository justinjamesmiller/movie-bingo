import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerManagementModal from './PlayerManagementModal.jsx';

describe('PlayerManagementModal', () => {
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
});
