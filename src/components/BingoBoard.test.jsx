import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    ...overrides,
  };
}

describe('BingoBoard', () => {
  it('supports keyboard activation and readable non-color state cues', () => {
    const props = makeBoard({
      marked: [4],
      wagered: [4],
      listView: true,
      successfulCallersByText: { 'Trope 4': [{ id: 'bob', name: 'Bob', avatar: '🍿' }] },
    });
    const { container } = render(<BingoBoard {...props} />);
    const cell = screen.getByRole('button', { name: 'Board space: Trope 4, accepted, wagered, successful call' });
    expect(container.querySelector('.bingo-board')).toHaveClass('bingo-board-list');
    expect(cell).toHaveTextContent('✓ Accepted · ◆ Wagered · ★ Called correctly');
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(props.onCellClick).toHaveBeenCalledWith(4);
  });

  afterEach(() => vi.useRealTimers());

  it('briefly celebrates newly accepted spaces even when the host mutates its marked array in place', () => {
    vi.useFakeTimers();
    const props = makeBoard();
    const { rerender } = render(<BingoBoard {...props} />);
    props.marked.push(4);
    rerender(<BingoBoard {...props} />);
    expect(screen.getByText('Trope 4')).toHaveClass('marked', 'flash');
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText('Trope 4')).not.toHaveClass('flash');
    expect(screen.getByText('Trope 4')).toHaveClass('marked');
  });

  it('does not celebrate historical marked spaces when loading or redealing a board', () => {
    const props = makeBoard({ marked: [4] });
    const { container, rerender } = render(<BingoBoard {...props} />);
    expect(container.querySelector('.flash')).toBeNull();
    rerender(<BingoBoard {...props} board={props.board.map((text) => `New ${text}`)} marked={[4, 5]} />);
    expect(container.querySelector('.flash')).toBeNull();
  });

  it('clears the short celebration when an accepted space is undone', () => {
    const props = makeBoard();
    const { rerender } = render(<BingoBoard {...props} />);
    rerender(<BingoBoard {...props} marked={[4]} />);
    expect(screen.getByText('Trope 4')).toHaveClass('flash');
    rerender(<BingoBoard {...props} marked={[]} />);
    expect(screen.getByText('Trope 4')).not.toHaveClass('flash', 'marked');
  });

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

  it('highlights the current player call separately from accepted marks', () => {
    render(<BingoBoard {...makeBoard({ calledIndexes: [4] })} />);
    expect(screen.getByText('Trope 4')).toHaveClass('called');
  });

  it('keeps both call and wager states on the same cell', () => {
    render(<BingoBoard {...makeBoard({ wagered: [4], calledIndexes: [4] })} />);
    expect(screen.getByText('Trope 4')).toHaveClass('wagered', 'called');
  });

  it('highlights cells that are part of a completed bingo line', () => {
    render(<BingoBoard {...makeBoard({ highlightedCells: new Set([0, 1, 2]) })} />);
    expect(screen.getByText('Trope 0')).toHaveClass('bingo-line');
    expect(screen.getByText('Trope 3')).not.toHaveClass('bingo-line');
  });

  it('shows other players calls with bounded avatars and an overflow indicator', () => {
    const callers = [
      { id: 'alice', name: 'Alice', avatar: '🎬' },
      { id: 'bob', name: 'Bob', avatar: '🍿' },
      { id: 'carol', name: 'Carol', avatar: '⭐' },
    ];
    const props = makeBoard({ callersByText: { 'Trope 4': callers } });
    render(<BingoBoard {...props} />);
    const indicator = screen.getByLabelText('Called by Alice, Bob, Carol');
    expect(indicator.querySelectorAll('.caller-avatar')).toHaveLength(2);
    expect(indicator.querySelector('.wide-overflow')).toHaveTextContent('...');
    expect(screen.queryByText('⭐')).toBeNull();
    expect(screen.getByText('Trope 4')).toHaveClass('has-callers');
    fireEvent.click(indicator);
    expect(props.onCellClick).toHaveBeenCalledWith(4);
  });

  it('does not show an overflow indicator for a single caller', () => {
    render(<BingoBoard {...makeBoard({ callersByText: { 'Trope 4': [{ id: 'bob', name: 'Bob', avatar: '🍿' }] } })} />);
    expect(screen.getByLabelText('Called by Bob').querySelector('.caller-overflow')).toBeNull();
  });

  it('uses a distinct called-hit celebration and keeps a successful-call marker after it finishes', () => {
    vi.useFakeTimers();
    const props = makeBoard();
    const { rerender } = render(<BingoBoard {...props} />);
    rerender(
      <BingoBoard
        {...props}
        marked={[4]}
        successfulCallersByText={{ 'Trope 4': [{ id: 'bob', name: 'Bob', avatar: '🍿' }] }}
      />,
    );
    const cell = screen.getByText('Trope 4');
    expect(cell).toHaveClass('flash', 'call-hit-flash', 'call-hit', 'marked');
    expect(screen.getByRole('img', { name: 'Called trope accepted' })).toBeInTheDocument();
    expect(screen.getByLabelText('Called correctly by Bob')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1100));
    expect(cell).not.toHaveClass('flash', 'call-hit-flash');
    expect(cell).toHaveClass('call-hit', 'marked');
    expect(screen.getByRole('img', { name: 'Called trope accepted' })).toBeInTheDocument();
  });

  it('restores successful-call markings without replaying their celebration', () => {
    const { container } = render(
      <BingoBoard
        {...makeBoard({
          marked: [4],
          successfulCallersByText: { 'Trope 4': [{ id: 'bob', name: 'Bob', avatar: '🍿' }] },
        })}
      />,
    );
    expect(screen.getByText('Trope 4')).toHaveClass('call-hit');
    expect(container.querySelector('.flash')).toBeNull();
  });

  it('does not shrink the trope label when a caller marker appears or disappears', () => {
    const text = 'Someone returns after being presumed dead';
    const props = makeBoard({ board: [text, ...Array.from({ length: 24 }, (_, index) => `Trope ${index}`)] });
    const { rerender } = render(<BingoBoard {...props} />);
    const cell = screen.getByText(text);
    const initialStyle = cell.getAttribute('style');
    rerender(<BingoBoard {...props} callersByText={{ [text]: [{ id: 'bob', name: 'Bob', avatar: '🍿' }] }} />);
    expect(cell.getAttribute('style')).toBe(initialStyle);
    expect(cell.style.fontSize).toBe('');
    expect(screen.getByLabelText('Called by Bob')).toBeInTheDocument();
    rerender(<BingoBoard {...props} />);
    expect(cell.getAttribute('style')).toBe(initialStyle);
    expect(screen.queryByLabelText('Called by Bob')).toBeNull();
  });
});
