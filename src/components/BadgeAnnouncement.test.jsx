import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BadgeAnnouncement from './BadgeAnnouncement.jsx';

const achievements = [
  { playerId: 'p1', name: 'Ashley', avatar: '🎬', badgeName: 'Team Player', awardKind: 'badge' },
  { playerId: 'p2', name: 'Bob', avatar: '🍿', badgeName: 'Team Player', awardKind: 'badge' },
];

describe('BadgeAnnouncement', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['button', 'outside'])('dismisses the compact notification from the %s', (target) => {
    const onDismiss = vi.fn();
    render(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    if (target === 'button') fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
    else fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('opens all awards from the compact preview and waits while the player reads', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <BadgeAnnouncement
        achievements={[
          ...achievements,
          { playerId: 'p1', name: 'Ashley', badgeName: 'Pattern Hunter', awardKind: 'badge' },
          { playerId: 'p2', name: 'Bob', badgeName: 'Most Almost-Bingos', awardKind: 'superlative' },
        ]}
        suspended={false}
        onDismiss={onDismiss}
      />,
    );

    const preview = screen.getByRole('status', { name: 'New awards' });
    expect(preview.querySelector('.badge-announcement-preview')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show all new awards' }));
      await Promise.resolve();
    });
    const dialog = screen.getByRole('dialog', { name: 'New badges and superlatives' });
    expect(dialog).toHaveTextContent('Ashley, 🍿 Bob earned the badge Team Player');
    expect(dialog).toHaveTextContent('Ashley earned the badge Pattern Hunter');
    expect(dialog).toHaveTextContent('Bob now holds the superlative Most Almost-Bingos');
    expect(screen.queryByRole('status', { name: 'New awards' })).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await Promise.resolve();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focuses the details dialog and dismisses it with Escape', async () => {
    const onDismiss = vi.fn();
    render(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show all new awards' }));
      await Promise.resolve();
    });
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    await act(async () => {
      fireEvent.keyDown(close, { key: 'Escape' });
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('groups shared badges and expires after five visible seconds', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    expect(screen.getByRole('status', { name: 'New awards' })).toHaveTextContent(
      'Ashley, 🍿 Bob earned the badge Team Player',
    );
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('waits behind a modal and starts its timer when the modal closes', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const view = render(
      <>
        <div className="modal">Existing modal</div>
        <BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />
      </>,
    );
    expect(screen.queryByRole('status', { name: 'New awards' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(onDismiss).not.toHaveBeenCalled();
    view.rerender(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    expect(screen.getByRole('status', { name: 'New awards' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('announces a changed exclusive superlative separately from earned badges', () => {
    render(
      <BadgeAnnouncement
        achievements={[
          { playerId: 'p1', name: 'Ashley', badgeName: 'Pattern Hunter', awardKind: 'badge' },
          { playerId: 'p2', name: 'Bob', badgeName: 'Most Almost-Bingos', awardKind: 'superlative' },
        ]}
        suspended={false}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'New awards' })).toHaveTextContent(
      'Ashley earned the badge Pattern Hunter',
    );
    expect(screen.getByRole('status', { name: 'New awards' })).toHaveTextContent(
      'Bob now holds the superlative Most Almost-Bingos',
    );
  });
});
