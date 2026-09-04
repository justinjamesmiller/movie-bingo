import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InviteQrModal from './InviteQrModal.jsx';

describe('InviteQrModal', () => {
  it('renders a scannable QR code for the current invite URL', () => {
    render(<InviteQrModal inviteUrl="https://example.com/bingo?code=ABCD" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Join This Game' })).toBeInTheDocument();
    expect(document.querySelector('.invite-qr-code svg')).toBeInTheDocument();
  });
});
