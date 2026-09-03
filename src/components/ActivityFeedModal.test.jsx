import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActivityFeedModal from './ActivityFeedModal.jsx';

describe('ActivityFeedModal', () => {
  it('shows an empty state', () => {
    render(<ActivityFeedModal activityLog={[]} onClose={vi.fn()} />);
    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument();
  });

  it('lists newest activity first and closes from the backdrop', () => {
    const onClose = vi.fn();
    render(
      <ActivityFeedModal
        activityLog={[
          { id: '1', text: 'First event', ts: Date.UTC(2026, 0, 1, 1, 0) },
          { id: '2', text: 'Second event', ts: Date.UTC(2026, 0, 1, 2, 0) },
        ]}
        onClose={onClose}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Second event');
    expect(items[1]).toHaveTextContent('First event');
    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
