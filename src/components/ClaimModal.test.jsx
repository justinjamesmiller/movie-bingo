import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClaimModal from './ClaimModal.jsx';

vi.mock('../hooks/useTropeDescription.js', () => ({
  useTropeDescription: () => ({ description: null }),
}));

const players = [
  { id: 'p1', name: 'Justin', avatar: '🎬' },
  { id: 'p2', name: 'Sidney', avatar: '🍿' },
];

function pendingClaim(overrides = {}) {
  return {
    claimId: 'claim-1',
    byId: 'p1',
    text: 'Character returns home after years',
    kind: 'mark',
    votes: { p1: true },
    totalPlayers: 2,
    ...overrides,
  };
}

describe('ClaimModal', () => {
  it('shows how many votes are still needed before majority is reached', () => {
    render(
      <ClaimModal
        pendingClaim={pendingClaim()}
        myId="p1"
        players={players}
        onAgree={vi.fn()}
        onDisagree={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 agree so far \(1\/2 voted, 2 needed for majority\)/)).toBeInTheDocument();
  });

  it('does not say majority is still needed when every vote agrees', () => {
    render(
      <ClaimModal
        pendingClaim={pendingClaim({ votes: { p1: true, p2: true } })}
        myId="p1"
        players={players}
        onAgree={vi.fn()}
        onDisagree={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Finalizing the result…')).toBeInTheDocument();
    expect(screen.getByText(/2 agree so far \(2\/2 voted, majority reached\)/)).toBeInTheDocument();
    expect(screen.queryByText(/majority needed/i)).toBeNull();
  });
});
