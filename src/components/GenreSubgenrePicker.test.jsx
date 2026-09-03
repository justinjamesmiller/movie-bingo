import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenreSubgenrePicker from './GenreSubgenrePicker.jsx';

describe('GenreSubgenrePicker', () => {
  it('keeps at least one genre selected', () => {
    const onChange = vi.fn();
    render(<GenreSubgenrePicker genres={['horror']} subgenreSelections={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Horror' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds genres and toggles sub-genres', () => {
    const onChange = vi.fn();
    render(<GenreSubgenrePicker genres={['horror']} subgenreSelections={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Comedy' }));
    expect(onChange).toHaveBeenCalledWith(['horror', 'comedy'], []);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Slasher' }));
    expect(onChange).toHaveBeenLastCalledWith(['horror'], [{ genre: 'horror', subgenre: 'slasher' }]);
  });
});
