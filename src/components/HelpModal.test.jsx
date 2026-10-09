import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HelpModal from './HelpModal.jsx';

describe('HelpModal', () => {
  it('shows current gameplay guidance and closes', () => {
    const onClose = vi.fn();
    render(<HelpModal onClose={onClose} />);

    expect(screen.getByRole('heading', { name: '❓ How to Play' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '⚙️ Advanced Options', hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/Add Host/i)).toBeInTheDocument();
    expect(screen.getByText(/During play, open/)).toBeInTheDocument();
    expect(screen.getByText(/recovery password of at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/wait up to about a minute and try again/i)).toBeInTheDocument();
    expect(screen.getByText(/Join Game.*always creates a new seat/i)).toBeInTheDocument();
    expect(screen.getByText(/home-page option appears only while the server confirms/i)).toBeInTheDocument();
    expect(screen.getByText(/enter Manual title and choose Use manual title/i)).toBeInTheDocument();
    expect(screen.getByText(/The reveal button disappears after selection/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accessibility', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '👎 Vote Reasons', hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/10 seconds, 30 seconds, or 5 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('groups all guidance into seven initially collapsed sections', () => {
    const { container } = render(<HelpModal onClose={vi.fn()} />);
    const sections = container.querySelectorAll('details.help-section');

    expect(sections).toHaveLength(7);
    for (const section of sections) {
      expect(section).not.toHaveAttribute('open');
      expect(section.querySelector('summary')).toBeInTheDocument();
      expect(section.querySelector('h4')).toBeInTheDocument();
    }
    expect(container.querySelectorAll('.help-modal-content > h4')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Close' }).closest('details')).toBeNull();
  });

  it('expands and collapses a section without closing the modal', () => {
    const onClose = vi.fn();
    render(<HelpModal onClose={onClose} />);
    const summary = screen.getByText('Getting Started');
    const section = summary.closest('details');

    fireEvent.click(summary);
    expect(section).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: '🎯 Objective' })).toBeVisible();

    fireEvent.click(summary);
    expect(section).not.toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
  });
});
