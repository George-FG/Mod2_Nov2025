import type { Board, Position, Piece, PieceColor } from './types';
import { getValidMoves, wouldMoveResultInCheck } from './moveValidation';

const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 30,
  r: 50,
  q: 90,
  k: 900,
};

const evaluateBoard = (board: Board, aiColor: PieceColor): number => {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece) {
        const value = PIECE_VALUES[piece.type];

        if (piece.color === aiColor) {
          score += value;
        } else {
          score -= value;
        }
      }
    }
  }
  
  return score;
};

const getAllLegalMoves = (board: Board, color: PieceColor): Array<{ from: Position; to: Position; piece: Piece }> => {
  const moves: Array<{ from: Position; to: Position; piece: Piece }> = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.color === color) {
        const from = { row, col };
        const validMoves = getValidMoves(board, from, piece);
        
        // Filter out moves that would result in check
        const legalMoves = validMoves.filter(to => 
          !wouldMoveResultInCheck(board, from, to, color)
        );
        
        legalMoves.forEach(to => {
          moves.push({ from, to, piece });
        });
      }
    }
  }
  
  return moves;
};

const applyMove = (board: Board, from: Position, to: Position): Board => {
  const newBoard = board.map(row => [...row]);

  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;

  return newBoard;
};

const minimax = (
  board: Board,
  depth: number,
  isMaximizing: boolean,
  aiColor: PieceColor,
  alpha: number,
  beta: number
): number => {
  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }
  
  const currentColor: PieceColor = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const legalMoves = getAllLegalMoves(board, currentColor);
  
  if (legalMoves.length === 0) {
    // No legal moves - could be checkmate or stalemate
    return isMaximizing ? -10000 : 10000;
  }
  
  if (isMaximizing) {
    let maxEval = -Infinity;

    for (const move of legalMoves) {
      const newBoard = applyMove(board, move.from, move.to);
      const evaluation = minimax(newBoard, depth - 1, false, aiColor, alpha, beta);

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Alpha-beta pruning
    }

    return maxEval;
  } else {
    let minEval = Infinity;

    for (const move of legalMoves) {
      const newBoard = applyMove(board, move.from, move.to);
      const evaluation = minimax(newBoard, depth - 1, true, aiColor, alpha, beta);

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Alpha-beta pruning
    }

    return minEval;
  }
};

export interface AISettings {
  depth?: number;
  maxTime?: number;
}

export interface AIMoveRequest {
  board: Board;
  color: PieceColor;
  settings: AISettings;
}

export const aiMove = (request: AIMoveRequest): { from: Position; to: Position } | null => {
  const { board, color, settings } = request;
  const maxTime = settings.maxTime ?? 1000;
  const startDepth = settings.depth ?? 2;
  
  const startTime = Date.now();
  const legalMoves = getAllLegalMoves(board, color);
  
  if (legalMoves.length === 0) return null;
  
  let bestMove = legalMoves[0];
  let depth = startDepth;
  
  // Iterative deepening with time limit
  while (Date.now() - startTime < maxTime) {
    let currentBestValue = -Infinity;
    let currentBestMove = bestMove;
    
    for (const move of legalMoves) {
      if (Date.now() - startTime >= maxTime) break;
      
      const newBoard = applyMove(board, move.from, move.to);
      const value = minimax(newBoard, depth - 1, false, color, -Infinity, Infinity);
      
      if (value > currentBestValue) {
        currentBestValue = value;
        currentBestMove = move;
      }
    }
    
    if (Date.now() - startTime < maxTime) {
      bestMove = currentBestMove;
      depth++;
    }
  }
  
  return { from: bestMove.from, to: bestMove.to };
};
