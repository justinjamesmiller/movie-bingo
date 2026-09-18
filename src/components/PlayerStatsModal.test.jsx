import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerStatsModal from './PlayerStatsModal.jsx';

describe('PlayerStatsModal', () => {
  it('shows current and marathon metrics without a score', () => {
    render(
      <PlayerStatsModal
        player={{ id: 'a', name: 'Alice', avatar: '🎬', marked: [0, 1], wagered: [0, 2] }}
        marathon={{
          enabled: true,
          watches: [{ players: [{ id: 'a', name: 'Alice', avatar: '🎬', tropes: 4, bingos: 1, wagerHits: 2 }] }],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /Alice's Stats/ })).toBeInTheDocument();
    expect(screen.getByText('Marathon tropes')).toBeInTheDocument();
    expect(screen.queryByText(/points/i)).toBeNull();
  });
});
