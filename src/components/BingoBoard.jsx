import { useEffect, useRef, useState } from 'react';
import { CENTER_INDEX } from '../data/tropes.js';
import { formatPlayerName } from '../utils/playerName.js';

function BingoCell({
  index,
  text,
  isFreeSpace,
  wagered,
  marked,
  called,
  callers,
  successfulCallers,
  listView,
  showStateLabels,
  pending,
  flash,
  onLine,
  onCellClick,
}) {
  const callHit = marked && successfulCallers.length > 0;
  const displayedCallers = callHit ? successfulCallers : callers;
  const classes = ['bingo-cell'];
  if (displayedCallers.length) classes.push('has-callers');
  if (wagered) classes.push('wagered');
  if (marked) classes.push('marked');
  if (called) classes.push('called');
  if (isFreeSpace) classes.push('free-space');
  if (pending) classes.push('pending');
  if (flash) classes.push('flash');
  if (callHit) classes.push('call-hit');
  if (flash && callHit) classes.push('call-hit-flash');
  if (onLine) classes.push('bingo-line');
  return (
    <div
      className={classes.join(' ')}
      role="button"
      tabIndex={isFreeSpace ? -1 : 0}
      aria-label={`Board space: ${text}${marked ? ', accepted' : ''}${wagered ? ', wagered' : ''}${called ? ', called' : ''}${callHit ? ', successful call' : ''}`}
      onKeyDown={(event) => {
        if (!isFreeSpace && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onCellClick(index);
        }
      }}
      onClick={() => onCellClick(index)}
    >
      {text}
      {(listView || showStateLabels) && (
        <span className="cell-state-labels">
          {[
            marked ? '✓ Accepted' : '○ Unaccepted',
            wagered && '◆ Wagered',
            called && '→ Called',
            callHit && '★ Called correctly',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
      {callHit && (
        <span className="call-hit-marker" role="img" aria-label="Called trope accepted" title="Called trope accepted">
          🎯
        </span>
      )}
      {displayedCallers.length > 0 && (
        <span
          className="cell-callers"
          aria-label={`${callHit ? 'Called correctly by' : 'Called by'} ${displayedCallers.map((player) => player.name).join(', ')}`}
          title={`${callHit ? 'Called correctly by' : 'Called by'} ${displayedCallers.map((player) => formatPlayerName(player)).join(', ')}`}
        >
          {displayedCallers.slice(0, 2).map((player, position) => (
            <span
              key={player.id}
              className={position === 1 ? 'caller-avatar extra-caller' : 'caller-avatar'}
              aria-hidden="true"
            >
              {player.avatar || '👤'}
            </span>
          ))}
          {displayedCallers.length > 1 && (
            <span className="caller-overflow narrow-overflow" aria-hidden="true">
              ...
            </span>
          )}
          {displayedCallers.length > 2 && (
            <span className="caller-overflow wide-overflow" aria-hidden="true">
              ...
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default function BingoBoard({
  board,
  wagered,
  marked,
  calledIndexes = [],
  callersByText = {},
  successfulCallersByText = {},
  listView = false,
  showStateLabels = false,
  freeSpace,
  pending,
  highlightedCells,
  onCellClick,
}) {
  const markedKey = marked.join(',');
  const boardKey = JSON.stringify(board);
  const prevMarkedRef = useRef(new Set(marked));
  const prevBoardRef = useRef(boardKey);
  const [flashSet, setFlashSet] = useState(new Set());

  useEffect(() => {
    const newlyMarked =
      prevBoardRef.current === boardKey
        ? marked.filter((index) => !prevMarkedRef.current.has(index) && !(freeSpace && index === CENTER_INDEX))
        : [];
    prevMarkedRef.current = new Set(marked);
    prevBoardRef.current = boardKey;
    setFlashSet(new Set(newlyMarked));
    if (newlyMarked.length === 0) return;
    const calledHit = newlyMarked.some((index) => successfulCallersByText[board[index]]?.length);
    const timeout = setTimeout(() => setFlashSet(new Set()), calledHit ? 1100 : 700);
    return () => clearTimeout(timeout);
  }, [markedKey, boardKey]);

  return (
    <div className={`bingo-board${listView ? ' bingo-board-list' : ''}`}>
      {board.map((text, index) => (
        <BingoCell
          key={index}
          index={index}
          text={text}
          isFreeSpace={freeSpace && index === CENTER_INDEX}
          wagered={wagered.includes(index)}
          marked={marked.includes(index)}
          called={calledIndexes.includes(index)}
          callers={callersByText[text] || []}
          successfulCallers={successfulCallersByText[text] || []}
          listView={listView}
          showStateLabels={showStateLabels}
          pending={pending}
          flash={flashSet.has(index)}
          onLine={!!highlightedCells?.has(index)}
          onCellClick={onCellClick}
        />
      ))}
    </div>
  );
}
