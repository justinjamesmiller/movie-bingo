import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BadgeAnnouncement from './BadgeAnnouncement.jsx';

const achievements = [
  { playerId: 'p1', name: 'Ashley', avatar: '🎬', badgeName: 'Team Player', awardKind: 'badge' },
  { playerId: 'p2', name: 'Bob', avatar: '🍿', badgeName: 'Team Player', awardKind: 'badge' },
];

describe('BadgeAnnouncement', () => {
  afterEach(() => vi.useRealTimers());

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
