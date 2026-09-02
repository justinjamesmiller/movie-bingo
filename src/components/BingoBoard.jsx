import { useEffect, useRef, useState } from 'react';
import { CENTER_INDEX } from '../data/tropes.js';

function BingoCell({ index, text, isFreeSpace, wagered, marked, pending, flash, onLine, onCellClick }) {
  const classes = ['bingo-cell'];
  if (wagered) classes.push('wagered');
  if (marked) classes.push('marked');
  if (isFreeSpace) classes.push('free-space');
  if (pending) classes.push('pending');
  if (flash) classes.push('flash');
  if (onLine) classes.push('bingo-line');
  return (
    <div className={classes.join(' ')} onClick={() => onCellClick(index)}>
      {text}
    </div>
  );
}

export default function BingoBoard({ board, wagered, marked, freeSpace, pending, highlightedCells, onCellClick }) {
  const prevMarkedRef = useRef(marked);
  const [flashSet, setFlashSet] = useState(new Set());

  useEffect(() => {
    const prev = new Set(prevMarkedRef.current);
    const newlyMarked = marked.filter((i) => !prev.has(i));
    prevMarkedRef.current = marked;
    if (newlyMarked.length === 0) return;
    setFlashSet(new Set(newlyMarked));
    const timeout = setTimeout(() => setFlashSet(new Set()), 700);
    return () => clearTimeout(timeout);
  }, [marked]);

  return (
    <div className="bingo-board">
      {board.map((text, index) => (
        <BingoCell
          key={index}
          index={index}
          text={text}
          isFreeSpace={freeSpace && index === CENTER_INDEX}
          wagered={wagered.includes(index)}
          marked={marked.includes(index)}
          pending={pending}
          flash={flashSet.has(index)}
          onLine={!!highlightedCells?.has(index)}
          onCellClick={onCellClick}
        />
      ))}
    </div>
  );
}
