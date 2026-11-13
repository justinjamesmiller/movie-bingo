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
    expect(screen.getByText(/free center space, optional custom genre\/sub-genre ratios/i)).toBeInTheDocument();
    expect(screen.getByText(/recovery password of 2 to 128 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/wait up to about a minute and try again/i)).toBeInTheDocument();
    expect(screen.getByText(/only the matching authenticated identity can reclaim a seat/i)).toBeInTheDocument();
    expect(
      screen.getByText(/join as a new player, which still needs host approval after play starts/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/home-page option appears only while the server confirms/i)).toBeInTheDocument();
    expect(screen.getByText(/enter Manual title and choose Use manual title/i)).toBeInTheDocument();
    expect(screen.getByText(/The reveal button disappears after selection/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accessibility', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '👎 Vote Reasons', hidden: true })).toBeInTheDocument();
    expect(
      screen.getByText(/Use the speaker button.*mute or unmute sound.*Haptic feedback is currently disabled/i),
    ).toBeInTheDocument();
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

  it('explains wager help, eligibility, limits, and solo changes', () => {
    render(<HelpModal onClose={vi.fn()} />);

    expect(screen.getByText(/Expand About wagering beside the wager action/)).toHaveTextContent(
      /free center cannot be wagered/,
    );
    expect(screen.getByText(/keeping at most 5 wagers in the final set/)).toHaveTextContent(
      /New picks must be unmarked, non-free spaces/,
    );
    expect(screen.getByText(/keeping at most 5 wagers in the final set/)).toHaveTextContent(
      /when playing alone, they apply immediately/,
    );
    expect(screen.getByText(/group to re-deal your 5x5 board/)).toHaveTextContent(
      /keeping the free center if enabled.*Some tropes may appear again/,
    );
  });

  it('gives actionable host recovery and fixed-expiry instructions', () => {
    render(<HelpModal onClose={vi.fn()} />);

    expect(screen.getByText(/open Join a Game, select Are you a Host\?/)).toHaveTextContent(
      /enter the recovery password with the game code/,
    );
    expect(
      screen.getByText(/1 hour, 12 hours \(the default\), 24 hours, 1 week, 30 days, or 90 days/),
    ).toHaveTextContent(/Restart countdown applies the selected duration from now/);
    expect(screen.getByText(/fixed expiry, not an inactivity timer/)).toHaveTextContent(/playing does not pause it/);
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
