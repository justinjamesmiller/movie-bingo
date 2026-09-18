import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReplacementPickerModal from './ReplacementPickerModal.jsx';

const replacement = {
  oldText: 'Old trope',
  genre: 'horror',
  subgenre: 'slasher',
  candidates: ['New trope', 'Another trope'],
  index: 0,
};

describe('ReplacementPickerModal', () => {
  it('groups replacement controls in a spaced action stack', () => {
    render(
      <ReplacementPickerModal
        replacement={replacement}
        isProposer
        onCycle={vi.fn()}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '🔀 Pass' }).closest('.replacement-actions')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose from full trope list' }));
    expect(screen.getByRole('button', { name: 'New trope' }).closest('.replacement-actions')).not.toBeNull();
  });
});
