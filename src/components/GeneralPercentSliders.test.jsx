import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GeneralPercentSliders from './GeneralPercentSliders.jsx';

describe('GeneralPercentSliders', () => {
  it('only renders sliders for genres with selected sub-genres', () => {
    render(
      <GeneralPercentSliders
        genres={['horror', 'comedy']}
        subgenreSelections={[{ genre: 'horror', subgenre: 'slasher' }]}
        generalPercents={{ horror: 30, comedy: 70 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Horror general tropes: 30%')).toBeInTheDocument();
    expect(screen.queryByLabelText('Comedy general tropes: 70%')).toBeNull();
  });

  it('reports slider changes with the genre id and numeric value', () => {
    const onChange = vi.fn();
    render(
      <GeneralPercentSliders
        genres={['horror']}
        subgenreSelections={[{ genre: 'horror', subgenre: 'slasher' }]}
        generalPercents={{ horror: 30 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Horror general tropes: 30%'), { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith('horror', 60);
  });
});
