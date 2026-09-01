// Standard 5x5 bingo lines: 5 rows, 5 columns, 2 diagonals.
const LINES = [];
for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
LINES.push([0, 6, 12, 18, 24]);
LINES.push([4, 8, 12, 16, 20]);

export function getCompletedLines(marked) {
  const markedSet = new Set(marked);
  return LINES.filter((line) => line.every((i) => markedSet.has(i)));
}

export function getCompletedLineCells(marked) {
  const cells = new Set();
  for (const line of getCompletedLines(marked)) {
    for (const i of line) cells.add(i);
  }
  return cells;
}
