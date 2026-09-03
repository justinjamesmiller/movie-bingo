import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BingoBanner from './BingoBanner.jsx';

describe('BingoBanner', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<BingoBanner message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the celebration message with confetti', () => {
    render(<BingoBanner message="🎉 BINGO for Alice!" />);
    expect(screen.getByText('🎉 BINGO for Alice!')).toBeInTheDocument();
    expect(document.querySelectorAll('.bingo-confetti')).toHaveLength(14);
  });
});
