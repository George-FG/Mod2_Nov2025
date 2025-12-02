export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  isCastling?: boolean;
  isEnPassant?: boolean;
}

export type Board = (Piece | null)[][];

export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

export interface GameState {
  board: Board;
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  validMoves: Position[];
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  castlingRights: CastlingRights;
  lastMoveTime?: number;
  whiteScore: number;
  blackScore: number;
}
