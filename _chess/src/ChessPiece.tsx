import React from "react";

export type PieceColor = "white" | "black";

export interface ChessPieceProps {
  type: string; // 'p','n','b','r','q','k'
  color: PieceColor;
}

const unicodePieces: Record<PieceColor, Record<string, string>> = {
  white: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  },
  black: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  },
};

const ChessPiece: React.FC<ChessPieceProps> = ({ type, color }) => {
  return (
    <span
      className={`piece ${color}-piece`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        fontSize: "7vmin",
        lineHeight: 1,
        textAlign: "center",
        verticalAlign: "middle",
        userSelect: "none",
      }}
    >
      {unicodePieces[color][type]}
    </span>
  );
};

export default ChessPiece;
