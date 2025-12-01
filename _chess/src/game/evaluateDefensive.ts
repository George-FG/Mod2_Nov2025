import type { Board, PieceColor } from './types';

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Total starting material for one side
const STARTING_MATERIAL = 8 * 100 + 2 * 320 + 2 * 330 + 2 * 500 + 1 * 900; // = 3900

// Defensive AI: Only cares about preserving own material
export function evaluateDefensive(board: Board, color: PieceColor): number {
  let myMaterial = 0;

  // Only count own material (we want to maximize it)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      if (piece.color === color) {
        myMaterial += pieceValues[piece.type];
      }
    }
  }

  // Return own material (higher own material = better)
  // Normalize and add small noise to prevent repetition
  const score = myMaterial / STARTING_MATERIAL;
  const noise = (Math.random() - 0.5) * 0.01;

  return score + noise;
}
