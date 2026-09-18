import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatsDashboardModal from './StatsDashboardModal.jsx';

describe('StatsDashboardModal', () => {
  it('summarizes shared current-game metrics', () => {
    render(
      <StatsDashboardModal
        players={[
          { id: 'a', name: 'Alice', avatar: '🎬', marked: [0, 1], wagered: [0] },
          { id: 'b', name: 'Bob', avatar: '🍿', marked: [0], wagered: [1] },
        ]}
        acceptedTropes={['One', 'Two']}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Accepted tropes')).toBeInTheDocument();
    expect(screen.getByText('Total marked spaces')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });
});
