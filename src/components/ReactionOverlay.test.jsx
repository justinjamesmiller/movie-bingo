import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReactionOverlay from './ReactionOverlay.jsx';

describe('ReactionOverlay', () => {
  it('renders nothing with no reactions', () => {
    const { container } = render(<ReactionOverlay reactions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders reaction bubbles with names and offsets', () => {
    render(<ReactionOverlay reactions={[{ id: '1', emoji: '👏', name: 'Alice', offset: 42 }]} />);
    expect(screen.getByText('👏')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(document.querySelector('.reaction-bubble')).toHaveStyle({ left: '42%' });
  });
});
