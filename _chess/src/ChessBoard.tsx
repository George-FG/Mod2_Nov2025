import React, { useState } from "react";
import "./ChessBoard.css";
import ChessPiece from "./ChessPiece";
import { useChessGame, type GameOptions } from "./game/useChessGame";

const BOARD_SIZE = 8;

interface ChessBoardProps {
  gameOptions: GameOptions;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ gameOptions }) => {
  const { gameState, selectSquare, isSquareSelected, isValidMove, whiteTime, blackTime } = useChessGame(gameOptions);
  const [autoFlip, setAutoFlip] = useState(true);
  const [manualFlip, setManualFlip] = useState(false);

  // Determine game over state and message
  let gameOver = false;
  let gameOverMessage = '';

  if (gameState.isCheckmate) {
    gameOver = true;
    gameOverMessage = `${gameState.currentPlayer === 'white' ? 'Black' : 'White'} wins by checkmate!`;
  } else if (gameState.isStalemate) {
    gameOver = true;
    gameOverMessage = 'Draw by stalemate or threefold repetition!';
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
  };

  return (
    <div className="chessboard-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={autoFlip}
            onChange={(e) => setAutoFlip(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>Auto-Flip Board</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={manualFlip}
            onChange={(e) => setManualFlip(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>Flip Board</span>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '550px', marginBottom: '0.75rem', gap: '2rem' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f0d9b5', backgroundColor: '#444', padding: '0.4rem 0.8rem', borderRadius: '6px', marginBottom: '0.4rem', border: '2px solid #b58863' }}>
            White: {gameState.whiteScore}
          </div>
          {gameOptions.clockEnabled && (
            <div style={{ padding: '0.5rem 1rem', background: gameState.currentPlayer === 'white' ? '#667eea' : '#e0e0e0', color: gameState.currentPlayer === 'white' ? 'white' : '#555', borderRadius: '8px', fontSize: '1.4rem', fontWeight: 'bold' }}>
              {formatTime(whiteTime)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f0d9b5', backgroundColor: '#222', padding: '0.4rem 0.8rem', borderRadius: '6px', marginBottom: '0.4rem', border: '2px solid #555' }}>
            Black: {gameState.blackScore}
          </div>
          {gameOptions.clockEnabled && (
            <div style={{ padding: '0.5rem 1rem', background: gameState.currentPlayer === 'black' ? '#667eea' : '#e0e0e0', color: gameState.currentPlayer === 'black' ? 'white' : '#555', borderRadius: '8px', fontSize: '1.4rem', fontWeight: 'bold' }}>
              {formatTime(blackTime)}
            </div>
          )}
        </div>
      </div>
      {gameState.isCheck && !gameOver && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontWeight: 'bold',
          zIndex: 1000,
        }}>
          Check! {gameState.currentPlayer === 'white' ? 'White' : 'Black'} King is in danger
        </div>
      )}
      {gameOver && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#222',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '6px',
          fontWeight: 'bold',
          fontSize: '1.2rem',
          zIndex: 1100,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {gameOverMessage}
        </div>
      )}
      <div className="chessboard">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
          // Determine if board should be flipped
          const shouldFlip = manualFlip !== (autoFlip && gameState.currentPlayer === 'white');
          
          const displayRow = shouldFlip ? (BOARD_SIZE - 1 - Math.floor(i / BOARD_SIZE)) : Math.floor(i / BOARD_SIZE);
          const displayCol = shouldFlip ? (BOARD_SIZE - 1 - (i % BOARD_SIZE)) : i % BOARD_SIZE;
          
          const row = displayRow;
          const col = displayCol;
          const isDark = (row + col) % 2 === 1;
          const piece = gameState.board[row][col];
          const position = { row, col };
          const selected = isSquareSelected(position);
          const validMove = isValidMove(position);

          // Highlight last moved piece
          let isLastMoved = false;

          if (gameState.moveHistory && gameState.moveHistory.length > 0) {
            const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];

            if (lastMove.to.row === row && lastMove.to.col === col) {
              isLastMoved = true;
            }
          }

          const currentPlayerType = gameState.currentPlayer === 'white' ? gameOptions.whitePlayer : gameOptions.blackPlayer;
          const isHumanTurn = currentPlayerType === 'human';

          // Prevent moves if game is over
          const allowClick = isHumanTurn && !gameOver;

          return (
            <div
              key={i}
              className={`square ${isDark ? "dark" : "light"} ${selected ? "selected" : ""} ${validMove ? "valid-move" : ""} ${isLastMoved ? "last-move" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                cursor: allowClick ? "pointer" : "default",
              }}
              onClick={() => allowClick && selectSquare(position)}
            >
              {piece && <ChessPiece type={piece.type} color={piece.color} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChessBoard;
