import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JoinRequestModal from './JoinRequestModal.jsx';

describe('JoinRequestModal', () => {
  it('lets the host approve, deny, or deny and rotate', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    const onDenyAndRotate = vi.fn();
    render(<JoinRequestModal name="Mallory" onApprove={onApprove} onDeny={onDeny} onDenyAndRotate={onDenyAndRotate} />);

    fireEvent.click(screen.getByRole('button', { name: '✅ Approve' }));
    fireEvent.click(screen.getByRole('button', { name: '❌ Deny' }));
    fireEvent.click(screen.getByRole('button', { name: /Deny & Rotate Game Code/ }));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onDenyAndRotate).toHaveBeenCalledTimes(1);
  });
});
