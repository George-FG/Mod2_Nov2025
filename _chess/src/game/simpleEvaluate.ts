// Shared simple evaluation function for chess
export function simpleEvaluate(board: any[][], color: string): number {
  const pieceValues: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };
  let score = 0;
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece) {
        let value = pieceValues[piece.type];
        // Example: reward center control
        if ((row === 3 || row === 4) && (col === 3 || col === 4)) {
          value *= 1.1;
        }
        score += piece.color === color ? value : -value;
      }
    }
  }
  return score;
}
