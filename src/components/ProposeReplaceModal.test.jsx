import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProposeReplaceModal from './ProposeReplaceModal.jsx';

describe('ProposeReplaceModal', () => {
  it('submits the selected replacement genre and sub-genre', () => {
    const onConfirm = vi.fn();
    render(
      <ProposeReplaceModal
        text="Jump Scare"
        defaultGenre="horror"
        defaultSubgenre="general"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("New trope's genre"), { target: { value: 'comedy' } });
    fireEvent.change(screen.getByLabelText("New trope's sub-genre"), { target: { value: 'rom-com' } });
    fireEvent.click(screen.getByRole('button', { name: '👍 Propose it' }));

    expect(onConfirm).toHaveBeenCalledWith('comedy', 'rom-com');
  });

  it('cancels from the backdrop', () => {
    const onCancel = vi.fn();
    render(
      <ProposeReplaceModal
        text="Jump Scare"
        defaultGenre="horror"
        defaultSubgenre="general"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.mouseDown(document.querySelector('.modal'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses direct wording for a solo game', () => {
    render(
      <ProposeReplaceModal
        text="Jump Scare"
        defaultGenre="horror"
        defaultSubgenre="general"
        playerCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/immediately swaps it out/i)).toBeInTheDocument();
    expect(screen.queryByText(/asks the group/i)).toBeNull();
  });
});
