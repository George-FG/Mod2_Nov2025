import type { Board, PieceColor, Position } from './types';
import { isKingInCheck, getValidMoves, wouldMoveResultInCheck } from './moveValidation';

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Total starting material for one side: 8 pawns + 2 knights + 2 bishops + 2 rooks + 1 queen
const STARTING_MATERIAL = 8 * 1 + 2 * 3 + 2 * 3 + 2 * 5 + 1 * 9; // = 39

export function simpleEvaluate(board: Board, color: PieceColor): number {
  // Calculate material and positional scores
  let myScore = 0;
  let opponentScore = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) continue;

      const value = pieceValues[piece.type];
      const isCenter = (row === 3 || row === 4) && (col === 3 || col === 4);
      const centerBonus = isCenter ? value * 0.1 : 0;

      if (piece.color === color) {
        myScore += value + centerBonus;
      } else {
        opponentScore += value + centerBonus;
      }
    }
  }

  // Combine scores with small random noise to prevent repetition
  const materialDiff = (myScore - opponentScore) / STARTING_MATERIAL;
  const noise = (Math.random() - 0.5) * 0.001;

  return materialDiff + noise;
}

// Fast check for checkmate/stalemate - only called when moves.length === 0
export function isCheckmate(board: Board, color: PieceColor): boolean {
  if (!isKingInCheck(board, color)) return false;

  return !hasAnyLegalMove(board, color);
}

export function isStalemate(board: Board, color: PieceColor): boolean {
  if (isKingInCheck(board, color)) return false;

  return !hasAnyLegalMove(board, color);
}

function hasAnyLegalMove(board: Board, color: PieceColor): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece || piece.color !== color) continue;

      const from: Position = { row, col };
      const moves = getValidMoves(board, from, piece);
      
      for (const to of moves) {
        if (!wouldMoveResultInCheck(board, from, to, color)) {
          return true; // Early exit on first legal move found
        }
      }
    }
  }

  return false;
}
