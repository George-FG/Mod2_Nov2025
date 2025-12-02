import type { Board, PieceColor, Move, Position, CastlingRights } from './types';
import { getValidMoves, wouldMoveResultInCheck, isKingInCheck, getCastlingMoves } from './moveValidation';

/**
 * Simple transposition table entry.
 */
type TTEntry = {
  depth: number;
  score: number;
  flag: 'exact' | 'alpha' | 'beta';
  bestMove?: Move;
};

const transpositionTable = new Map<string, TTEntry>();

/**
 * Hash the current position (board + side to move + castling rights).
 * For serious engines you’d use Zobrist; this is a simple, easy-to-drop-in version.
 */
function hashPosition(
  board: Board,
  sideToMove: PieceColor,
  castlingRights?: CastlingRights
): string {
  return JSON.stringify({
    b: board,
    s: sideToMove,
    c: castlingRights,
  });
}

/**
 * Check if adding this position key would create a threefold repetition.
 * We assume `history` contains all previous position keys (including current).
 */
function isThirdRepetition(
  newKey: string,
  history: string[]
): boolean {
  let count = 0;

  for (const k of history) {
    if (k === newKey) {
      count++;
      if (count >= 2) {
        // Two previous occurrences; playing this move would be the 3rd
        return true;
      }
    }
  }

  return false;
}

/**
 * Main entry point: choose the best move for `color` using negamax,
 * alpha-beta pruning, quiescence search, a transposition table, and
 * iterative deepening.
 *
 * `positionHistory` (optional) should be an array of position hashes for the
 * current game so far (including previous moves). If you don't have that,
 * you can ignore it; the engine will still avoid immediate repetition cycles
 * visible inside the search tree itself.
 */
