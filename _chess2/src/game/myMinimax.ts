import type { Board, PieceColor, Move, Position, CastlingRights } from './types';
import { getValidMoves, wouldMoveResultInCheck, isKingInCheck, getCastlingMoves } from './moveValidation';

export function myMinimaxMove(
  board: Board,
  color: PieceColor,
  depth: number,
  evaluate: (board: Board, color: PieceColor) => number,
  maxTime?: number,
  castlingRights?: CastlingRights
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
    currentCastlingRights: CastlingRights | undefined,
    isRoot: boolean = false
  ): number {
    // Check if time limit exceeded - return immediately
    if (isTimeExpired()) {
      return maximizing ? -Infinity : Infinity;
    }

    if (depth === 0) {
      return evaluate(board, rootColor); // Always evaluate from root AI's perspective
    }

    const moves = getValidMovesForColor(board, currentPlayerColor, currentCastlingRights);

    if (moves.length === 0) {
      // Terminal position: checkmate or stalemate
      const inCheck = isKingInCheck(board, currentPlayerColor);
      
      if (inCheck) {
        // Checkmate - prefer quicker checkmates
        const mateScore = maximizing ? -100000 : 100000;

        return mateScore + (maximizing ? depth : -depth);
      } else {
        // Stalemate - draw (bad when winning, good when losing)
        return 0;
      }
    }

    // Move ordering: captures first, then checks for better pruning
    moves.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;
      
      // Prioritize captures
      if (a.captured) aScore += 10;
      if (b.captured) bScore += 10;
      
      // Prioritize checks (helps find checkmate faster)
      const aBoardAfter = applyMove(board, a);
      const bBoardAfter = applyMove(board, b);
      const opponentColor = currentPlayerColor === 'white' ? 'black' : 'white';
      
      if (isKingInCheck(aBoardAfter, opponentColor)) aScore += 5;
      if (isKingInCheck(bBoardAfter, opponentColor)) bScore += 5;
      
      return bScore - aScore;
    });

    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      // Check time at the start of each iteration
      if (isTimeExpired()) {
        break;
      }
      const newBoard = applyMove(board, move);
      const newCastlingRights = updateCastlingRights(currentCastlingRights, move, board);
      const score = minimax(
        newBoard,
        currentPlayerColor === 'white' ? 'black' : 'white',
        depth - 1,
        !maximizing,
        alpha,
        beta,
        newCastlingRights,
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
  const allMoves = getValidMovesForColor(board, color, castlingRights);

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
    minimax(board, color, currentDepth, true, -Infinity, Infinity, castlingRights, true);

    // If time expired during this iteration, revert to previous best move
    if (isTimeExpired() && currentDepth > 1) {
      bestMoveAtRoot = previousBestMove;
      break;
    }
  }

  return bestMoveAtRoot;
}

// Helper: get all valid moves for a color
function getValidMovesForColor(board: Board, color: PieceColor, castlingRights?: CastlingRights): Move[] {
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

        // Add castling moves for king
        if (piece.type === 'k' && castlingRights) {
          const rights = color === 'white' 
            ? { kingSide: castlingRights.whiteKingSide, queenSide: castlingRights.whiteQueenSide }
            : { kingSide: castlingRights.blackKingSide, queenSide: castlingRights.blackQueenSide };
          const inCheck = isKingInCheck(board, color);
          const castlingMoves = getCastlingMoves(board, from, color, rights, inCheck);
          
          for (const to of castlingMoves) {
            moves.push({
              from,
              to,
              piece,
              isCastling: true,
            });
          }
        }
      }
    }
  }

  return moves;
}

// Helper: update castling rights based on a move
function updateCastlingRights(
  rights: CastlingRights | undefined,
  move: Move,
  board: Board
): CastlingRights | undefined {
  if (!rights) return undefined;

  const newRights = { ...rights };
  const piece = board[move.from.row][move.from.col];

  if (!piece) return newRights;

  // King moved - lose both castling rights
  if (piece.type === 'k') {
    if (piece.color === 'white') {
      newRights.whiteKingSide = false;
      newRights.whiteQueenSide = false;
    } else {
      newRights.blackKingSide = false;
      newRights.blackQueenSide = false;
    }
  }

  // Rook moved - lose castling right on that side
  if (piece.type === 'r') {
    if (piece.color === 'white' && move.from.row === 0) {
      if (move.from.col === 0) newRights.whiteQueenSide = false;
      if (move.from.col === 7) newRights.whiteKingSide = false;
    } else if (piece.color === 'black' && move.from.row === 7) {
      if (move.from.col === 0) newRights.blackQueenSide = false;
      if (move.from.col === 7) newRights.blackKingSide = false;
    }
  }

  return newRights;
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
    if (move.to.col === 5) {
      // King-side castling
      const rook = newBoard[move.from.row][7];

      newBoard[move.from.row][4] = rook;
      newBoard[move.from.row][7] = null;
    } else if (move.to.col === 1) {
      // Queen-side castling
      const rook = newBoard[move.from.row][0];

      newBoard[move.from.row][2] = rook;
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
