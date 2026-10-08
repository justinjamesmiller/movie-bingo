import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AllTropesModal from './AllTropesModal.jsx';

describe('AllTropesModal', () => {
  it('combines a search with the wagered filter without changing trope actions', () => {
    const onTropeClick = vi.fn();
    render(
      <AllTropesModal
        tropePool={['A door creaks', 'Blood splatter', 'Zombie arrives']}
        acceptedTropes={['A door creaks']}
        wageredTexts={['A door creaks', 'Blood splatter']}
        onTropeClick={onTropeClick}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search tropes'), { target: { value: '  DOOR  ' } });
    fireEvent.change(screen.getByLabelText('Filter tropes'), { target: { value: 'wagered' } });
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'A door creaks' }));
    expect(onTropeClick).toHaveBeenCalledWith('A door creaks', true);
    fireEvent.change(screen.getByLabelText('Search tropes'), { target: { value: 'nothing matches' } });
    expect(screen.getByRole('status')).toHaveTextContent('0 / 3 tropes');
  });

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