export function myMinimaxMove(
  board: Board,
  color: PieceColor,
  depth: number,
  evaluate: (board: Board, color: PieceColor) => number,
  maxTime?: number,
  castlingRights?: CastlingRights,
  positionHistory?: string[]
): Move | null {
  const startTime = Date.now();
  const aiColor = color;

  // Clear TT for this search (optional but usually good per-move)
  transpositionTable.clear();

  let bestMoveAtRoot: Move | null = null;
  let timeExpired = false;

  // Build initial history: caller history + current position
  const baseHistory: string[] = positionHistory ? [...positionHistory] : [];
  baseHistory.push(hashPosition(board, color, castlingRights));

  function isTimeExpired(): boolean {
    if (timeExpired) return true;

    if (maxTime !== undefined && Date.now() - startTime > maxTime) {
      timeExpired = true;
      return true;
    }

    return false;
  }

  /**
   * Quiescence search: extend search at leaf nodes, but only along captures.
   * We don't bother with threefold here; the main tree already handles it.
   */
  function quiescence(
    board: Board,
    sideToMove: PieceColor,
    alpha: number,
    beta: number,
    currentCastlingRights: CastlingRights | undefined
  ): number {
    if (isTimeExpired()) return 0;

    // Evaluate from the AI's perspective, but we’re currently at `sideToMove`.
    const sign = sideToMove === aiColor ? 1 : -1;
    const standPat = sign * evaluate(board, aiColor);

    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    // Only consider captures in quiescence
    const moves = getValidMovesForColor(board, sideToMove, currentCastlingRights)
      .filter(m => !!m.captured);

    if (moves.length === 0) {
      return alpha;
    }

    const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';

    for (const move of moves) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(currentCastlingRights, move, board);

      const score = -quiescence(
        newBoard,
        nextColor,
        -beta,
        -alpha,
        newRights
      );

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  /**
   * Negamax search with alpha-beta pruning and TT.
   * Returns score from the perspective of `sideToMove`.
   */
  function negamax(
    board: Board,
    sideToMove: PieceColor,
    depth: number,
    alpha: number,
    beta: number,
    currentCastlingRights: CastlingRights | undefined,
    history: string[],
    lastMove?: Move
  ): number {
    if (isTimeExpired()) return 0;

    const hash = hashPosition(board, sideToMove, currentCastlingRights);
    const alphaOrig = alpha;
    const ttEntry = transpositionTable.get(hash);

    // TT lookup
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 'exact') return ttEntry.score;
      if (ttEntry.flag === 'alpha' && ttEntry.score <= alpha) return ttEntry.score;
      if (ttEntry.flag === 'beta' && ttEntry.score >= beta) return ttEntry.score;
    }

    if (depth <= 0) {
      return quiescence(board, sideToMove, alpha, beta, currentCastlingRights);
    }

    const moves = getValidMovesForColor(board, sideToMove, currentCastlingRights, lastMove);

    if (moves.length === 0) {
      const inCheck = isKingInCheck(board, sideToMove);

      if (inCheck) {
        // Checkmate from side-to-move's perspective is very bad
        return -100000;
      }

      // Stalemate
      return 0;
    }

    // If TT had a bestMove, try it first
    if (ttEntry?.bestMove) {
      const idx = moves.findIndex(
        m =>
          m.from.row === ttEntry.bestMove!.from.row &&
          m.from.col === ttEntry.bestMove!.from.col &&
          m.to.row === ttEntry.bestMove!.to.row &&
          m.to.col === ttEntry.bestMove!.to.col
      );

      if (idx >= 0) {
        const [mv] = moves.splice(idx, 1);
        moves.unshift(mv);
      }
    }

    // Simple move ordering: captures first
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    let bestScore = -Infinity;
    let bestMoveLocal: Move | undefined;
    const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';

    for (const move of moves) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(currentCastlingRights, move, board);
      const newHash = hashPosition(newBoard, nextColor, newRights);

      let score: number;

      // --- Threefold repetition handling ---
      if (isThirdRepetition(newHash, history)) {
        // Treat as draw-ish; strong bias based on AI's static eval
        const evalFromAI = evaluate(newBoard, aiColor); // >0 good for AI
        let drawScoreForAI = 0;

        if (evalFromAI > 100) {
          // AI is better → draw is very bad, avoid it!
          drawScoreForAI = -10000;
        } else if (evalFromAI < -100) {
          // AI is worse → draw is good, accept it
          drawScoreForAI = 5000;
        } else {
          // Position is roughly equal → draw is neutral
          drawScoreForAI = 0;
        }

        const sign = sideToMove === aiColor ? 1 : -1;
        score = sign * drawScoreForAI;
      } else {
        // Normal recursive search
        const newHistory = [...history, newHash];

        // Check if opponent can force repetition after this move
        const opponentCanDraw = opponentCanForceRepetition(newBoard, nextColor, newHistory, newRights);
        
        if (opponentCanDraw) {
          // Opponent can force a draw - evaluate as a draw position
          const evalFromAI = evaluate(newBoard, aiColor);
          let drawScoreForAI = 0;

          if (evalFromAI > 100) {
            // AI is better → opponent forcing draw is bad
            drawScoreForAI = -10000;
          } else if (evalFromAI < -100) {
            // AI is worse → opponent forcing draw is acceptable
            drawScoreForAI = 5000;
          } else {
            drawScoreForAI = 0;
          }

          const sign = sideToMove === aiColor ? 1 : -1;
          score = sign * drawScoreForAI;
        } else {
          score = -negamax(
            newBoard,
            nextColor,
            depth - 1,
            -beta,
            -alpha,
            newRights,
            newHistory,
            move
          );
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMoveLocal = move;
      }

      if (bestScore > alpha) alpha = bestScore;
      if (alpha >= beta) break; // beta cutoff
    }

    // Store in TT unless time expired mid-node
    if (!isTimeExpired()) {
      let flag: TTEntry['flag'] = 'exact';

      if (bestScore <= alphaOrig) flag = 'alpha';
      else if (bestScore >= beta) flag = 'beta';

      transpositionTable.set(hash, {
        depth,
        score: bestScore,
        flag,
        bestMove: bestMoveLocal,
      });
    }

    return bestScore;
  }

  /**
   * Root negamax wrapper: keeps track of best move at root.
   */
  function negamaxRoot(
    board: Board,
    sideToMove: PieceColor,
    depth: number,
    alpha: number,
    beta: number,
    currentCastlingRights: CastlingRights | undefined,
    history: string[],
    lastMove?: Move
  ): number {
    if (isTimeExpired()) return 0;

    const moves = getValidMovesForColor(board, sideToMove, currentCastlingRights, lastMove);

    if (moves.length === 0) {
      const inCheck = isKingInCheck(board, sideToMove);

      if (inCheck) return -100000;

      return 0;
    }

    // Basic move ordering: captures first
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    let bestScore = -Infinity;
    const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';

    for (const move of moves) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(currentCastlingRights, move, board);
      const newHash = hashPosition(newBoard, nextColor, newRights);

      let score: number;

      if (isThirdRepetition(newHash, history)) {
        const evalFromAI = evaluate(newBoard, aiColor);
        let drawScoreForAI = 0;

        if (evalFromAI > 100) drawScoreForAI = -10000;
        else if (evalFromAI < -100) drawScoreForAI = 5000;

        const sign = sideToMove === aiColor ? 1 : -1;
        score = sign * drawScoreForAI;
      } else {
        const newHistory = [...history, newHash];

        // Check if opponent can force repetition after this move
        const opponentCanDraw = opponentCanForceRepetition(newBoard, nextColor, newHistory, newRights);
        
        if (opponentCanDraw) {
          const evalFromAI = evaluate(newBoard, aiColor);
          let drawScoreForAI = 0;

          if (evalFromAI > 100) drawScoreForAI = -10000;
          else if (evalFromAI < -100) drawScoreForAI = 5000;

          const sign = sideToMove === aiColor ? 1 : -1;
          score = sign * drawScoreForAI;
        } else {
          score = -negamax(
            newBoard,
            nextColor,
            depth - 1,
            -beta,
            -alpha,
            newRights,
            newHistory,
            move
          );
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMoveAtRoot = move;
      }

      if (bestScore > alpha) alpha = bestScore;
      if (alpha >= beta) break;
    }

    return bestScore;
  }

  // Fallback: first legal move if nothing else
  const allMoves = getValidMovesForColor(board, color, castlingRights, undefined);

  if (allMoves.length > 0) {
    bestMoveAtRoot = allMoves[0];
  }

  // Iterative deepening
  for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
    if (isTimeExpired()) break;

    const previousBest = bestMoveAtRoot;

    negamaxRoot(board, color, currentDepth, -Infinity, Infinity, castlingRights, baseHistory, undefined);

    if (isTimeExpired() && currentDepth > 1) {
      bestMoveAtRoot = previousBest;
      break;
    }
  }

  return bestMoveAtRoot;
}

