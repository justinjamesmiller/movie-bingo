import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChangeNameModal from './ChangeNameModal.jsx';

describe('ChangeNameModal', () => {
  it.each(['Save', 'Cancel'])('ends editing before the %s callback runs', (buttonName) => {
    const onAction = vi.fn(() => document.activeElement);
    render(<ChangeNameModal currentName="Alice" currentAvatar="🎬" onConfirm={onAction} onCancel={onAction} />);
    const input = screen.getByLabelText('New name');
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.results[0].value).not.toBe(input);
  });

  it('saves the trimmed name and selected avatar', () => {
    const onConfirm = vi.fn();
    render(<ChangeNameModal currentName="Alice" currentAvatar="🎬" onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('New name'), { target: { value: '  Bob  ' } });
    fireEvent.click(screen.getByRole('button', { name: '🍿' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onConfirm).toHaveBeenCalledWith('Bob', '🍿');
  });

  it('disables save for blank names and cancels from the backdrop', () => {
    const onCancel = vi.fn();
    render(<ChangeNameModal currentName="Alice" currentAvatar="🎬" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText('New name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
