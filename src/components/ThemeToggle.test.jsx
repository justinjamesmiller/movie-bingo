import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle.jsx';

describe('ThemeToggle', () => {
  it('shows a manual light-mode checkbox and calls onToggle', () => {
    const onToggle = vi.fn();
    const view = render(<ThemeToggle theme="dark" onToggle={onToggle} />);

    expect(screen.getByRole('checkbox', { name: 'Light mode' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Light mode' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    view.rerender(<ThemeToggle theme="light" onToggle={onToggle} />);
    expect(screen.getByRole('checkbox', { name: 'Light mode' })).toBeChecked();
  });
});
