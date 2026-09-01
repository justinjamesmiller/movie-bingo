import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmModal from './ConfirmModal.jsx';

describe('ConfirmModal', () => {
  it('renders the title and message', () => {
    render(<ConfirmModal title="Leave the game?" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Leave the game?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('uses the provided confirm/cancel labels', () => {
    render(
      <ConfirmModal
        title="End the game?"
        message="This ends play for everyone."
        confirmLabel="🏁 End Game"
        cancelLabel="Not yet"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '🏁 End Game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal title="Leave?" message="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="Leave?" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
