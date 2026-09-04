import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GeneralPercentSliders from './GeneralPercentSliders.jsx';

describe('GeneralPercentSliders', () => {
  it('shows genre sliders only for multiple genres and subgenre sliders only when selected', () => {
    const onChange = vi.fn();
    render(
      <GeneralPercentSliders
        genres={['horror', 'comedy']}
        subgenreSelections={[{ genre: 'horror', subgenre: 'slasher' }]}
        genrePercents={{ horror: 40, comedy: 60 }}
        subgenrePercents={{ horror: { general: 50, slasher: 50 } }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Horror: 40%')).toBeInTheDocument();
    expect(screen.getByLabelText('Comedy: 60%')).toBeInTheDocument();
    expect(screen.getByLabelText('General: 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('Slasher: 50%')).toBeInTheDocument();
  });

  it('keeps a two-slider subgenre mix at 100%', () => {
    const onChange = vi.fn();
    render(
      <GeneralPercentSliders
        genres={['horror']}
        subgenreSelections={[{ genre: 'horror', subgenre: 'slasher' }]}
        genrePercents={{ horror: 100 }}
        subgenrePercents={{ horror: { general: 50, slasher: 50 } }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('General: 50%'), { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith({ horror: 100 }, { horror: { general: 60, slasher: 40 } });
  });
});
