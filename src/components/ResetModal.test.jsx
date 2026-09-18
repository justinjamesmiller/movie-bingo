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
        currentGenrePercents={{ horror: 100 }}
        currentSubgenrePercents={{}}
        currentTotalTropes={25}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Free center space' }));
    fireEvent.change(screen.getByLabelText('Total unique tropes in play'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Game' }));
    expect(onConfirm).toHaveBeenCalledWith(['horror'], [], true, { horror: 50 }, 40, [], { horror: 100 }, {}, null);
  });

  it('lets reset sliders change the submitted genre ratios', () => {
    const onConfirm = vi.fn();
    render(
      <ResetModal
        currentGenres={['horror', 'comedy']}
        currentSubgenreSelections={[]}
        currentFreeSpace={false}
        currentGeneralPercents={{ horror: 50, comedy: 50 }}
        currentGenrePercents={{ horror: 40, comedy: 60 }}
        currentSubgenrePercents={{}}
        currentTotalTropes={25}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Horror: 40%'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Game' }));

    expect(onConfirm).toHaveBeenCalledWith(
      ['horror', 'comedy'],
      [],
      false,
      { horror: 50, comedy: 50 },
      25,
      [],
      { horror: 70, comedy: 30 },
      {},
      null,
    );
  });

  it('rebalances genre settings after changing the reset genre selection', () => {
    const onConfirm = vi.fn();
    render(
      <ResetModal
        currentGenres={['horror']}
        currentSubgenreSelections={[]}
        currentFreeSpace={false}
        currentGeneralPercents={{ horror: 50 }}
        currentGenrePercents={{ horror: 100 }}
        currentSubgenrePercents={{ horror: { general: 100 } }}
        currentTotalTropes={25}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Comedy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Game' }));

    expect(onConfirm).toHaveBeenCalledWith(
      ['horror', 'comedy'],
      [],
      false,
      { horror: 50, comedy: 50 },
      25,
      [],
      { horror: 50, comedy: 50 },
      { horror: { general: 100 }, comedy: { general: 100 } },
      null,
    );
  });

  it('cancels from the button or backdrop', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ResetModal
        currentGenres={['horror']}
        currentSubgenreSelections={[]}
        currentFreeSpace={false}
        currentGeneralPercents={{ horror: 50 }}
        currentGenrePercents={{ horror: 100 }}
        currentSubgenrePercents={{}}
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
