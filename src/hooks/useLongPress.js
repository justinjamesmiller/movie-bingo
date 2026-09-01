import { useCallback, useRef } from 'react';

// Detects a long-press (or long-click) vs. a regular click on the same
// element, for touch and mouse alike. `onLongPress` fires once after `ms` of
// continuous press; if it fires, the subsequent click is swallowed so
// `onClick` doesn't also run.
export function useLongPress(onLongPress, onClick, ms = 550) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const start = useCallback(() => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, ms);
  }, [onLongPress, ms]);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const handleClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: handleClick,
  };
}
