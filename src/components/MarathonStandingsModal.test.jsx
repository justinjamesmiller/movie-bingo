import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarathonStandingsModal from './MarathonStandingsModal.jsx';

describe('MarathonStandingsModal', () => {
  it('aggregates player metrics across completed watches', () => {
    render(
      <MarathonStandingsModal
        marathon={{
          enabled: true,
          watches: [
            {
              number: 1,
              players: [
                { id: 'a', name: 'Alice', avatar: '🎬', tropes: 4, bingos: 1, wagerHits: 1 },
                { id: 'b', name: 'Bob', avatar: '🍿', tropes: 3, bingos: 0, wagerHits: 2 },
              ],
            },
            {
              number: 2,
              players: [
                { id: 'a', name: 'Alice', avatar: '🎬', tropes: 2, bingos: 0, wagerHits: 2 },
                { id: 'b', name: 'Bob', avatar: '🍿', tropes: 5, bingos: 1, wagerHits: 1 },
              ],
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText('2 watches')).toHaveLength(2);
    expect(screen.getByText(/8 tropes.*1 bingo.*3 wager hits.*0\/0 calls/)).toBeInTheDocument();
  });
});
