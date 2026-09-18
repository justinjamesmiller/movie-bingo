import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TropeAdvancedActionsModal from './TropeAdvancedActionsModal.jsx';

describe('TropeAdvancedActionsModal', () => {
  it('offers a call and swap action without crowding the trope information modal', () => {
    const onToggleCall = vi.fn();
    const onSwap = vi.fn();
    render(
      <TropeAdvancedActionsModal
        text="Jump Scare"
        called={false}
        onToggleCall={onToggleCall}
        onSwap={onSwap}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '📣 Call it next' }));
    fireEvent.click(screen.getByRole('button', { name: '🔁 Propose swapping it out' }));
    expect(onToggleCall).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledTimes(1);
  });

  it('changes the call action to allow withdrawing it', () => {
    render(
      <TropeAdvancedActionsModal text="Jump Scare" called onToggleCall={vi.fn()} onSwap={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '↩️ Uncall it' })).toBeInTheDocument();
  });
});
