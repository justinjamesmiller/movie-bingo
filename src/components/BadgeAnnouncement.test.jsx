import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BadgeAnnouncement from './BadgeAnnouncement.jsx';

const achievements = [
  { playerId: 'p1', name: 'Ashley', avatar: '🎬', badgeName: 'Team Player' },
  { playerId: 'p2', name: 'Bob', avatar: '🍿', badgeName: 'Team Player' },
];

describe('BadgeAnnouncement', () => {
  afterEach(() => vi.useRealTimers());

  it('groups shared badges and expires after five visible seconds', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    expect(screen.getByRole('status', { name: 'New badges' })).toHaveTextContent('Ashley, 🍿 Bob earned Team Player');
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
    expect(screen.queryByRole('status', { name: 'New badges' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(onDismiss).not.toHaveBeenCalled();
    view.rerender(<BadgeAnnouncement achievements={achievements} suspended={false} onDismiss={onDismiss} />);
    expect(screen.getByRole('status', { name: 'New badges' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
