import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HostRecoveryPasswordModal from './HostRecoveryPasswordModal.jsx';

describe('HostRecoveryPasswordModal', () => {
  it('requires a matching password of at least 2 characters', () => {
    const onConfirm = vi.fn();
    render(<HostRecoveryPasswordModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    const password = screen.getByLabelText('New password');
    const confirmation = screen.getByLabelText('Confirm password');
    const submit = screen.getByRole('button', { name: 'Set recovery password' });

    fireEvent.change(password, { target: { value: 'x' } });
    fireEvent.change(confirmation, { target: { value: 'x' } });
    expect(submit).toBeDisabled();
    fireEvent.change(password, { target: { value: 'xy' } });
    expect(submit).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: 'xy' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith('xy');
  });
});
