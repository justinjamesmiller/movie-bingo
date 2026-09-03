import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KickConfirmModal from './KickConfirmModal.jsx';

describe('KickConfirmModal', () => {
  it('confirms removal or cancels from the backdrop', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<KickConfirmModal playerName="Bob" onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByRole('heading', { name: 'Remove Bob from the game?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Player' }));
    fireEvent.mouseDown(document.querySelector('.modal'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
