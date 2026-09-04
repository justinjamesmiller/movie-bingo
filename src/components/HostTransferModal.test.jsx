import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HostTransferModal from './HostTransferModal.jsx';

describe('HostTransferModal', () => {
  it('lets the host assign a connected player or leave without assigning', () => {
    const onAssign = vi.fn();
    const onLeaveWithoutAssign = vi.fn();
    render(
      <HostTransferModal
        players={[{ id: 'bob', name: 'Bob', avatar: '🍿' }]}
        onAssign={onAssign}
        onLeaveWithoutAssign={onLeaveWithoutAssign}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '🍿 Bob' }));
    expect(onAssign).toHaveBeenCalledWith('bob');
    fireEvent.click(screen.getByRole('button', { name: 'Leave Without Assigning' }));
    expect(onLeaveWithoutAssign).toHaveBeenCalledTimes(1);
  });

  it('supports assigning a host without presenting a leave action', () => {
    const onAssign = vi.fn();
    render(<HostTransferModal players={[{ id: 'bob', name: 'Bob' }]} onAssign={onAssign} onCancel={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Add a Host' })).toBeInTheDocument();
    expect(screen.getByText('Choose who should also host. They will manage the game from here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave Without Assigning' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));
    expect(onAssign).toHaveBeenCalledWith('bob');
  });
});
