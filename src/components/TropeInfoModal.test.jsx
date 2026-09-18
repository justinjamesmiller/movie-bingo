import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import TropeInfoModal from './TropeInfoModal.jsx';
import { loadTropeDescriptions } from '../data/tropeDescriptions.js';

describe('TropeInfoModal', () => {
  // Warm the lazy chunk once so the synchronous assertions below are stable.
  beforeAll(async () => {
    await loadTropeDescriptions();
  });

  it('explains a trope that has a description written for it', async () => {
    render(<TropeInfoModal text="Jump Scare" marked={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Jump Scare')).toBeInTheDocument();
    expect(await screen.findByText(/make the audience flinch/i)).toBeInTheDocument();
    expect(screen.getByText(/For example:/)).toBeInTheDocument();
  });

  it('falls back gracefully for a trope with no description', async () => {
    render(<TropeInfoModal text="Some custom player trope" marked={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByText(/No explanation written for this one yet/i)).toBeInTheDocument();
  });

  it('offers to submit an unmarked space to the group', () => {
    render(<TropeInfoModal text="Jump Scare" marked={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Claim this trope/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit to the group/i })).toBeInTheDocument();
  });

  it('uses direct submit wording for a solo game', () => {
    render(<TropeInfoModal text="Jump Scare" marked={false} playerCount={1} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: '✅ Submit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit to the group/i })).toBeNull();
  });

  it('switches to undo wording for a space that is already marked', () => {
    render(<TropeInfoModal text="Jump Scare" marked onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Undo this space/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ask to undo it/i })).toBeInTheDocument();
  });

  it('calls onConfirm and onCancel from the right buttons', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<TropeInfoModal text="Jump Scare" marked={false} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Submit to the group/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers the swap action as a button rather than a hidden long-press', () => {
    const onProposeSwap = vi.fn();
    render(
      <TropeInfoModal
        text="Jump Scare"
        marked={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onProposeSwap={onProposeSwap}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Propose swapping this trope out/i }));
    expect(onProposeSwap).toHaveBeenCalledTimes(1);
  });

  it('uses compact advanced actions in place of the direct swap action when provided', () => {
    const onAdvancedActions = vi.fn();
    render(
      <TropeInfoModal
        text="Jump Scare"
        marked={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onProposeSwap={vi.fn()}
        onAdvancedActions={onAdvancedActions}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '⋯ Advanced actions' }));
    expect(onAdvancedActions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Propose swapping this trope out/i })).toBeNull();
  });

  it('hides the swap action when no handler is given', () => {
    render(<TropeInfoModal text="Jump Scare" marked={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Propose swapping/i })).toBeNull();
  });

  it('hides call and swap actions for an accepted trope', () => {
    render(
      <TropeInfoModal
        text="Jump Scare"
        marked
        actionsAvailable={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onProposeSwap={vi.fn()}
        onAdvancedActions={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '⋯ Advanced actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Propose swapping/i })).toBeNull();
  });
});
