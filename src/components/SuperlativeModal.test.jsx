import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SuperlativeModal from './SuperlativeModal.jsx';

describe('SuperlativeModal', () => {
  it('shows other current awards and lets the player open their details', () => {
    const badge = { id: 'wager-architect', kind: 'badge', name: 'Wager Architect', description: 'Filled wagers.' };
    const superlative = {
      id: 'most-almost-bingos',
      kind: 'superlative',
      name: 'Most Almost-Bingos',
      description: 'Has the sole lead.',
    };
    const onSelectAward = vi.fn();
    const props = {
      awards: [badge, superlative],
      playerName: 'Ashley',
      progress: [],
      onSelectAward,
      onClose: vi.fn(),
    };
    const view = render(<SuperlativeModal {...props} award={superlative} />);

    expect(screen.getByRole('heading', { name: 'Most Almost-Bingos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Badge: Wager Architect' }));
    expect(onSelectAward).toHaveBeenCalledWith(badge);
    view.rerender(<SuperlativeModal {...props} award={badge} />);
    expect(screen.getByRole('heading', { name: 'Wager Architect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Superlative: Most Almost-Bingos' })).toBeInTheDocument();
  });
});
