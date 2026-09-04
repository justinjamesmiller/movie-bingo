import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WagerIntroModal from './WagerIntroModal.jsx';

describe('WagerIntroModal', () => {
  it('explains optional wagers and lets the player opt in or skip', () => {
    const onAddWagers = vi.fn();
    const onSkip = vi.fn();
    render(<WagerIntroModal onAddWagers={onAddWagers} onSkip={onSkip} />);

    expect(screen.getByText(/completely optional/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Wagers' }));
    expect(onAddWagers).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for Now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
