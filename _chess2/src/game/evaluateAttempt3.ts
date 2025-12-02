import type { Board, PieceColor, Position, Piece } from './types';
import { getValidMoves } from './moveValidation';

// ==================== PIECE VALUES ====================
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ==================== PIECE-SQUARE TABLES ====================
// These tables encode positional bonuses/penalties for each piece type
// Values are from white's perspective (flip for black)

const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLEGAME_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

const KING_ENDGAME_TABLE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
];

// ==================== HELPER FUNCTIONS ====================

function getPieceSquareValue(
  piece: Piece,
  row: number,
  col: number,
  isEndgame: boolean
): number {
  const isWhite = piece.color === 'white';
  // Flip the row for black pieces
  const tableRow = isWhite ? row : 7 - row;
  const index = tableRow * 8 + col;

  switch (piece.type) {
    case 'p':
      return PAWN_TABLE[index];
    case 'n':
      return KNIGHT_TABLE[index];
    case 'b':
      return BISHOP_TABLE[index];
    case 'r':
      return ROOK_TABLE[index];
    case 'q':
      return QUEEN_TABLE[index];
    case 'k':
      return isEndgame ? KING_ENDGAME_TABLE[index] : KING_MIDDLEGAME_TABLE[index];
    default:
      return 0;
  }
}

function isEndgamePhase(board: Board): boolean {
  let queens = 0;
  let minorPieces = 0;
  let rooks = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      if (piece.type === 'q') queens++;
      if (piece.type === 'n' || piece.type === 'b') minorPieces++;
      if (piece.type === 'r') rooks++;
    }
  }

  // Endgame if: no queens, or one queen and few pieces
  return queens === 0 || (queens <= 1 && minorPieces + rooks <= 4);
}

// ==================== EVALUATION FEATURES ====================

/**
 * Evaluate mobility (number of legal moves)
 */
function evaluateMobility(board: Board, color: PieceColor): number {
  let mobility = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;

      const from: Position = { row, col };
      const moves = getValidMoves(board, from, piece);
      mobility += moves.length;
    }
  }

  return mobility * 2; // Weight each move as 2 centipawns
}

/**
 * Detect passed pawns (pawns with no enemy pawns blocking them)
 */
function evaluatePassedPawns(board: Board, color: PieceColor): number {
  let score = 0;
  const isWhite = color === 'white';
  const direction = isWhite ? 1 : -1;
  //const startRow = isWhite ? 1 : 6;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.type !== 'p' || piece.color !== color) continue;

      let isPassed = true;

      // Check if there are enemy pawns ahead
      for (let r = row + direction; r >= 0 && r < 8; r += direction) {
        // Check same file and adjacent files
        for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
          const enemy = board[r][c];
          if (enemy && enemy.type === 'p' && enemy.color !== color) {
            isPassed = false;
            break;
          }
        }
        if (!isPassed) break;
      }

      if (isPassed) {
        const rank = isWhite ? row : 7 - row;
        // Passed pawns are worth more the further they advance
        score += 20 + (rank * 10);
      }
    }
  }

  return score;
}

/**
 * Evaluate pawn structure (doubled, isolated pawns)
 */
function evaluatePawnStructure(board: Board, color: PieceColor): number {
  let score = 0;
  const pawnFiles: number[] = new Array(8).fill(0);

  // Count pawns per file
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'p' && piece.color === color) {
        pawnFiles[col]++;
      }
    }
  }

  // Penalty for doubled pawns
  for (let col = 0; col < 8; col++) {
    if (pawnFiles[col] > 1) {
      score -= 10 * (pawnFiles[col] - 1);
    }
  }

  // Penalty for isolated pawns (no friendly pawns on adjacent files)
  for (let col = 0; col < 8; col++) {
    if (pawnFiles[col] > 0) {
      const hasLeftNeighbor = col > 0 && pawnFiles[col - 1] > 0;
      const hasRightNeighbor = col < 7 && pawnFiles[col + 1] > 0;

      if (!hasLeftNeighbor && !hasRightNeighbor) {
        score -= 15; // Isolated pawn penalty
      }
    }
  }

  return score;
}

/**
 * Evaluate king safety
 */
function evaluateKingSafety(board: Board, color: PieceColor, isEndgame: boolean): number {
  if (isEndgame) return 0; // King safety less important in endgame

  let score = 0;
  let kingRow = -1;
  let kingCol = -1;

  // Find king
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'k' && piece.color === color) {
        kingRow = row;
        kingCol = col;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return 0;

  const isWhite = color === 'white';
  const homeRank = isWhite ? 0 : 7;
  const pawnShieldRow = isWhite ? kingRow + 1 : kingRow - 1;

  // Bonus for castling (king on f1/f8 or b1/b8)
  // King starts at col 3, castles to col 5 (kingside) or col 1 (queenside)
  if (kingRow === homeRank && (kingCol === 5 || kingCol === 1)) {
    score += 30;
  }

  // Pawn shield
  if (pawnShieldRow >= 0 && pawnShieldRow < 8) {
    for (let c = Math.max(0, kingCol - 1); c <= Math.min(7, kingCol + 1); c++) {
      const piece = board[pawnShieldRow][c];
      if (piece && piece.type === 'p' && piece.color === color) {
        score += 10; // Bonus for each pawn in front of king
      }
    }
  }

  return score;
}

/**
 * Bonus for bishop pair
 */
function evaluateBishopPair(board: Board, color: PieceColor): number {
  let bishops = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'b' && piece.color === color) {
        bishops++;
      }
    }
  }

  return bishops >= 2 ? 30 : 0;
}

// ==================== MAIN EVALUATION ====================

export function evaluate(board: Board, color: PieceColor): number {
  const isEndgame = isEndgamePhase(board);
  
  let whiteScore = 0;
  let blackScore = 0;

  // Material and positional evaluation
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const materialValue = PIECE_VALUES[piece.type];
      const positionalValue = getPieceSquareValue(piece, row, col, isEndgame);
      const totalValue = materialValue + positionalValue;

      if (piece.color === 'white') {
        whiteScore += totalValue;
      } else {
        blackScore += totalValue;
      }
    }
  }

  // Lazy evaluation: if material difference is huge, skip expensive calculations
  const materialDiff = Math.abs(whiteScore - blackScore);
  const lazyThreshold = 500; // 5 pawns

  if (materialDiff > lazyThreshold) {
    const diff = whiteScore - blackScore;
    return color === 'white' ? diff : -diff;
  }

  // Advanced features (only if position is close)
  whiteScore += evaluateMobility(board, 'white');
  blackScore += evaluateMobility(board, 'black');

  whiteScore += evaluatePassedPawns(board, 'white');
  blackScore += evaluatePassedPawns(board, 'black');

  whiteScore += evaluatePawnStructure(board, 'white');
  blackScore += evaluatePawnStructure(board, 'black');

  whiteScore += evaluateKingSafety(board, 'white', isEndgame);
  blackScore += evaluateKingSafety(board, 'black', isEndgame);

  whiteScore += evaluateBishopPair(board, 'white');
  blackScore += evaluateBishopPair(board, 'black');

  const diff = whiteScore - blackScore;
  return color === 'white' ? diff : -diff;
}
