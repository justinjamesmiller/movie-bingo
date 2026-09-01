import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BingoBoard from './BingoBoard.jsx';
import { CENTER_INDEX, FREE_SPACE_TEXT } from '../data/tropes.js';

function makeBoard(overrides = {}) {
  const board = Array.from({ length: 25 }, (_, i) => `Trope ${i}`);
  return {
    board,
    wagered: [],
    marked: [],
    freeSpace: false,
    pending: false,
    highlightedCells: new Set(),
    onCellClick: vi.fn(),
    onCellLongPress: vi.fn(),
    ...overrides,
  };
}

describe('BingoBoard', () => {
  it('renders 25 cells with their trope text', () => {
    render(<BingoBoard {...makeBoard()} />);
    expect(screen.getByText('Trope 0')).toBeInTheDocument();
    expect(screen.getByText('Trope 24')).toBeInTheDocument();
  });

  it('shows the free-space text at the center index when freeSpace is enabled', () => {
    const board = Array.from({ length: 25 }, (_, i) => (i === CENTER_INDEX ? FREE_SPACE_TEXT : `Trope ${i}`));
    render(<BingoBoard {...makeBoard({ board, freeSpace: true })} />);
    expect(screen.getByText(FREE_SPACE_TEXT)).toHaveClass('free-space');
  });

  it('calls onCellClick with the clicked index', () => {
    const props = makeBoard();
    render(<BingoBoard {...props} />);
    fireEvent.click(screen.getByText('Trope 3'));
    expect(props.onCellClick).toHaveBeenCalledWith(3);
  });

  it('applies the marked and wagered classes to the right cells', () => {
    render(<BingoBoard {...makeBoard({ marked: [2], wagered: [5] })} />);
    expect(screen.getByText('Trope 2')).toHaveClass('marked');
    expect(screen.getByText('Trope 5')).toHaveClass('wagered');
    expect(screen.getByText('Trope 0')).not.toHaveClass('marked');
  });

  it('highlights cells that are part of a completed bingo line', () => {
    render(<BingoBoard {...makeBoard({ highlightedCells: new Set([0, 1, 2]) })} />);
    expect(screen.getByText('Trope 0')).toHaveClass('bingo-line');
    expect(screen.getByText('Trope 3')).not.toHaveClass('bingo-line');
  });
});
