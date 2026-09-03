import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JoinChoiceModal from './JoinChoiceModal.jsx';

describe('JoinChoiceModal', () => {
  it('lets a player reclaim a disconnected seat or join as new', () => {
    const onClaimSeat = vi.fn();
    const onJoinAsNew = vi.fn();
    render(
      <JoinChoiceModal
        name="Bob"
        options={[{ id: 'p1', name: 'Old Bob' }]}
        allowNew
        busy={false}
        onClaimSeat={onClaimSeat}
        onJoinAsNew={onJoinAsNew}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Old Bob' }));
    fireEvent.click(screen.getByRole('button', { name: /join as a new player/i }));
    expect(onClaimSeat).toHaveBeenCalledWith('p1');
    expect(onJoinAsNew).toHaveBeenCalledTimes(1);
  });

  it('does not close from the backdrop while busy', () => {
    const onCancel = vi.fn();
    render(
      <JoinChoiceModal
        name="Bob"
        options={[]}
        allowNew={false}
        busy
        onClaimSeat={vi.fn()}
        onJoinAsNew={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
