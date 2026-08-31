import { CENTER_INDEX } from '../data/tropes.js';

export default function BingoBoard({ board, wagered, marked, pending, onCellClick }) {
  return (
    <div className="bingo-board">
      {board.map((text, index) => {
        const classes = ['bingo-cell'];
        if (index === CENTER_INDEX) classes.push('center');
        if (wagered.includes(index)) classes.push('wagered');
        if (marked.includes(index)) classes.push('marked');
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
