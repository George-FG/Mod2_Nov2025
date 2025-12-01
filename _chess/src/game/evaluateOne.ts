import type { Board, PieceColor, Position } from './types';
import { getValidMoves, wouldMoveResultInCheck } from './moveValidation';

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Positional bonus for pawns (encourages central and advanced pawns)
const pawnPositionBonus = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

// Knight position bonus (central squares are better)
const knightPositionBonus = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

// King safety bonus (early game - stay in corner, end game - move to center)
const kingEarlyGameBonus = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20]
];

export function evaluateOne(board: Board, color: PieceColor): number {
  let score = 0;

  // Material evaluation
  score += evaluateMaterial(board, color);

  // Mobility (number of legal moves)
  score += evaluateMobility(board, color) * 10;

  // Pawn structure
  score += evaluatePawnStructure(board, color);

  // Center control
  score += evaluateCenterControl(board, color) * 15;

  // King safety
  score += evaluateKingSafety(board, color);

  return score;
}

function evaluateMaterial(board: Board, color: PieceColor): number {
  let score = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece) {
        let value = pieceValues[piece.type];

        // Add positional bonuses
        if (piece.type === 'p') {
          const bonusRow = piece.color === 'white' ? row : 7 - row;

          value += pawnPositionBonus[bonusRow][col];
        } else if (piece.type === 'n') {
          value += knightPositionBonus[row][col];
        } else if (piece.type === 'k') {
          // Use early game king position (assuming early/mid game)
          value += kingEarlyGameBonus[row][col];
        }

        score += piece.color === color ? value : -value;
      }
    }
  }

  return score;
}

function evaluateMobility(board: Board, color: PieceColor): number {
  let myMoves = 0;
  let opponentMoves = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece) {
        const from: Position = { row, col };
        const moves = getValidMoves(board, from, piece);
        const legalMoves = moves.filter(
          (to) => !wouldMoveResultInCheck(board, from, to, piece.color)
        );

        if (piece.color === color) {
          myMoves += legalMoves.length;
        } else {
          opponentMoves += legalMoves.length;
        }
      }
    }
  }

  return myMoves - opponentMoves;
}

function evaluatePawnStructure(board: Board, color: PieceColor): number {
  let score = 0;
  const myPawns: Position[] = [];
  const opponentPawns: Position[] = [];

  // Collect pawn positions
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.type === 'p') {
        if (piece.color === color) {
          myPawns.push({ row, col });
        } else {
          opponentPawns.push({ row, col });
        }
      }
    }
  }

  // Penalize doubled pawns (pawns on same file)
  const myPawnFiles = new Map<number, number>();
  const opponentPawnFiles = new Map<number, number>();

  myPawns.forEach(p => {
    myPawnFiles.set(p.col, (myPawnFiles.get(p.col) || 0) + 1);
  });
  opponentPawns.forEach(p => {
    opponentPawnFiles.set(p.col, (opponentPawnFiles.get(p.col) || 0) + 1);
  });

  myPawnFiles.forEach(count => {
    if (count > 1) score -= (count - 1) * 10;
  });
  opponentPawnFiles.forEach(count => {
    if (count > 1) score += (count - 1) * 10;
  });

  // Reward passed pawns (no opponent pawns in front or adjacent files)
  myPawns.forEach(p => {
    const isPassedPawn = !opponentPawns.some(op => {
      const adjacentFile = Math.abs(op.col - p.col) <= 1;
      const inFront = color === 'white' ? op.row > p.row : op.row < p.row;

      return adjacentFile && inFront;
    });

    if (isPassedPawn) {
      const advancement = color === 'white' ? p.row : 7 - p.row;

      score += advancement * 5;
    }
  });

  return score;
}

function evaluateCenterControl(board: Board, color: PieceColor): number {
  let score = 0;
  const centerSquares = [
    { row: 3, col: 3 }, { row: 3, col: 4 },
    { row: 4, col: 3 }, { row: 4, col: 4 }
  ];

  centerSquares.forEach(pos => {
    const piece = board[pos.row][pos.col];

    if (piece) {
      score += piece.color === color ? 1 : -1;
    }

    // Check if square is attacked
    const attackedByMe = isSquareAttackedBy(board, pos, color);
    const attackedByOpponent = isSquareAttackedBy(board, pos, color === 'white' ? 'black' : 'white');
    
    if (attackedByMe) score += 1;
    if (attackedByOpponent) score -= 1;
  });

  return score;
}

function evaluateKingSafety(board: Board, color: PieceColor): number {
  let score = 0;

  // Find kings
  let myKingPos: Position | null = null;
  let opponentKingPos: Position | null = null;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.type === 'k') {
        if (piece.color === color) {
          myKingPos = { row, col };
        } else {
          opponentKingPos = { row, col };
        }
      }
    }
  }

  if (myKingPos) {
    // Penalize exposed king (count attacking enemy pieces)
    const attackers = countAttackers(board, myKingPos, color === 'white' ? 'black' : 'white');

    score -= attackers * 20;

    // Reward pawn shield
    const pawnShield = countPawnShield(board, myKingPos, color);

    score += pawnShield * 10;
  }

  if (opponentKingPos) {
    const attackers = countAttackers(board, opponentKingPos, color);

    score += attackers * 20;

    const pawnShield = countPawnShield(board, opponentKingPos, color === 'white' ? 'black' : 'white');

    score -= pawnShield * 10;
  }

  return score;
}

function isSquareAttackedBy(board: Board, pos: Position, color: PieceColor): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.color === color) {
        const from: Position = { row, col };
        const moves = getValidMoves(board, from, piece);

        if (moves.some(m => m.row === pos.row && m.col === pos.col)) {
          return true;
        }
      }
    }
  }

  return false;
}

function countAttackers(board: Board, pos: Position, attackerColor: PieceColor): number {
  let count = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.color === attackerColor) {
        const from: Position = { row, col };
        const moves = getValidMoves(board, from, piece);

        if (moves.some(m => m.row === pos.row && m.col === pos.col)) {
          count++;
        }
      }
    }
  }

  return count;
}

function countPawnShield(board: Board, kingPos: Position, color: PieceColor): number {
  let count = 0;
  const direction = color === 'white' ? 1 : -1;

  // Check three squares in front of king
  for (let colOffset = -1; colOffset <= 1; colOffset++) {
    const col = kingPos.col + colOffset;
    const row = kingPos.row + direction;
    
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];

      if (piece && piece.type === 'p' && piece.color === color) {
        count++;
      }
    }
  }

  return count;
}
