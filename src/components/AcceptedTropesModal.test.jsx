import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AcceptedTropesModal from './AcceptedTropesModal.jsx';

describe('AcceptedTropesModal', () => {
  it('shows an empty state', () => {
    render(<AcceptedTropesModal acceptedTropes={[]} onTropeClick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('No tropes have been accepted yet.')).toBeInTheDocument();
  });

  it('opens trope info and closes from the backdrop', () => {
    const onTropeClick = vi.fn();
    const onClose = vi.fn();
    render(<AcceptedTropesModal acceptedTropes={['Jump Scare']} onTropeClick={onTropeClick} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jump Scare' }));
    expect(onTropeClick).toHaveBeenCalledWith('Jump Scare');
    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