/**
 * Get all legal moves for a given color, including castling.
 */
function getValidMovesForColor(
  board: Board,
  color: PieceColor,
  castlingRights?: CastlingRights,
  lastMove?: Move
): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];

      if (!piece || piece.color !== color) continue;

      const from: Position = { row, col };
      const possibleMoves = getValidMoves(board, from, piece, lastMove);

      // Filter out moves that would leave own king in check
      const legalMoves = possibleMoves.filter(
        (to) => !wouldMoveResultInCheck(board, from, to, piece.color)
      );

      for (const to of legalMoves) {
        const captured = board[to.row][to.col];
        // Check if this is an en passant move
        const isEnPassant = piece.type === 'p' && !captured && from.col !== to.col;
        
        moves.push({
          from,
          to,
          piece,
          captured: captured || (isEnPassant && lastMove ? lastMove.piece : undefined),
          isEnPassant,
        });
      }

      // Add castling moves for king
      if (piece.type === 'k' && castlingRights) {
        const rights =
          color === 'white'
            ? {
                kingSide: castlingRights.whiteKingSide,
                queenSide: castlingRights.whiteQueenSide,
              }
            : {
                kingSide: castlingRights.blackKingSide,
                queenSide: castlingRights.blackQueenSide,
              };

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

  // Improved move ordering
  moves.sort((a, b) => {
    // 1. Captures first
    const aCap = a.captured ? 1 : 0;
    const bCap = b.captured ? 1 : 0;
    if (aCap !== bCap) return bCap - aCap;

    // 2. Castling moves early (good king moves)
    const aCastle = a.isCastling ? 1 : 0;
    const bCastle = b.isCastling ? 1 : 0;
    if (aCastle !== bCastle) return bCastle - aCastle;

    // 3. Non-king moves before king moves
    const aKing = a.piece.type === 'k' ? 1 : 0;
    const bKing = b.piece.type === 'k' ? 1 : 0;
    if (aKing !== bKing) return aKing - bKing;

    return 0;
  });

  return moves;
}

/**
 * Update castling rights based on a move.
 */
function updateCastlingRights(
  rights: CastlingRights | undefined,
  move: Move,
  board: Board
): CastlingRights | undefined {
  if (!rights) return undefined;

  const newRights: CastlingRights = { ...rights };
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

/**
 * Apply a move and return a new board (without mutating the original).
 */
function applyMove(board: Board, move: Move): Board {
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

  // Handle en passant
  if (move.isEnPassant && piece && piece.type === 'p') {
    const capturedPawnRow = move.from.row;
    newBoard[capturedPawnRow][move.to.col] = null;
  }

  // Handle pawn promotion (always to queen for simplicity)
  if (piece && piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 7 : 0;

    if (move.to.row === promotionRow) {
      newBoard[move.to.row][move.to.col] = { type: 'q', color: piece.color };
    }
  }

  return newBoard;
}

/**
 * Check if the opponent can force a draw by repetition on their next move.
 * This checks if any opponent move would create a threefold repetition.
 */
function opponentCanForceRepetition(
  board: Board,
  opponentColor: PieceColor,
  history: string[],
  currentCastlingRights: CastlingRights | undefined
): boolean {
  const opponentMoves = getValidMovesForColor(board, opponentColor, currentCastlingRights);

  for (const move of opponentMoves) {
    const newBoard = applyMove(board, move);
    const newRights = updateCastlingRights(currentCastlingRights, move, board);
    const nextColor: PieceColor = opponentColor === 'white' ? 'black' : 'white';
    const newHash = hashPosition(newBoard, nextColor, newRights);

    if (isThirdRepetition(newHash, history)) {
      return true;
    }
  }

  return false;
}
