import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HostPromotionModal from './HostPromotionModal.jsx';

describe('HostPromotionModal', () => {
  it('names the promoting host and explains host responsibilities', () => {
    const onClose = vi.fn();
    render(<HostPromotionModal promotedBy="Ashley" promotedByAvatar="👻" onClose={onClose} />);

    expect(screen.getByText('👻 Ashley made you a host.')).toBeInTheDocument();
    expect(screen.getByText(/end the game when it is finished/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got It' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
