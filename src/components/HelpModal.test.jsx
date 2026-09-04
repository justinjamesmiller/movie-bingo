import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HelpModal from './HelpModal.jsx';

describe('HelpModal', () => {
  it('shows current gameplay guidance and closes', () => {
    const onClose = vi.fn();
    render(<HelpModal onClose={onClose} />);

    expect(screen.getByRole('heading', { name: '❓ How to Play' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '⚙️ Advanced gameplay' })).toBeInTheDocument();
    expect(screen.getByText(/Add Host/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
