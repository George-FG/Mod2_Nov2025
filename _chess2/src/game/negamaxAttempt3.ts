import type { Board, PieceColor, Move, Position, CastlingRights, PieceType } from './types';
import { getValidMoves, wouldMoveResultInCheck, isKingInCheck, getCastlingMoves } from './moveValidation';

// ==================== PIECE VALUES (for MVV-LVA) ====================

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ==================== TRANSPOSITION TABLE ====================

type TTEntry = {
  depth: number;
  score: number;
  flag: 'exact' | 'alpha' | 'beta';
  bestMove?: Move;
  age: number;
};

const MAX_TT_SIZE = 1_000_000;
const transpositionTable = new Map<string, TTEntry>();
let currentAge = 0;

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

function storeTT(
  hash: string,
  depth: number,
  score: number,
  flag: TTEntry['flag'],
  bestMove?: Move
): void {
  if (transpositionTable.size >= MAX_TT_SIZE) {
    const toRemove: string[] = [];
    for (const [key, entry] of transpositionTable) {
      if (entry.age < currentAge - 2) {
        toRemove.push(key);
      }
      if (toRemove.length > MAX_TT_SIZE / 10) break;
    }
    toRemove.forEach(key => transpositionTable.delete(key));
  }

  transpositionTable.set(hash, {
    depth,
    score,
    flag,
    bestMove,
    age: currentAge,
  });
}

// ==================== REPETITION DETECTION ====================

function isThirdRepetition(key: string, history: string[]): boolean {
  let count = 0;
  for (const h of history) {
    if (h === key) {
      count++;
      if (count >= 2) {
        // two previous occurrences; this would be the 3rd
        return true;
      }
    }
  }
  return false;
}

// ==================== KILLER MOVES & HISTORY HEURISTIC ====================

const killerMoves: Move[][] = Array.from({ length: 100 }, () => []);
const historyTable: number[][][][] = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array(8).fill(0))
  )
);

function clearKillers(): void {
  for (let i = 0; i < killerMoves.length; i++) {
    killerMoves[i] = [];
  }
}

function storeKiller(move: Move, ply: number): void {
  if (ply >= killerMoves.length) return;
  if (move.captured) return; // only store quiet moves as killers

  const killers = killerMoves[ply];

  if (killers.some(k =>
    k.from.row === move.from.row &&
    k.from.col === move.from.col &&
    k.to.row === move.to.row &&
    k.to.col === move.to.col
  )) {
    return;
  }

  killers.unshift(move);
  if (killers.length > 2) killers.pop();
}

function updateHistory(move: Move, depth: number): void {
  const bonus = depth * depth;
  historyTable[move.from.row][move.from.col][move.to.row][move.to.col] += bonus;
}

// ==================== MOVE ORDERING ====================

function scoreMove(move: Move, ply: number, ttBestMove?: Move): number {
  // TT best move
  if (ttBestMove &&
      ttBestMove.from.row === move.from.row &&
      ttBestMove.from.col === move.from.col &&
      ttBestMove.to.row === move.to.row &&
      ttBestMove.to.col === move.to.col) {
    return 1_000_000;
  }

  // Captures (MVV-LVA)
  if (move.captured) {
    const victimValue = PIECE_VALUES[move.captured.type];
    const attackerValue = PIECE_VALUES[move.piece.type];
    return 100_000 + (victimValue * 10 - attackerValue);
  }

  // Promotions
  if (move.promotion) {
    return 90_000 + PIECE_VALUES[move.promotion];
  }

  // Killer moves
  if (ply < killerMoves.length) {
    const killers = killerMoves[ply];
    const idx = killers.findIndex(k =>
      k.from.row === move.from.row &&
      k.from.col === move.from.col &&
      k.to.row === move.to.row &&
      k.to.col === move.to.col
    );
    if (idx === 0) return 80_000;
    if (idx === 1) return 70_000;
  }

  // History heuristic
  return historyTable[move.from.row][move.from.col][move.to.row][move.to.col];
}

