import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomTropeModal from './CustomTropeModal.jsx';

describe('CustomTropeModal', () => {
  it('submits trimmed custom trope text', () => {
    const onSubmit = vi.fn();
    render(<CustomTropeModal onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Trope description'), {
      target: { value: '  Someone quotes the tagline  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));

    expect(onSubmit).toHaveBeenCalledWith('Someone quotes the tagline');
  });

  it('disables submit for blank text and cancels from the backdrop', () => {
    const onCancel = vi.fn();
    render(<CustomTropeModal onSubmit={vi.fn()} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses direct submission wording in a solo game', () => {
    render(<CustomTropeModal playerCount={1} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/added to the trope pool right away/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
