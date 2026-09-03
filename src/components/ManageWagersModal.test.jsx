import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ManageWagersModal from './ManageWagersModal.jsx';

const board = ['Jump Scare', 'Door creaks', 'Blood splatter', 'FREE SPACE', 'Final apology'];

function renderModal(overrides = {}) {
  return render(
    <ManageWagersModal
      board={board}
      wagered={[0]}
      marked={[]}
      freeSpaceIndex={3}
      onSubmit={vi.fn()}
      onTropeClick={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ManageWagersModal', () => {
  it('previews a wager removal before staging it', () => {
    const onTropeClick = vi.fn();
    const onSubmit = vi.fn();
    renderModal({ onTropeClick, onSubmit });

    fireEvent.click(screen.getByRole('button', { name: 'Jump Scare' }));
    const preview = onTropeClick.mock.calls[0][0];
    expect(preview).toMatchObject({ text: 'Jump Scare', title: 'Remove this wager?', confirmLabel: '🗑️ Remove wager' });

    act(() => preview.onConfirm());
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onSubmit).toHaveBeenCalledWith([], [0]);
  });

  it('previews a wager addition and excludes marked/free-space cells', () => {
    const onTropeClick = vi.fn();
    renderModal({ marked: [2], onTropeClick });

    expect(screen.queryByRole('button', { name: /Blood splatter/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /FREE SPACE/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '☐ Door creaks' }));
    expect(onTropeClick.mock.calls[0][0]).toMatchObject({
      text: 'Door creaks',
      title: 'Add this wager?',
      confirmLabel: '☑ Add wager',
    });
  });
});
