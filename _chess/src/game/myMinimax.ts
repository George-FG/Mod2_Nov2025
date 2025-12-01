import type { Board, PieceColor, Move, Position } from './types';
import { getValidMoves, wouldMoveResultInCheck } from './moveValidation';

export function myMinimaxMove(
  board: Board,
  color: PieceColor,
  depth: number,
  evaluate: (board: Board, color: PieceColor) => number,
  maxTime?: number
): Move | null {
  const startTime = Date.now();
  let bestMoveAtRoot: Move | null = null;
  let timeExpired = false;
  const rootColor = color; // Store the original AI's color

  function isTimeExpired(): boolean {
    if (timeExpired) return true;

    if (maxTime !== undefined && Date.now() - startTime > maxTime) {
      timeExpired = true;

      return true;
    }

    return false;
  }

  function minimax(
    board: Board,
    currentPlayerColor: PieceColor,
    depth: number,
    maximizing: boolean,
    alpha: number,
    beta: number,
    isRoot: boolean = false
  ): number {
    // Check if time limit exceeded - return immediately
    if (isTimeExpired()) {
      return maximizing ? -Infinity : Infinity;
    }

    if (depth === 0) {
      return evaluate(board, rootColor); // Always evaluate from root AI's perspective
    }

    const moves = getValidMovesForColor(board, currentPlayerColor);

    if (moves.length === 0) {
      return evaluate(board, rootColor); // Always evaluate from root AI's perspective
    }

    // Move ordering: captures first for better pruning
    moves.sort((a, b) => {
      const aCapture = a.captured ? 1 : 0;
      const bCapture = b.captured ? 1 : 0;

      return bCapture - aCapture;
    });

    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      // Check time at the start of each iteration
      if (isTimeExpired()) {
        break;
      }
      const newBoard = applyMove(board, move);
      const score = minimax(
        newBoard,
        currentPlayerColor === 'white' ? 'black' : 'white',
        depth - 1,
        !maximizing,
        alpha,
        beta,
        false
      );

      // Check if time expired during recursive call
      if (isTimeExpired()) {
        break;
      }

      if (maximizing) {
        if (score > bestScore) {
          bestScore = score;
          if (isRoot) bestMoveAtRoot = move;
        }
        // Randomly pick between equal moves at root to avoid repetition
        else if (isRoot && score === bestScore && Math.random() < 0.5) {
          bestMoveAtRoot = move;
        }
        alpha = Math.max(alpha, score);
        // Beta cutoff: no need to explore further moves
        if (beta <= alpha) {
          break; // Prune remaining branches
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          if (isRoot) bestMoveAtRoot = move;
        }
        // Randomly pick between equal moves at root to avoid repetition
        else if (isRoot && score === bestScore && Math.random() < 0.5) {
          bestMoveAtRoot = move;
        }
        beta = Math.min(beta, score);
        // Alpha cutoff: no need to explore further moves
        if (beta <= alpha) {
          break; // Prune remaining branches
        }
      }
    }

    return bestScore;
  }

  // Initialize with first valid move as fallback
  const allMoves = getValidMovesForColor(board, color);

  if (allMoves.length > 0) {
    bestMoveAtRoot = allMoves[0];
  }

  // Iterative deepening: start at depth 1 and increase until max depth or time expires
  for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
    if (isTimeExpired()) {
      break;
    }

    // Store the best move from this iteration
    const previousBestMove = bestMoveAtRoot;
    
    // Initialize alpha and beta for alpha-beta pruning
    minimax(board, color, currentDepth, true, -Infinity, Infinity, true);

    // If time expired during this iteration, revert to previous best move
    if (isTimeExpired() && currentDepth > 1) {
      bestMoveAtRoot = previousBestMove;
      break;
    }
  }

  return bestMoveAtRoot;
}

// Helper: get all valid moves for a color
function getValidMovesForColor(board: Board, color: PieceColor): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];

      if (piece && piece.color === color) {
        const from: Position = { row, col };
        const possibleMoves = getValidMoves(board, from, piece);

        // Filter out moves that would put own king in check
        const legalMoves = possibleMoves.filter(
          (to) => !wouldMoveResultInCheck(board, from, to, piece.color)
        );

        for (const to of legalMoves) {
          moves.push({
            from,
            to,
            piece,
            captured: board[to.row][to.col] || undefined,
          });
        }
      }
    }
  }

  return moves;
}

// Helper: apply a move to a board and return a new board
function applyMove(board: Board, move: Move): Board {
  // Shallow copy rows only (faster than map)
  const newBoard: Board = [];

  for (let i = 0; i < 8; i++) {
    newBoard[i] = [...board[i]];
  }
  const piece = newBoard[move.from.row][move.from.col];

  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;

  // Handle castling
  if (move.isCastling && piece && piece.type === 'k') {
    if (move.to.col === 6) {
      // King-side castling
      const rook = newBoard[move.from.row][7];

      newBoard[move.from.row][5] = rook;
      newBoard[move.from.row][7] = null;
    } else if (move.to.col === 2) {
      // Queen-side castling
      const rook = newBoard[move.from.row][0];

      newBoard[move.from.row][3] = rook;
      newBoard[move.from.row][0] = null;
    }
  }

  // Handle pawn promotion
  if (piece && piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 7 : 0;

    if (move.to.row === promotionRow) {
      newBoard[move.to.row][move.to.col] = { type: 'q', color: piece.color };
    }
  }

  return newBoard;
}