function orderMoves(moves: Move[], ply: number, ttBestMove?: Move): void {
  moves.sort((a, b) => scoreMove(b, ply, ttBestMove) - scoreMove(a, ply, ttBestMove));
}

// ==================== MAIN SEARCH ENGINE ====================

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
  const rootColor = color;

  currentAge++;
  clearKillers();

  let bestMoveAtRoot: Move | null = null;
  let timeExpired = false;

  // History of positions so far (from caller), plus current
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

  // ---------- Quiescence search (captures only) ----------

  function quiescence(
    board: Board,
    sideToMove: PieceColor,
    alpha: number,
    beta: number,
    currentCastlingRights?: CastlingRights
  ): number {
    if (isTimeExpired()) return 0;

    // Always evaluate from rootColor perspective and flip sign by sideToMove
    const sign = sideToMove === rootColor ? 1 : -1;
    const standPatRoot = evaluate(board, rootColor);
    const standPat = sign * standPatRoot;

    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const moves = getValidMovesForColor(board, sideToMove, currentCastlingRights);
    const captures = moves.filter(m => m.captured);

    captures.sort((a, b) => {
      const aScore = PIECE_VALUES[a.captured!.type] * 10 - PIECE_VALUES[a.piece.type];
      const bScore = PIECE_VALUES[b.captured!.type] * 10 - PIECE_VALUES[b.piece.type];
      return bScore - aScore;
    });

    const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';

    for (const move of captures) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(currentCastlingRights, move, board);

      const score = -quiescence(newBoard, nextColor, -beta, -alpha, newRights);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  // ---------- Negamax with alpha-beta, null-move, LMR, TT, repetition ----------

  function negamax(
    board: Board,
    sideToMove: PieceColor,
    depth: number,
    alpha: number,
    beta: number,
    currentCastlingRights: CastlingRights | undefined,
    ply: number,
    allowNull: boolean,
    history: string[]
  ): number {
    if (isTimeExpired()) return 0;

    const hash = hashPosition(board, sideToMove, currentCastlingRights);
    const alphaOrig = alpha;
    const ttEntry = transpositionTable.get(hash);

    const mateValue = 100_000;

    // Mate distance pruning
    alpha = Math.max(alpha, -mateValue + ply);
    beta = Math.min(beta, mateValue - ply - 1);
    if (alpha >= beta) return alpha;

    // TT lookup
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 'exact') return ttEntry.score;
      if (ttEntry.flag === 'alpha' && ttEntry.score <= alpha) return ttEntry.score;
      if (ttEntry.flag === 'beta' && ttEntry.score >= beta) return ttEntry.score;
    }

    // Leaf: quiescence
    if (depth <= 0) {
      return quiescence(board, sideToMove, alpha, beta, currentCastlingRights);
    }

    const moves = getValidMovesForColor(board, sideToMove, currentCastlingRights);

    if (moves.length === 0) {
      const inCheck = isKingInCheck(board, sideToMove);
      return inCheck ? -mateValue + ply : 0;
    }

    const inCheck = isKingInCheck(board, sideToMove);

    // Null-move pruning
    if (allowNull && !inCheck && depth >= 3) {
      const R = 2;
      const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';

      const nullScore = -negamax(
        board,
        nextColor,
        depth - 1 - R,
        -beta,
        -beta + 1,
        currentCastlingRights,
        ply + 1,
        false,
        history
      );

      if (nullScore >= beta) {
        return beta;
      }
    }

    orderMoves(moves, ply, ttEntry?.bestMove);

    let bestScore = -Infinity;
    let bestMoveLocal: Move | undefined;
    const nextColor: PieceColor = sideToMove === 'white' ? 'black' : 'white';
    let movesSearched = 0;

    for (const move of moves) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(currentCastlingRights, move, board);
      const newHash = hashPosition(newBoard, nextColor, newRights);

      let score: number;

      if (isThirdRepetition(newHash, history)) {
        // UPDATED repetition handling:
        // - evaluate from root perspective, transform to sideToMove
        const evalFromRoot = evaluate(newBoard, rootColor);
        const sign = sideToMove === rootColor ? 1 : -1;
        const evalFromSide = sign * evalFromRoot;

        // Soft bias:
        // clearly winning (> +2 pawns) -> repetition mildly bad
        // clearly losing  (< -2 pawns) -> repetition mildly good
        if (evalFromSide > 200)      score = -150;
        else if (evalFromSide < -200) score = 150;
        else score = 0;
      } else {
        const newHistory = [...history, newHash];

        // Late Move Reduction: reduce depth for later quiet moves
        const isLateMove =
          movesSearched >= 4 &&
          depth >= 3 &&
          !inCheck &&
          !move.captured &&
          !move.promotion;
        const reduction = isLateMove ? 1 : 0;

        if (movesSearched === 0) {
          // First move: full search with full window
          score = -negamax(
            newBoard,
            nextColor,
            depth - 1,
            -beta,
            -alpha,
            newRights,
            ply + 1,
            true,
            newHistory
          );
        } else {
          // Later moves: search with reduced depth if applicable
          score = -negamax(
            newBoard,
            nextColor,
            depth - 1 - reduction,
            -beta,
            -alpha,
            newRights,
            ply + 1,
            true,
            newHistory
          );

          // If LMR was applied and score looks good, re-search at full depth
          if (reduction > 0 && score > alpha) {
            score = -negamax(
              newBoard,
              nextColor,
              depth - 1,
              -beta,
              -alpha,
              newRights,
              ply + 1,
              true,
              newHistory
            );
          }
        }
      }

      movesSearched++;

      if (score > bestScore) {
        bestScore = score;
        bestMoveLocal = move;
      }

      if (bestScore > alpha) {
        alpha = bestScore;
        if (!move.captured) {
          storeKiller(move, ply);
          updateHistory(move, depth);
        }
      }

      if (alpha >= beta) break;
    }

    if (!isTimeExpired()) {
      let flag: TTEntry['flag'] = 'exact';
      if (bestScore <= alphaOrig) flag = 'alpha';
      else if (bestScore >= beta) flag = 'beta';

      storeTT(hash, depth, bestScore, flag, bestMoveLocal);
    }

    return bestScore;
  }

  // ---------- Root search with aspiration windows + repetition ----------

  function searchRoot(depth: number, history: string[]): Move | null {
    if (isTimeExpired()) return bestMoveAtRoot;

    const moves = getValidMovesForColor(board, color, castlingRights);
    if (moves.length === 0) return null;

    const ttRoot = transpositionTable.get(hashPosition(board, color, castlingRights));
    orderMoves(moves, 0, ttRoot?.bestMove);

    let alpha = -Infinity;
    let beta = Infinity;

    if (depth > 3 && bestMoveAtRoot) {
      const previousScore = evaluate(board, rootColor);
      const window = 50;
      alpha = previousScore - window;
      beta = previousScore + window;
    }

    let bestScore = -Infinity;
    const nextColor: PieceColor = color === 'white' ? 'black' : 'white';

    for (const move of moves) {
      if (isTimeExpired()) break;

      const newBoard = applyMove(board, move);
      const newRights = updateCastlingRights(castlingRights, move, board);
      const newHash = hashPosition(newBoard, nextColor, newRights);

      let score: number;

      if (isThirdRepetition(newHash, history)) {
        const evalFromRoot = evaluate(newBoard, rootColor);
        // at root, sideToMove === rootColor, but keep this explicit
        const sign = color === rootColor ? 1 : -1;
        const evalFromSide = sign * evalFromRoot;

        if (evalFromSide > 200)      score = -150;
        else if (evalFromSide < -200) score = 150;
        else score = 0;
      } else {
        const newHistory = [...history, newHash];

        score = -negamax(
          newBoard,
          nextColor,
          depth - 1,
          -beta,
          -alpha,
          newRights,
          1,
          true,
          newHistory
        );

        // aspiration re-search if fail-low / fail-high
        if ((score <= alpha || score >= beta) && depth > 3) {
          score = -negamax(
            newBoard,
            nextColor,
            depth - 1,
            -Infinity,
            Infinity,
            newRights,
            1,
            true,
            newHistory
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

    return bestMoveAtRoot;
  }

  // ---------- Fallback and iterative deepening ----------

  const allMoves = getValidMovesForColor(board, color, castlingRights);
  if (allMoves.length > 0) {
    bestMoveAtRoot = allMoves[0];
  }

  if (depth === 0) {
    depth = 1000; // effectively unlimited
  }
  for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
    if (isTimeExpired()) break;
    console.log(`Searching at depth ${currentDepth}... (time elapsed: ${Date.now() - startTime} ms)`);

    const previousBest = bestMoveAtRoot;
    searchRoot(currentDepth, baseHistory);

    if (isTimeExpired() && currentDepth > 1) {
      bestMoveAtRoot = previousBest;
      break;
    }

    if (bestMoveAtRoot) {
      const hash = hashPosition(board, color, castlingRights);
      const entry = transpositionTable.get(hash);
      if (entry && Math.abs(entry.score) > 99_000) {
        break; // mate found
      }
    }
  }

  return bestMoveAtRoot;
}

// ==================== HELPER FUNCTIONS ====================

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

      const legalMoves = possibleMoves.filter(
        (to) => !wouldMoveResultInCheck(board, from, to, piece.color)
      );

      for (const to of legalMoves) {
        const captured = board[to.row][to.col];
        moves.push({
          from,
          to,
          piece,
          captured: captured || undefined,
        });
      }

      if (piece.type === 'k' && castlingRights) {
        const rights = {
          kingSide: color === 'white' ? castlingRights.whiteKingSide : castlingRights.blackKingSide,
          queenSide: color === 'white' ? castlingRights.whiteQueenSide : castlingRights.blackQueenSide,
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

  return moves;
}

function applyMove(board: Board, move: Move): Board {
  const newBoard: Board = board.map(row => [...row]);
  const piece = newBoard[move.from.row][move.from.col];

  if (!piece) return newBoard;

  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;

  // Castling
  if (move.isCastling && piece.type === 'k') {
    if (move.to.col === 5) {
      // kingside: rook from h-file (7) to e-file (4)
      const rook = newBoard[move.from.row][7];
      newBoard[move.from.row][4] = rook;
      newBoard[move.from.row][7] = null;
    } else if (move.to.col === 1) {
      // queenside: rook from a-file (0) to c-file (2)
      const rook = newBoard[move.from.row][0];
      newBoard[move.from.row][2] = rook;
      newBoard[move.from.row][0] = null;
    }
  }

  // En passant
  if (move.isEnPassant && piece.type === 'p') {
    const captureRow = move.from.row;
    newBoard[captureRow][move.to.col] = null;
  }

  // Promotion
  if (piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 7 : 0;
    if (move.to.row === promotionRow) {
      newBoard[move.to.row][move.to.col] = { type: 'q', color: piece.color };
    }
  }

  return newBoard;
}

function updateCastlingRights(
  rights: CastlingRights | undefined,
  move: Move,
  board: Board
): CastlingRights | undefined {
  if (!rights) return undefined;

  const newRights: CastlingRights = { ...rights };
  const piece = board[move.from.row][move.from.col];

  if (!piece) return newRights;

  if (piece.type === 'k') {
    if (piece.color === 'white') {
      newRights.whiteKingSide = false;
      newRights.whiteQueenSide = false;
    } else {
      newRights.blackKingSide = false;
      newRights.blackQueenSide = false;
    }
  }

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
