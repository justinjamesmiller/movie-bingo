import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle.jsx';

describe('ThemeToggle', () => {
  it('shows the opposite-theme icon and calls onToggle', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="dark" onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toHaveTextContent('☀️');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
