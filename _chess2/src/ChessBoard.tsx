import React, { useState, useEffect } from "react";
import "./ChessBoard.css";
import ChessPiece from "./ChessPiece";
import { useChessGame, type GameOptions } from "./game/useChessGame";

const BOARD_SIZE = 8;

interface ChessBoardProps {
  gameOptions: GameOptions;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ gameOptions }) => {
  const { 
    gameState, 
    selectSquare, 
    isSquareSelected, 
    isValidMove, 
    whiteTime, 
    blackTime,
    goToFirstMove,
    goToPreviousMove,
    goToNextMove,
    goToLastMove,
    isViewingHistory,
    canGoBack,
    canGoForward,
  } = useChessGame(gameOptions);
  const [autoFlip, setAutoFlip] = useState(false);
  const [manualFlip, setManualFlip] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousMove();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPreviousMove, goToNextMove]);

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
      <div className="controls-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoFlip}
            onChange={(e) => setAutoFlip(e.target.checked)}
          />
          <span>Auto-Flip Board</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={manualFlip}
            onChange={(e) => setManualFlip(e.target.checked)}
          />
          <span>Flip Board</span>
        </label>
      </div>
      <div className="scores-row">
        <div className="player-info">
          <div className="score-display white">
            White: {gameState.whiteScore}
          </div>
          {gameOptions.clockEnabled && (
            <div className={`clock-display ${gameState.currentPlayer === 'white' ? 'active' : 'inactive'}`}>
              {formatTime(whiteTime)}
            </div>
          )}
        </div>
        <div className="player-info">
          <div className="score-display black">
            Black: {gameState.blackScore}
          </div>
          {gameOptions.clockEnabled && (
            <div className={`clock-display ${gameState.currentPlayer === 'black' ? 'active' : 'inactive'}`}>
              {formatTime(blackTime)}
            </div>
          )}
        </div>
      </div>
      {gameState.isCheck && !gameOver && (
        <div className="check-notification">
          Check! {gameState.currentPlayer === 'white' ? 'White' : 'Black'} King is in danger
        </div>
      )}
      {gameOver && (
        <div className="gameover-notification">
          {gameOverMessage}
        </div>
      )}
      <div className="chessboard">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
          // Determine if board should be flipped
          const shouldFlip = manualFlip !== (autoFlip && gameState.currentPlayer === 'white');
          
          const displayRow = !shouldFlip ? (BOARD_SIZE - 1 - Math.floor(i / BOARD_SIZE)) : Math.floor(i / BOARD_SIZE);
          const displayCol = !shouldFlip ? (BOARD_SIZE - 1 - (i % BOARD_SIZE)) : i % BOARD_SIZE;
          
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

          // Prevent moves if game is over or viewing history
          const allowClick = isHumanTurn && !gameOver && !isViewingHistory;

          return (
            <div
              key={i}
              className={`square ${isDark ? "dark" : "light"} ${selected ? "selected" : ""} ${validMove ? "valid-move" : ""} ${isLastMoved ? "last-move" : ""} ${allowClick ? "clickable" : "not-clickable"}`}
              onClick={() => allowClick && selectSquare(position)}
            >
              {piece && <ChessPiece type={piece.type} color={piece.color} />}
            </div>
          );
        })}
      </div>
      <div className="navigation-controls">
        <button 
          className="nav-button" 
          onClick={goToFirstMove} 
          disabled={!canGoBack}
          title="Go to first move"
        >
          ⏮
        </button>
        <button 
          className="nav-button" 
          onClick={goToPreviousMove} 
          disabled={!canGoBack}
          title="Previous move"
        >
          ◄
        </button>
        <button 
          className="nav-button" 
          onClick={goToNextMove} 
          disabled={!canGoForward}
          title="Next move"
        >
          ►
        </button>
        <button 
          className="nav-button" 
          onClick={goToLastMove} 
          disabled={!isViewingHistory}
          title="Go to latest move"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};

export default ChessBoard;
