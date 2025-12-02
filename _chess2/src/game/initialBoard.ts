import type { Board, Piece } from './types';

export const createInitialBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));

  // White pieces (row 0 and 1)
  const backRow: Piece[] = [
    { type: 'r', color: 'white' },
    { type: 'n', color: 'white' },
    { type: 'b', color: 'white' },
    { type: 'k', color: 'white' },
    { type: 'q', color: 'white' },
    { type: 'b', color: 'white' },
    { type: 'n', color: 'white' },
    { type: 'r', color: 'white' },
  ];

  backRow.forEach((piece, col) => {
    board[0][col] = piece;
  });

  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'p', color: 'white' };
  }

  // Black pieces (row 6 and 7)
  const blackBackRow: Piece[] = [
    { type: 'r', color: 'black' },
    { type: 'n', color: 'black' },
    { type: 'b', color: 'black' },
    { type: 'k', color: 'black' },
    { type: 'q', color: 'black' },
    { type: 'b', color: 'black' },
    { type: 'n', color: 'black' },
    { type: 'r', color: 'black' },
  ];

  blackBackRow.forEach((piece, col) => {
    board[7][col] = piece;
  });

  for (let col = 0; col < 8; col++) {
    board[6][col] = { type: 'p', color: 'black' };
  }

  return board;
};
