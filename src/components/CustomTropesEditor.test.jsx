import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomTropesEditor from './CustomTropesEditor.jsx';

describe('CustomTropesEditor', () => {
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
