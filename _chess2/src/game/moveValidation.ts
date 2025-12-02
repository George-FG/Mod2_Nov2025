import type { Board, Piece, Position, PieceColor } from './types';

export const isValidPosition = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
};

export const getValidMoves = (
  board: Board,
  from: Position,
  piece: Piece
): Position[] => {
  const moves: Position[] = [];

  switch (piece.type) {
    case 'p':
      moves.push(...getPawnMoves(board, from, piece.color));
      break;
    case 'n':
      moves.push(...getKnightMoves(board, from, piece.color));
      break;
    case 'b':
      moves.push(...getBishopMoves(board, from, piece.color));
      break;
    case 'r':
      moves.push(...getRookMoves(board, from, piece.color));
      break;
    case 'q':
      moves.push(...getQueenMoves(board, from, piece.color));
      break;
    case 'k':
      moves.push(...getKingMoves(board, from, piece.color));
      break;
  }

  return moves;
};

const getPawnMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  const moves: Position[] = [];
  const direction = color === 'white' ? 1 : -1;
  const startRow = color === 'white' ? 1 : 6;

  // Move forward one square
  const oneForward = { row: from.row + direction, col: from.col };

  if (isValidPosition(oneForward) && !board[oneForward.row][oneForward.col]) {
    moves.push(oneForward);

    // Move forward two squares from starting position
    if (from.row === startRow) {
      const twoForward = { row: from.row + 2 * direction, col: from.col };

      if (isValidPosition(twoForward) && !board[twoForward.row][twoForward.col]) {
        moves.push(twoForward);
      }
    }
  }

  // Capture diagonally
  const captureLeft = { row: from.row + direction, col: from.col - 1 };
  const captureRight = { row: from.row + direction, col: from.col + 1 };

  [captureLeft, captureRight].forEach(pos => {
    if (isValidPosition(pos)) {
      const target = board[pos.row][pos.col];

      if (target && target.color !== color) {
        moves.push(pos);
      }
    }
  });

  return moves;
};

const getKnightMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  offsets.forEach(([rowOffset, colOffset]) => {
    const pos = { row: from.row + rowOffset, col: from.col + colOffset };

    if (isValidPosition(pos)) {
      const target = board[pos.row][pos.col];

      if (!target || target.color !== color) {
        moves.push(pos);
      }
    }
  });

  return moves;
};

const getLinearMoves = (
  board: Board,
  from: Position,
  color: PieceColor,
  directions: number[][]
): Position[] => {
  const moves: Position[] = [];

  directions.forEach(([rowDir, colDir]) => {
    let row = from.row + rowDir;
    let col = from.col + colDir;

    while (isValidPosition({ row, col })) {
      const target = board[row][col];

      if (!target) {
        moves.push({ row, col });
      } else {
        if (target.color !== color) {
          moves.push({ row, col });
        }
        break;
      }
      row += rowDir;
      col += colDir;
    }
  });

  return moves;
};

const getBishopMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  return getLinearMoves(board, from, color, [
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ]);
};

const getRookMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  return getLinearMoves(board, from, color, [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ]);
};

const getQueenMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  return getLinearMoves(board, from, color, [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ]);
};

const getKingMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  offsets.forEach(([rowOffset, colOffset]) => {
    const pos = { row: from.row + rowOffset, col: from.col + colOffset };

    if (isValidPosition(pos)) {
      const target = board[pos.row][pos.col];

      if (!target || target.color !== color) {
        moves.push(pos);
      }
    }
  });

  return moves;
};

export const getCastlingMoves = (
  board: Board,
  from: Position,
  color: PieceColor,
  castlingRights: { kingSide: boolean; queenSide: boolean },
  isInCheck: boolean
): Position[] => {
  const moves: Position[] = [];
  const row = color === 'white' ? 0 : 7;
  const enemyColor: PieceColor = color === 'white' ? 'black' : 'white';

  // King must be on starting position
  if (from.row !== row || from.col !== 3) return moves;

  // Cannot castle out of check
  if (isInCheck) return moves;

  // King-side castling
  if (castlingRights.kingSide) {
    const rook = board[row][7];
    const squaresBetween = [4, 5];
    const allClear = squaresBetween.every(col => !board[row][col]);
    const notUnderAttack = squaresBetween.every(
      col => !isPositionUnderAttack(board, { row, col }, enemyColor)
    );

    if (rook && rook.type === 'r' && rook.color === color && allClear && notUnderAttack) {
      moves.push({ row, col: 5 });
    }
  }

  // Queen-side castling
  if (castlingRights.queenSide) {
    const rook = board[row][0];
    const squaresBetween = [1, 2];
    const squaresNotUnderAttack = [1, 2];
    const allClear = squaresBetween.every(col => !board[row][col]);
    const notUnderAttack = squaresNotUnderAttack.every(
      col => !isPositionUnderAttack(board, { row, col }, enemyColor)
    );

    if (rook && rook.type === 'r' && rook.color === color && allClear && notUnderAttack) {
      moves.push({ row, col: 1 });
    }
  }

  return moves;
};

export const isPositionEqual = (a: Position, b: Position): boolean => {
  return a.row === b.row && a.col === b.col;
};

export const findKing = (board: Board, color: PieceColor): Position | null => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.type === 'k' && piece.color === color) {
        return { row, col };
      }
    }
  }

  return null;
};

export const isPositionUnderAttack = (
  board: Board,
  position: Position,
  byColor: PieceColor
): boolean => {
  // Check all squares for enemy pieces that can attack this position
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (piece && piece.color === byColor) {
        const moves = getValidMoves(board, { row, col }, piece);

        if (moves.some(move => isPositionEqual(move, position))) {
          return true;
        }
      }
    }
  }

  return false;
};

export const isKingInCheck = (board: Board, kingColor: PieceColor): boolean => {
  const kingPos = findKing(board, kingColor);

  if (!kingPos) return false;
  
  const enemyColor: PieceColor = kingColor === 'white' ? 'black' : 'white';

  return isPositionUnderAttack(board, kingPos, enemyColor);
};

export const wouldMoveResultInCheck = (
  board: Board,
  from: Position,
  to: Position,
  playerColor: PieceColor
): boolean => {
  // Create a temporary board with the move applied
  const tempBoard: Board = board.map(row => [...row]);
  const piece = tempBoard[from.row][from.col];
  
  tempBoard[to.row][to.col] = piece;
  tempBoard[from.row][from.col] = null;
  
  return isKingInCheck(tempBoard, playerColor);
};
