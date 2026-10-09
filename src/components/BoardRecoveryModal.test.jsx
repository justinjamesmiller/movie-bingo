import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoardRecoveryModal from './BoardRecoveryModal.jsx';

describe('BoardRecoveryModal', () => {
  afterEach(() => vi.useRealTimers());
  it.each([true, false])('shows a live shared deadline for the source player: %s', async (isSource) => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const onKeepPlaying = vi.fn();
    const onCancel = vi.fn();
    render(
      <BoardRecoveryModal
        request={{ id: 'recovery', expiresAt: 301000 }}
        source={{ name: 'Old player' }}
        target={{ name: 'New session' }}
        isSource={isSource}
        onKeepPlaying={onKeepPlaying}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('5:00');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('4:59');
    fireEvent.click(screen.getByRole('button', { name: isSource ? "I'm still playing" : 'Cancel recovery' }));
    expect(isSource ? onKeepPlaying : onCancel).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(299000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Completing recovery...')).toBeInTheDocument();
  });
});
