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

// Offensive AI: Only cares about capturing opponent's material
export function evaluateOffensive(board: Board, color: PieceColor): number {
  const opponentColor = color === 'white' ? 'black' : 'white';
  
  let opponentMaterial = 0;

  // Only count opponent's material (we want to minimize it)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      if (piece.color === opponentColor) {
        opponentMaterial += pieceValues[piece.type];
      }
    }
  }

  // Return negative opponent material (lower opponent material = better for us)
  // Normalize and add small noise to prevent repetition
  const score = -opponentMaterial / STARTING_MATERIAL;
  const noise = (Math.random() - 0.5) * 0.01;

  return score + noise;
}
