import { fireEvent, render, screen } from '@testing-library/react';
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
  it.each(['p1', 'p2'])('hides queue controls behind advanced options for %s', (myId) => {
    const onBrowseQueue = vi.fn();
    const onShowQueue = vi.fn();
    render(
      <ClaimModal
        pendingClaim={pendingClaim()}
        myId={myId}
        players={players}
        onAgree={vi.fn()}
        onDisagree={vi.fn()}
        onCancel={vi.fn()}
        onBrowseQueue={onBrowseQueue}
        onShowQueue={onShowQueue}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Advanced options' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Queue another trope' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View waiting proposals' })).toBeNull();
    expect(
      screen.getByRole('button', { name: myId === 'p1' ? 'Cancel / undo my claim' : '👍 Agree, it happened' }),
    ).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Advanced options' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Queue another trope' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Queue another trope' }));
    fireEvent.click(screen.getByRole('button', { name: 'View waiting proposals' }));
    expect(onBrowseQueue).toHaveBeenCalledTimes(1);
    expect(onShowQueue).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Queue another trope' })).toBeInTheDocument();
  });

  it('keeps advanced options open for vote updates but resets them for a new proposal', () => {
    const props = {
      myId: 'p2',
      players,
      onAgree: vi.fn(),
      onDisagree: vi.fn(),
      onCancel: vi.fn(),
      onShowQueue: vi.fn(),
    };
    const view = render(<ClaimModal {...props} pendingClaim={pendingClaim()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced options' }));
    view.rerender(<ClaimModal {...props} pendingClaim={pendingClaim({ votes: { p1: true, p2: true } })} />);
    expect(screen.queryByRole('button', { name: 'Advanced options' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View waiting proposals' })).toBeInTheDocument();
    view.rerender(<ClaimModal {...props} pendingClaim={pendingClaim({ claimId: 'claim-2' })} />);
    expect(screen.getByRole('button', { name: 'Advanced options' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'View waiting proposals' })).toBeNull();
  });

  it('omits advanced options when there are no queue actions', () => {
    render(<ClaimModal pendingClaim={pendingClaim()} myId="p1" players={players} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Advanced options' })).toBeNull();
  });
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

  it('uses a distinct visual treatment for trope swaps', () => {
    render(
      <ClaimModal
        pendingClaim={pendingClaim({ kind: 'replace', genre: 'horror', subgenre: 'slasher' })}
        myId="p2"
        players={players}
        onAgree={vi.fn()}
        onDisagree={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('TROPE SWAP')).toBeInTheDocument();
    expect(screen.getByText('TROPE SWAP').closest('.modal-content')).toHaveClass('swap-claim-modal');
    expect(screen.getByRole('button', { name: '👍 Agree, swap it out' })).toHaveClass('swap-agree');
    expect(screen.getByRole('button', { name: '👎 Keep it as is' })).toHaveClass('swap-disagree');
  });

  it('offers optional anonymous reasons after a player disagrees', () => {
    const onDisagree = vi.fn();
    render(
      <ClaimModal
        pendingClaim={pendingClaim()}
        myId="p2"
        players={players}
        onAgree={vi.fn()}
        onDisagree={onDisagree}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '👎 Disagree' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not clear enough' }));
    expect(onDisagree).toHaveBeenCalledWith('Not clear enough');
  });

  it('offers swap-specific reasons when declining a trope swap', () => {
    const onDisagree = vi.fn();
    render(
      <ClaimModal
        pendingClaim={pendingClaim({ kind: 'replace', genre: 'horror', subgenre: 'slasher' })}
        myId="p2"
        players={players}
        onAgree={vi.fn()}
        onDisagree={onDisagree}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '👎 Keep it as is' }));
    expect(screen.getByText(/Why keep this trope\?/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not on screen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'It could still happen' }));
    expect(onDisagree).toHaveBeenCalledWith('It could still happen');
  });
});
