import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AllTropesModal from './AllTropesModal.jsx';

describe('AllTropesModal', () => {
  it('sorts tropes and reports whether a clicked trope is accepted', () => {
    const onTropeClick = vi.fn();
    render(
      <AllTropesModal
        tropePool={['Zombie arrives', 'A door creaks', 'Blood splatter']}
        acceptedTropes={['Blood splatter']}
        onTropeClick={onTropeClick}
        onClose={vi.fn()}
      />,
    );

    const buttons = within(screen.getByRole('list')).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['A door creaks', 'Blood splatter', 'Zombie arrives']);
    fireEvent.click(screen.getByRole('button', { name: 'Blood splatter' }));
    expect(onTropeClick).toHaveBeenCalledWith('Blood splatter', true);
  });
});
