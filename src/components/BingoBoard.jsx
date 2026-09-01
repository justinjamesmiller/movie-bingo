import { CENTER_INDEX } from '../data/tropes.js';

export default function BingoBoard({ board, wagered, marked, freeSpace, pending, onCellClick }) {
  return (
    <div className="bingo-board">
      {board.map((text, index) => {
        const classes = ['bingo-cell'];
        const isFreeSpace = freeSpace && index === CENTER_INDEX;
        if (wagered.includes(index)) classes.push('wagered');
        if (marked.includes(index)) classes.push('marked');
        if (isFreeSpace) classes.push('free-space');
        if (pending) classes.push('pending');
        return (
          <div key={index} className={classes.join(' ')} onClick={() => onCellClick(index)}>
            {text}
          </div>
        );
      })}
    </div>
  );
}
