import { useState, useCallback, useEffect } from 'react';
import type { GameState, Position, Move, Board, PieceType, PieceColor } from './types';
import { createInitialBoard } from './initialBoard';
import { getValidMoves, isPositionEqual, isKingInCheck, wouldMoveResultInCheck, getCastlingMoves } from './moveValidation';
import { runMinimaxInWorker, type EvaluationType } from './minimaxWorkerLoader';

export type PlayerType = 'human' | 'ai';

export interface AISettings {
  depth: number;
  maxTime: number;
  evaluation: EvaluationType;
}

export interface GameOptions {
  whitePlayer: PlayerType;
  blackPlayer: PlayerType;
  whiteAI?: AISettings;
  blackAI?: AISettings;
  clockEnabled?: boolean;
  initialTime?: number; // in seconds
}

export const useChessGame = (options: GameOptions) => {
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createInitialBoard(),
    currentPlayer: 'white',
    selectedSquare: null,
    validMoves: [],
    moveHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
    lastMoveTime: Date.now(),
    whiteScore: 0,
    blackScore: 0,
  }));

  const [whiteTime, setWhiteTime] = useState((options.initialTime ?? 300) * 1000);
  const [blackTime, setBlackTime] = useState((options.initialTime ?? 300) * 1000);
  const [gameStarted, setGameStarted] = useState(false);

  // Continuous clock countdown
  useEffect(() => {
    if (!options.clockEnabled || !gameStarted) return;

    const interval = setInterval(() => {
      if (gameState.isCheckmate || gameState.isStalemate) return;

      if (gameState.currentPlayer === 'white') {
        setWhiteTime(t => Math.max(0, t - 100));
      } else {
        setBlackTime(t => Math.max(0, t - 100));
      }
    }, 100); // Update every 0.1 seconds

    return () => clearInterval(interval);
  }, [options.clockEnabled, gameStarted, gameState.currentPlayer, gameState.isCheckmate, gameState.isStalemate]);

  // Helper function to check if a player has any legal moves
  const checkForLegalMoves = (board: Board, color: PieceColor): boolean => {
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const piece = board[row][col];

        if (piece && piece.color === color) {
          const from: Position = { row, col };
          const moves = getValidMoves(board, from, piece);
          const legalMoves = moves.filter(
            (to) => !wouldMoveResultInCheck(board, from, to, color)
          );

          if (legalMoves.length > 0) {
            return true;
          }
        }
      }
    }

    return false;
  };

  const makeMove = useCallback((
    state: GameState,
    from: Position,
    to: Position
  ): GameState => {
    const newBoard: Board = state.board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];
    const captured = newBoard[to.row][to.col];

    if (!piece) return state;

    // Check if this is a castling move
    const isCastling = piece.type === 'k' && Math.abs(to.col - from.col) === 2;

    // Move the piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Handle castling: move the rook
    if (isCastling) {
      if (to.col === 6) {
        // King-side castling
        const rook = newBoard[from.row][7];

        newBoard[from.row][5] = rook;
        newBoard[from.row][7] = null;
      } else if (to.col === 2) {
        // Queen-side castling
        const rook = newBoard[from.row][0];

        newBoard[from.row][3] = rook;
        newBoard[from.row][0] = null;
      }
    }

    // Check for pawn promotion
    let promotion: PieceType | undefined;

    if (piece.type === 'p') {
      const promotionRow = piece.color === 'white' ? 7 : 0;

      if (to.row === promotionRow) {
        // Promote to queen
        newBoard[to.row][to.col] = { type: 'q', color: piece.color };
        promotion = 'q';
      }
    }

    const move: Move = {
      from,
      to,
      piece,
      captured: captured || undefined,
      promotion,
      isCastling,
    };

    // Calculate piece values for scoring
    const pieceValues: Record<PieceType, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    // Calculate material on board (starting material - lost material)
    const STARTING_MATERIAL = 39; // 8p + 2n + 2b + 2r + 1q = 8 + 6 + 6 + 10 + 9 = 39
    
    let whiteMaterial = 0;
    let blackMaterial = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = newBoard[row][col];

        if (p) {
          const value = pieceValues[p.type];

          if (p.color === 'white') {
            whiteMaterial += value;
          } else {
            blackMaterial += value;
          }
        }
      }
    }
    
    const newWhiteScore = STARTING_MATERIAL - whiteMaterial;
    const newBlackScore = STARTING_MATERIAL - blackMaterial;

    // Update castling rights
    const newCastlingRights = { ...state.castlingRights };

    // King moved - lose both castling rights
    if (piece.type === 'k') {
      if (piece.color === 'white') {
        newCastlingRights.whiteKingSide = false;
        newCastlingRights.whiteQueenSide = false;
      } else {
        newCastlingRights.blackKingSide = false;
        newCastlingRights.blackQueenSide = false;
      }
    }

    // Rook moved - lose castling right on that side
    if (piece.type === 'r') {
      if (piece.color === 'white') {
        if (from.col === 0) newCastlingRights.whiteQueenSide = false;
        if (from.col === 7) newCastlingRights.whiteKingSide = false;
      } else {
        if (from.col === 0) newCastlingRights.blackQueenSide = false;
        if (from.col === 7) newCastlingRights.blackKingSide = false;
      }
    }

    // Rook captured - lose castling right on that side
    if (captured && captured.type === 'r') {
      if (captured.color === 'white') {
        if (to.col === 0) newCastlingRights.whiteQueenSide = false;
        if (to.col === 7) newCastlingRights.whiteKingSide = false;
      } else {
        if (to.col === 0) newCastlingRights.blackQueenSide = false;
        if (to.col === 7) newCastlingRights.blackKingSide = false;
      }
    }

    const nextPlayer = state.currentPlayer === 'white' ? 'black' : 'white';
    const isCheck = isKingInCheck(newBoard, nextPlayer);

    // Check for checkmate: if next player is in check and has no legal moves
    let isCheckmate = false;

    if (isCheck) {
      const hasLegalMove = checkForLegalMoves(newBoard, nextPlayer);

      isCheckmate = !hasLegalMove;
    }

    // Threefold repetition detection
    const newMoveHistory = [...state.moveHistory, move];
    const boardToString = (board: Board) =>
      board.map(row => row.map(cell => cell ? cell.type + cell.color[0] : '.').join('')).join('/');
    const currentBoardStr = boardToString(newBoard);
    const repetitionCount = newMoveHistory
      .map((_, idx) => boardToString(replayBoard(newMoveHistory.slice(0, idx + 1))))
      .filter(str => str === currentBoardStr).length;

    function replayBoard(moves: Move[]): Board {
      const board = createInitialBoard();

      for (const m of moves) {
        const p = board[m.from.row][m.from.col];

        if (!p) continue;

        board[m.to.row][m.to.col] = m.promotion ? { type: m.promotion, color: p.color } : p;
        board[m.from.row][m.from.col] = null;

        // Handle castling
        if (m.isCastling) {
          if (m.to.col === 6) {
            // King-side
            const rook = board[m.from.row][7];

            board[m.from.row][5] = rook;
            board[m.from.row][7] = null;
          } else if (m.to.col === 2) {
            // Queen-side
            const rook = board[m.from.row][0];

            board[m.from.row][3] = rook;
            board[m.from.row][0] = null;
          }
        }
      }

      return board;
    }

    const isStalemate = repetitionCount >= 3;

    return {
      ...state,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      validMoves: [],
      moveHistory: newMoveHistory,
      isCheck,
      isCheckmate,
      isStalemate,
      castlingRights: newCastlingRights,
      whiteScore: newWhiteScore,
      blackScore: newBlackScore,
    };
  }, []);

  const selectSquare = useCallback((position: Position) => {
    setGameState(prev => {
      const piece = prev.board[position.row][position.col];

      // If there's a selected square and this is a valid move
      if (prev.selectedSquare) {
        const isValidMove = prev.validMoves.some(move =>
          isPositionEqual(move, position)
        );

        if (isValidMove) {
          // Start the game clock on first move
          if (!gameStarted && prev.currentPlayer === 'white') {
            setGameStarted(true);
          }

          // Make the move
          const newState = makeMove(prev, prev.selectedSquare, position);

          return { ...newState, lastMoveTime: Date.now() };
        }        // If clicking on own piece, select it instead
        if (piece && piece.color === prev.currentPlayer) {
          const allMoves = getValidMoves(prev.board, position, piece);

          // Add castling moves for king
          if (piece.type === 'k') {
            const castlingRights = {
              kingSide: piece.color === 'white' ? prev.castlingRights.whiteKingSide : prev.castlingRights.blackKingSide,
              queenSide: piece.color === 'white' ? prev.castlingRights.whiteQueenSide : prev.castlingRights.blackQueenSide,
            };
            const castlingMoves = getCastlingMoves(prev.board, position, piece.color, castlingRights, prev.isCheck);

            allMoves.push(...castlingMoves);
          }

          // Filter out moves that would put own king in check
          const legalMoves = allMoves.filter(move =>
            !wouldMoveResultInCheck(prev.board, position, move, piece.color)
          );

          return {
            ...prev,
            selectedSquare: position,
            validMoves: legalMoves,
          };
        }

        // Otherwise deselect
        return {
          ...prev,
          selectedSquare: null,
          validMoves: [],
        };
      }

      // No square selected - select if it's the current player's piece
      if (piece && piece.color === prev.currentPlayer) {
        const allMoves = getValidMoves(prev.board, position, piece);

        // Add castling moves for king
        if (piece.type === 'k') {
          const castlingRights = {
            kingSide: piece.color === 'white' ? prev.castlingRights.whiteKingSide : prev.castlingRights.blackKingSide,
            queenSide: piece.color === 'white' ? prev.castlingRights.whiteQueenSide : prev.castlingRights.blackQueenSide,
          };
          const castlingMoves = getCastlingMoves(prev.board, position, piece.color, castlingRights, prev.isCheck);

          allMoves.push(...castlingMoves);
        }

        // Filter out moves that would put own king in check
        const legalMoves = allMoves.filter(move =>
          !wouldMoveResultInCheck(prev.board, position, move, piece.color)
        );

        return {
          ...prev,
          selectedSquare: position,
          validMoves: legalMoves,
        };
      }

      return prev;
    });
  }, [gameStarted, makeMove]);

  const resetGame = useCallback(() => {
    setGameState({
      board: createInitialBoard(),
      currentPlayer: 'white',
      selectedSquare: null,
      validMoves: [],
      moveHistory: [],
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true,
      },
      whiteScore: 0,
      blackScore: 0,
    });
  }, []);
  const isValidMove = useCallback((position: Position): boolean => {
    return gameState.validMoves.some(move => isPositionEqual(move, position));
  }, [gameState.validMoves]);

  const isSquareSelected = useCallback((position: Position): boolean => {
    return gameState.selectedSquare !== null && isPositionEqual(gameState.selectedSquare, position);
  }, [gameState.selectedSquare]);

  const makeAIMove = useCallback(async () => {
    const currentPlayerType = gameState.currentPlayer === 'white' ? options.whitePlayer : options.blackPlayer;

    if (currentPlayerType !== 'ai') return;
    if (!gameStarted && gameState.currentPlayer === 'white') {
      setGameStarted(true);
    }
    const aiSettings = gameState.currentPlayer === 'white' ? options.whiteAI : options.blackAI;
    const depth = aiSettings?.depth ?? 2;
    const maxTime = aiSettings?.maxTime ?? 5000;
    const evaluation = aiSettings?.evaluation ?? 'balanced';
    const currentBoard = gameState.board;
    const currentPlayer = gameState.currentPlayer;
    const castlingRights = gameState.castlingRights;
    // Use a real Web Worker for AI
    const bestMove = await runMinimaxInWorker({ board: currentBoard, color: currentPlayer, depth, maxTime, evaluation, castlingRights });

    if (bestMove) {
      setGameState(current => {
        // Only make the move if it's still this player's turn (prevents double moves)
        if (current.currentPlayer !== currentPlayer) {
          return current;
        }
        const newState = makeMove(current, bestMove.from, bestMove.to);

        return { ...newState, lastMoveTime: Date.now() };
      });
    }
  }, [gameState.currentPlayer, gameState.board, gameState.castlingRights, options.whitePlayer, options.blackPlayer, options.whiteAI, options.blackAI, gameStarted, makeMove]);

  // AI move trigger
  useEffect(() => {
    const currentPlayerType = gameState.currentPlayer === 'white' ? options.whitePlayer : options.blackPlayer;
    const gameOver = gameState.isCheckmate || gameState.isStalemate;

    if (currentPlayerType === 'ai' && !gameOver) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 500); // Small delay for visual feedback

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.isCheckmate, gameState.isStalemate, options.whitePlayer, options.blackPlayer, makeAIMove]);

  return {
    gameState,
    selectSquare,
    resetGame,
    isSquareSelected,
    isValidMove,
    whiteTime,
    blackTime,
  };
};
