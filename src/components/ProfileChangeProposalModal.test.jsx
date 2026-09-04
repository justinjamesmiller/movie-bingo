import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileChangeProposalModal from './ProfileChangeProposalModal.jsx';

describe('ProfileChangeProposalModal', () => {
  it('shows the proposed profile and lets the player accept or decline', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <ProfileChangeProposalModal
        proposal={{ name: 'Robert', avatar: '🎬' }}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    expect(screen.getByText('🎬 Robert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
