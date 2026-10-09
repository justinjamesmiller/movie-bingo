import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import TropeInfoModal from './TropeInfoModal.jsx';
import { loadTropeDescriptions } from '../data/tropeDescriptions.js';

describe('TropeInfoModal', () => {
  it('submits optional scene context with a free-form movie timestamp', () => {
    const onConfirm = vi.fn();
    render(<TropeInfoModal text="Jump Scare" allowSceneContext onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Optional scene context'));
    fireEvent.change(screen.getByLabelText('Movie timestamp'), { target: { value: 'Around the halfway point' } });
    expect(screen.getByRole('button', { name: /Submit to the group/ })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Scene note'), { target: { value: '  Kitchen scene  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit to the group/ }));
    expect(onConfirm).toHaveBeenCalledWith({ note: 'Kitchen scene', timestamp: 'Around the halfway point' });
  });

  it('shows accepted proposal context read-only when challenging the trope', () => {
    const onConfirm = vi.fn();
    render(
      <TropeInfoModal
        text="Jump Scare"
        title="Challenge this trope?"
        confirmLabel="👍 Challenge it"
        allowSceneContext
        sceneContextReadOnly
        sceneContexts={[
          { playerName: 'Alice', timestamp: 'Around the halfway point', note: 'Kitchen scene' },
          { playerName: 'Bob', timestamp: 'Near the ending', note: '' },
        ]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Original proposal context')).toBeInTheDocument();
    expect(screen.getByText('Around the halfway point')).toBeInTheDocument();
    expect(screen.getByText('Kitchen scene')).toBeInTheDocument();
    expect(screen.getByText('Near the ending')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movie timestamp')).toBeNull();
    expect(screen.queryByLabelText('Scene note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '👍 Challenge it' }));
    expect(onConfirm).toHaveBeenCalledWith();
  });

  it('explains when an older accepted proposal has no saved context', () => {
    render(<TropeInfoModal text="Jump Scare" sceneContextReadOnly sceneContexts={[]} onCancel={vi.fn()} />);

    expect(screen.getByText('No scene context was recorded with the original proposal.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movie timestamp')).toBeNull();
  });

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
    expect(screen.queryByText(/The group votes on whether this really happened/)).toBeNull();
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

  it('lists every caller with their name and avatar, including callers omitted from the board preview', () => {
    render(
      <TropeInfoModal
        text="Jump Scare"
        marked={false}
        onCancel={vi.fn()}
        callers={[
          { id: 'alice', name: 'Alice', avatar: '🎬', connected: true },
          { id: 'bob', name: 'Bob', avatar: '🍿', connected: true },
          { id: 'carol', name: 'Carol', avatar: '⭐', connected: false },
        ]}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Players calling this trope' })).toBeNull();
    const avatars = screen.getAllByRole('button', { name: 'Show players calling this trope' });
    expect(avatars.map((button) => button.textContent)).toEqual(['🎬', '🍿', '⭐']);
    expect(avatars[0]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(avatars[1]);
    expect(screen.getByRole('heading', { name: 'Called to happen next' })).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toHaveTextContent('🎬 Alice');
    expect(screen.getByText(/Bob/)).toHaveTextContent('🍿 Bob');
    expect(screen.getByText(/Carol/)).toHaveTextContent('⭐ Carol (disconnected)');
    fireEvent.click(avatars[0]);
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
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

  it('shows successful caller avatars and names with completed-call wording', () => {
    render(
      <TropeInfoModal
        text="Jump Scare"
        marked
        onCancel={vi.fn()}
        successfulCallers={[{ id: 'bob', name: 'Bob', avatar: '🍿' }]}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Called it correctly' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show successful callers' }));
    expect(screen.getByRole('heading', { name: 'Called it correctly' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Players who called this trope correctly' })).toHaveTextContent('🍿 Bob');
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
  });

  it('resets expanded callers when a new trope modal is opened and keeps avatars below the actions', () => {
    const props = {
      marked: false,
      onCancel: vi.fn(),
      onAdvancedActions: vi.fn(),
      callers: [{ id: 'alice', name: 'Alice', avatar: '🎬' }],
    };
    const { container, rerender } = render(<TropeInfoModal key="Jump Scare" text="Jump Scare" {...props} />);
    const actions = screen.getByRole('button', { name: '⋯ Advanced actions' });
    const avatar = screen.getByRole('button', { name: 'Show players calling this trope' });
    expect(actions.compareDocumentPosition(avatar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.modal-content').lastElementChild).toHaveClass('trope-callers');
    fireEvent.click(avatar);
    expect(screen.getByRole('heading', { name: 'Called to happen next' })).toBeInTheDocument();
    rerender(<TropeInfoModal key="Blood splatter" text="Blood splatter" {...props} />);
    expect(screen.queryByRole('heading', { name: 'Called to happen next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show players calling this trope' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
