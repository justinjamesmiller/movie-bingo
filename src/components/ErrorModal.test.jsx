import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorModal from './ErrorModal.jsx';

describe('ErrorModal', () => {
  it('shows an error and dismisses it', () => {
    const onClose = vi.fn();
    render(<ErrorModal message="Could not join that game." onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Something Went Wrong' })).toBeInTheDocument();
    expect(screen.getByText('Could not join that game.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render without a message', () => {
    const { container } = render(<ErrorModal message="" onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
