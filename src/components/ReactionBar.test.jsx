import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReactionBar from './ReactionBar.jsx';

describe('ReactionBar', () => {
  it('sends the clicked emoji reaction', () => {
    const onReact = vi.fn();
    render(<ReactionBar onReact={onReact} />);

    fireEvent.click(screen.getByRole('button', { name: '🔥' }));
    expect(onReact).toHaveBeenCalledWith('🔥');
  });
});
