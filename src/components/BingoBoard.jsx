import { CENTER_INDEX } from '../data/tropes.js';
import { useLongPress } from '../hooks/useLongPress.js';

function BingoCell({ index, text, isFreeSpace, wagered, marked, pending, onCellClick, onCellLongPress }) {
  const longPress = useLongPress(
    () => !isFreeSpace && onCellLongPress(index),
    () => onCellClick(index),
  );
  const classes = ['bingo-cell'];
  if (wagered) classes.push('wagered');
  if (marked) classes.push('marked');
  if (isFreeSpace) classes.push('free-space');
  if (pending) classes.push('pending');
  return (
    <div className={classes.join(' ')} {...longPress}>
      {text}
    </div>
  );
}

export default function BingoBoard({ board, wagered, marked, freeSpace, pending, onCellClick, onCellLongPress }) {
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
          onCellClick={onCellClick}
          onCellLongPress={onCellLongPress}
        />
      ))}
    </div>
  );
}
