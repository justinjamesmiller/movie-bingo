import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FinaleBanner from './FinaleBanner.jsx';

describe('FinaleBanner', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<FinaleBanner visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the distinct curtain-call celebration', () => {
    render(<FinaleBanner visible />);
    expect(screen.getByText('CURTAIN CALL')).toBeInTheDocument();
    expect(screen.getByText("That's a wrap!")).toBeInTheDocument();
    expect(document.querySelectorAll('.finale-mark')).toHaveLength(12);
    expect(document.querySelector('.finale-rays')).toBeInTheDocument();
  });

  it('dismisses only when the user clicks outside the finale copy', () => {
    const onDismiss = vi.fn();
    render(<FinaleBanner visible onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText("That's a wrap!"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.finale-banner'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
