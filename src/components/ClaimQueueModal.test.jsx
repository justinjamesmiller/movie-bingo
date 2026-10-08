import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClaimQueueModal from './ClaimQueueModal.jsx';

describe('ClaimQueueModal', () => {
  it('shows context and lets only a participating proposer withdraw', () => {
    const onWithdraw = vi.fn();
    render(
      <ClaimQueueModal
        queue={[
          {
            id: 'own',
            text: 'Own observation',
            kind: 'mark',
            proposedBy: ['alice'],
            sceneContexts: [{ playerId: 'alice', timestamp: '12:34', note: 'Kitchen' }],
          },
          { id: 'other', text: 'Other observation', kind: 'mark', proposedBy: ['bob'], sceneContexts: [] },
        ]}
        players={[
          { id: 'alice', name: 'Alice', avatar: '🎬' },
          { id: 'bob', name: 'Bob', avatar: '🍿' },
        ]}
        myId="alice"
        onWithdraw={onWithdraw}
        onBrowse={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/12:34.*Kitchen/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Withdraw my proposal' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my proposal' }));
    expect(onWithdraw).toHaveBeenCalledWith('own');
  });
});
