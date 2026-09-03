import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AllWagersModal from './AllWagersModal.jsx';

describe('AllWagersModal', () => {
  it('shows an empty state when no one has wagered', () => {
    render(
      <AllWagersModal
        players={[{ id: 'p1', name: 'Alice', wagered: [], board: [] }]}
        acceptedTropes={[]}
        onTropeClick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('No one has wagered anything yet.')).toBeInTheDocument();
  });

  it('lists every wager and opens trope details when one is clicked', () => {
    const onTropeClick = vi.fn();
    const onClose = vi.fn();
    render(
      <AllWagersModal
        players={[
          {
            id: 'p1',
            name: 'Alice',
            avatar: '🎬',
            connected: true,
            wagered: [0, 2],
            board: ['Jump Scare', 'Door creaks', 'Blood splatter'],
          },
        ]}
        acceptedTropes={['Blood splatter']}
        onTropeClick={onTropeClick}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Blood splatter' }));
    expect(onTropeClick).toHaveBeenCalledWith('Blood splatter', true);

    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
