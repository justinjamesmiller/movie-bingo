import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomTropeModal from './CustomTropeModal.jsx';

describe('CustomTropeModal', () => {
  it('ends editing before submitting a custom trope', () => {
    const onSubmit = vi.fn(() => document.activeElement);
    render(<CustomTropeModal onSubmit={onSubmit} onCancel={vi.fn()} />);
    const input = screen.getByLabelText('Trope description');
    fireEvent.change(input, { target: { value: 'Someone quotes the tagline' } });
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onSubmit).toHaveBeenCalledWith('Someone quotes the tagline');
    expect(onSubmit.mock.results[0].value).not.toBe(input);
  });

  it('ends editing before backdrop dismissal', () => {
    const onCancel = vi.fn(() => document.activeElement);
    render(<CustomTropeModal onSubmit={vi.fn()} onCancel={onCancel} />);
    const input = screen.getByLabelText('Trope description');
    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCancel.mock.results[0].value).not.toBe(input);
  });

  it('keeps editing for field taps and disabled submit buttons', () => {
    render(<CustomTropeModal onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByLabelText('Trope description');
    fireEvent.click(input);
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(input).toHaveFocus();
  });

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
