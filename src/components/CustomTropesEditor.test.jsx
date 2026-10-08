import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomTropesEditor from './CustomTropesEditor.jsx';

describe('CustomTropesEditor', () => {
  it('lets hosts explicitly add and remove optional presets using the existing custom pool', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CustomTropesEditor customTropes={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Optional trope presets'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unconvincing visual effects' }));
    expect(onChange).toHaveBeenCalledWith(['Unconvincing visual effects']);
    rerender(<CustomTropesEditor customTropes={['Unconvincing visual effects']} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Unconvincing visual effects' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unconvincing visual effects' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('caps optional choices at the existing custom-trope limit while allowing removal', () => {
    const customTropes = [
      'Unconvincing visual effects',
      ...Array.from({ length: 19 }, (_, index) => `Custom ${index}`),
    ];
    render(<CustomTropesEditor customTropes={customTropes} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Optional trope presets'));
    expect(screen.getByRole('checkbox', { name: 'A continuity error' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Unconvincing visual effects' })).toBeEnabled();
  });

  it.each(['Product placement', 'A slur is used', 'Alcohol, tobacco, or drugs are used'])(
    'offers "%s" as an explicit optional preset',
    (text) => {
      const onChange = vi.fn();
      render(<CustomTropesEditor customTropes={[]} onChange={onChange} />);
      fireEvent.click(screen.getByText('Optional trope presets'));
      fireEvent.click(screen.getByRole('checkbox', { name: text }));
      expect(onChange).toHaveBeenCalledWith([text]);
    },
  );

  it('adds a trimmed custom trope and clears the draft', () => {
    const onChange = vi.fn();
    render(<CustomTropesEditor customTropes={[]} onChange={onChange} />);

    const input = screen.getByLabelText(/Add your own custom trope/);
    fireEvent.change(input, { target: { value: '  Someone quotes the tagline  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith(['Someone quotes the tagline']);
    expect(input).toHaveValue('');
  });

  it('removes an existing custom trope', () => {
    const onChange = vi.fn();
    render(<CustomTropesEditor customTropes={['One', 'Two']} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove One' }));
    expect(onChange).toHaveBeenCalledWith(['Two']);
  });
});
