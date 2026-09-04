import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResetModal from './ResetModal.jsx';

describe('ResetModal', () => {
  it('submits the selected reset settings', () => {
    const onConfirm = vi.fn();
    render(
      <ResetModal
        currentGenres={['horror']}
        currentSubgenreSelections={[]}
        currentFreeSpace={false}
        currentGeneralPercents={{ horror: 50 }}
        currentTotalTropes={25}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Free center space' }));
    fireEvent.change(screen.getByLabelText('Total unique tropes in play'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Game' }));
    expect(onConfirm).toHaveBeenCalledWith(['horror'], [], true, { horror: 50 }, 40, []);
  });

  it('cancels from the button or backdrop', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ResetModal
        currentGenres={['horror']}
        currentSubgenreSelections={[]}
        currentFreeSpace={false}
        currentGeneralPercents={{ horror: 50 }}
        currentTotalTropes={25}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.mouseDown(container.querySelector('.modal'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
