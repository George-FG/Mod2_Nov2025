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
  // Check for checkmate or stalemate
  const hasLegalMoves = hasAnyLegalMove(board, color);
  const inCheck = isKingInCheck(board, color);
  
  if (!hasLegalMoves) {
    if (inCheck) {
      // Checkmate - worst possible score for the player in checkmate
      return -Infinity;
    } else {
      // Stalemate - draw
      return 0;
    }
  }

  // Check if opponent is in checkmate
  const opponentColor = color === 'white' ? 'black' : 'white';
  const opponentHasLegalMoves = hasAnyLegalMove(board, opponentColor);
  const opponentInCheck = isKingInCheck(board, opponentColor);
  
  if (!opponentHasLegalMoves && opponentInCheck) {
    // Opponent is checkmated - best possible score
    return Infinity;
  }

  let myMaterial = 0;
  let theirMaterial = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];

      if (piece) {
        const value = pieceValues[piece.type];

        if (piece.color === color) {
          myMaterial += value;
        } else {
          theirMaterial += value;
        }
      }
    }
  }

  // Return the material difference (normalized) with tiny random noise to break ties
  const materialDiff = (myMaterial - theirMaterial) / STARTING_MATERIAL;
  const noise = (Math.random() - 0.5) * 0.001; // Small random value: -0.0005 to +0.0005

  return materialDiff + noise;
}

// Helper function to check if a player has any legal moves
function hasAnyLegalMove(board: Board, color: PieceColor): boolean {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];

      if (piece && piece.color === color) {
        const from: Position = { row, col };
        const moves = getValidMoves(board, from, piece);
        const legalMoves = moves.filter(
          (to) => !wouldMoveResultInCheck(board, from, to, color)
        );

        if (legalMoves.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}
