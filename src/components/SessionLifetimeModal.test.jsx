import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionLifetimeModal from './SessionLifetimeModal.jsx';

describe('SessionLifetimeModal', () => {
  it('enables extended durations and submits the selected lifetime', () => {
    const onConfirm = vi.fn();
    render(<SessionLifetimeModal currentExtended={false} currentHours={12} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /extended period/i }));
    fireEvent.change(screen.getByLabelText('Time until the game expires'), { target: { value: '168' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restart countdown' }));

    expect(onConfirm).toHaveBeenCalledWith(true, 168);
  });

  it('submits the standard lifetime when extended mode is disabled', () => {
    const onConfirm = vi.fn();
    render(<SessionLifetimeModal currentExtended={true} currentHours={168} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /extended period/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart countdown' }));

    expect(onConfirm).toHaveBeenCalledWith(false, 12);
  });
});
