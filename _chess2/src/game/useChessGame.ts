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
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means current position

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

  // Function to reconstruct board at a given history index
  const getBoardAtHistoryIndex = useCallback((index: number): Board => {
    if (index < 0 || gameState.moveHistory.length === 0) {
      return gameState.board;
    }

    const board = createInitialBoard();
    const movesToReplay = gameState.moveHistory.slice(0, index + 1);

    for (const move of movesToReplay) {
      const piece = board[move.from.row][move.from.col];
      if (!piece) continue;

      // Handle castling
      if (piece.type === 'k' && Math.abs(move.to.col - move.from.col) === 2) {
        const isKingSide = move.to.col > move.from.col;
        const rookFromCol = isKingSide ? 7 : 0;
        const rookToCol = isKingSide ? move.to.col - 1 : move.to.col + 1;
        const rookRow = move.from.row;

        board[move.to.row][move.to.col] = piece;
        board[move.from.row][move.from.col] = null;
        board[rookRow][rookToCol] = board[rookRow][rookFromCol];
        board[rookRow][rookFromCol] = null;
      } else {
        // Normal move
        board[move.to.row][move.to.col] = piece;
        board[move.from.row][move.from.col] = null;

        // Handle pawn promotion
        if (piece.type === 'p') {
          const promotionRank = piece.color === 'white' ? 7 : 0;
          if (move.to.row === promotionRank) {
            board[move.to.row][move.to.col] = { ...piece, type: 'q' };
          }
        }
      }
    }

    return board;
  }, [gameState.board, gameState.moveHistory]);

  const makeMove = useCallback((
    state: GameState,
    from: Position,
    to: Position
  ): GameState => {
    const newBoard: Board = state.board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];
    let captured = newBoard[to.row][to.col];

    if (!piece) return state;

    // Check if this is a castling move
    const isCastling = piece.type === 'k' && Math.abs(to.col - from.col) === 2;

    // Check if this is an en passant move
    let isEnPassant = false;
    if (piece.type === 'p' && !captured && from.col !== to.col) {
      // Pawn moved diagonally to empty square - must be en passant
      isEnPassant = true;
      // Capture the pawn that was passed
      const capturedPawnRow = from.row;
      captured = newBoard[capturedPawnRow][to.col];
      newBoard[capturedPawnRow][to.col] = null;
    }

    // Move the piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Handle castling: move the rook
    if (isCastling) {
      if (to.col === 5) {
        // King-side castling
        const rook = newBoard[from.row][7];

        newBoard[from.row][4] = rook;
        newBoard[from.row][7] = null;
      } else if (to.col === 1) {
        // Queen-side castling
        const rook = newBoard[from.row][0];

        newBoard[from.row][2] = rook;
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
      isEnPassant,
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
    
    // Score = opponent's material lost (what you've captured)
    const newWhiteScore = STARTING_MATERIAL - blackMaterial;
    const newBlackScore = STARTING_MATERIAL - whiteMaterial;

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
          if (m.to.col === 5) {
            // King-side
            const rook = board[m.from.row][7];

            board[m.from.row][4] = rook;
            board[m.from.row][7] = null;
          } else if (m.to.col === 1) {
            // Queen-side
            const rook = board[m.from.row][0];

            board[m.from.row][2] = rook;
            board[m.from.row][0] = null;
          }
        }

        // Handle en passant
        if (m.isEnPassant) {
          const capturedPawnRow = m.from.row;
          board[capturedPawnRow][m.to.col] = null;
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
    // Only allow moves when viewing the latest position
    if (historyIndex !== -1) {
      return;
    }

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

          setHistoryIndex(-1); // Reset to current position after move
          return { ...newState, lastMoveTime: Date.now() };
        }        // If clicking on own piece, select it instead
        if (piece && piece.color === prev.currentPlayer) {
          const lastMove = prev.moveHistory[prev.moveHistory.length - 1];
          const allMoves = getValidMoves(prev.board, position, piece, lastMove);

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
        const lastMove = prev.moveHistory[prev.moveHistory.length - 1];
        const allMoves = getValidMoves(prev.board, position, piece, lastMove);

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
  }, [gameStarted, makeMove, historyIndex]);

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
    
    // Build position history for repetition detection
    const positionHistory: string[] = [];
    const boardToString = (board: Board) =>
      board.map(row => row.map(cell => cell ? cell.type + cell.color[0] : '.').join('')).join('/');
    
    // Add all previous positions from move history
    const tempBoard = createInitialBoard();
    positionHistory.push(boardToString(tempBoard));
    
    for (const move of gameState.moveHistory) {
      const piece = tempBoard[move.from.row][move.from.col];
      if (!piece) continue;
      
      tempBoard[move.to.row][move.to.col] = move.promotion ? { type: move.promotion, color: piece.color } : piece;
      tempBoard[move.from.row][move.from.col] = null;
      
      if (move.isCastling) {
        if (move.to.col === 5) {
          const rook = tempBoard[move.from.row][7];
          tempBoard[move.from.row][4] = rook;
          tempBoard[move.from.row][7] = null;
        } else if (move.to.col === 1) {
          const rook = tempBoard[move.from.row][0];
          tempBoard[move.from.row][2] = rook;
          tempBoard[move.from.row][0] = null;
        }
      }
      
      if (move.isEnPassant) {
        const capturedPawnRow = move.from.row;
        tempBoard[capturedPawnRow][move.to.col] = null;
      }
      
      positionHistory.push(boardToString(tempBoard));
    }
    
    // Use a real Web Worker for AI
    const bestMove = await runMinimaxInWorker({ board: currentBoard, color: currentPlayer, depth, maxTime, evaluation, castlingRights, positionHistory });

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
  }, [gameState.currentPlayer, gameState.board, gameState.castlingRights, gameState.moveHistory, options.whitePlayer, options.blackPlayer, options.whiteAI, options.blackAI, gameStarted, makeMove]);

  // AI move trigger
  useEffect(() => {
    const currentPlayerType = gameState.currentPlayer === 'white' ? options.whitePlayer : options.blackPlayer;
    const gameOver = gameState.isCheckmate || gameState.isStalemate;

    if (currentPlayerType === 'ai' && !gameOver && historyIndex === -1) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 500); // Small delay for visual feedback

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.isCheckmate, gameState.isStalemate, options.whitePlayer, options.blackPlayer, makeAIMove, historyIndex]);

  // Navigation functions
  const goToFirstMove = useCallback(() => {
    if (gameState.moveHistory.length > 0) {
      setHistoryIndex(0);
    }
  }, [gameState.moveHistory.length]);

  const goToPreviousMove = useCallback(() => {
    if (historyIndex === -1 && gameState.moveHistory.length > 0) {
      setHistoryIndex(gameState.moveHistory.length - 2);
    } else if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex, gameState.moveHistory.length]);

  const goToNextMove = useCallback(() => {
    if (historyIndex === -1) {
      return; // Already at latest
    }
    if (historyIndex >= gameState.moveHistory.length - 1) {
      setHistoryIndex(-1); // Go to current
    } else {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, gameState.moveHistory.length]);

  const goToLastMove = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  // Get the board to display based on history index
  const displayBoard = historyIndex === -1 ? gameState.board : getBoardAtHistoryIndex(historyIndex);
  const isViewingHistory = historyIndex !== -1;

  const generatePGN = useCallback((): string => {
    const positionToAlgebraic = (pos: Position): string => {
      const files = 'hgfedcba';
      return files[pos.col] + (pos.row + 1);
    };

    const pieceSymbol = (type: PieceType): string => {
      if (type === 'p') return '';
      if (type === 'n') return 'N';
      if (type === 'b') return 'B';
      if (type === 'r') return 'R';
      if (type === 'q') return 'Q';
      if (type === 'k') return 'K';
      return '';
    };

    const moveToAlgebraic = (move: Move, moveIndex: number): string => {
      if (move.isCastling) {
        return move.to.col === 1 ? 'O-O' : 'O-O-O';
      }

      let notation = pieceSymbol(move.piece.type);
      
      // Add disambiguation if needed (for non-pawns)
      if (move.piece.type !== 'p' && move.piece.type !== 'k') {
        // Check if other pieces of same type could move to same square
        const boardBeforeMove = getBoardAtIndex(moveIndex);
        const sameTypePieces: Position[] = [];
        
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const p = boardBeforeMove[row][col];
            if (p && p.type === move.piece.type && p.color === move.piece.color) {
              const pos = { row, col };
              // Skip the piece that actually made the move
              if (pos.row === move.from.row && pos.col === move.from.col) continue;
              
              // Check if this piece could also move to the destination
              const lastMoveForValidation = moveIndex > 0 ? gameState.moveHistory[moveIndex - 1] : undefined;
              const possibleMoves = getValidMoves(boardBeforeMove, pos, p, lastMoveForValidation);
              const canReachDestination = possibleMoves.some(m => m.row === move.to.row && m.col === move.to.col);
              
              if (canReachDestination) {
                // Also check it wouldn't leave king in check
                if (!wouldMoveResultInCheck(boardBeforeMove, pos, move.to, p.color)) {
                  sameTypePieces.push(pos);
                }
              }
            }
          }
        }
        
        if (sameTypePieces.length > 0) {
          // Need disambiguation - add file and/or rank
          const needsFile = !sameTypePieces.every(p => p.col === move.from.col);
          const sameFileExists = sameTypePieces.some(p => p.col === move.from.col);
          
          if (needsFile) {
            notation += 'hgfedcba'[move.from.col];
          }
          // Add rank if file alone isn't enough
          if (!needsFile || sameFileExists) {
            notation += (move.from.row + 1).toString();
          }
        }
      }
      
      // Add capture notation
      if (move.captured || move.isEnPassant) {
        if (move.piece.type === 'p') {
          notation = 'hgfedcba'[move.from.col];
        }
        notation += 'x';
      }
      
      notation += positionToAlgebraic(move.to);
      
      // Add promotion
      if (move.promotion) {
        notation += '=' + pieceSymbol(move.promotion).toUpperCase();
      }
      
      return notation;
    };
    
    const getBoardAtIndex = (index: number): Board => {
      if (index < 0) return createInitialBoard();
      const moves = gameState.moveHistory.slice(0, index);
      const board = createInitialBoard();
      
      for (const m of moves) {
        const p = board[m.from.row][m.from.col];
        if (!p) continue;
        
        board[m.to.row][m.to.col] = m.promotion ? { type: m.promotion, color: p.color } : p;
        board[m.from.row][m.from.col] = null;
        
        if (m.isCastling) {
          if (m.to.col === 5) {
            const rook = board[m.from.row][7];
            board[m.from.row][4] = rook;
            board[m.from.row][7] = null;
          } else if (m.to.col === 1) {
            const rook = board[m.from.row][0];
            board[m.from.row][2] = rook;
            board[m.from.row][0] = null;
          }
        }
        
        if (m.isEnPassant) {
          board[m.from.row][m.to.col] = null;
        }
      }
      
      return board;
    };

    // PGN Header
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    let pgn = `[Event "Chess Game"]\n`;
    pgn += `[Site "Custom Chess App"]\n`;
    pgn += `[Date "${date}"]\n`;
    pgn += `[White "${options.whitePlayer === 'human' ? 'Human' : 'AI (' + (options.whiteAI?.evaluation || 'balanced') + ')'}" ]\n`;
    pgn += `[Black "${options.blackPlayer === 'human' ? 'Human' : 'AI (' + (options.blackAI?.evaluation || 'balanced') + ')'}" ]\n`;
    
    let result = '*';
    if (gameState.isCheckmate) {
      result = gameState.currentPlayer === 'white' ? '0-1' : '1-0';
    } else if (gameState.isStalemate) {
      result = '1/2-1/2';
    }
    pgn += `[Result "${result}"]\n\n`;

    // Moves
    let movesText = '';
    for (let i = 0; i < gameState.moveHistory.length; i++) {
      const move = gameState.moveHistory[i];
      if (i % 2 === 0) {
        movesText += `${Math.floor(i / 2) + 1}. `;
      }
      movesText += moveToAlgebraic(move, i) + ' ';
    }
    pgn += movesText.trim() + ' ' + result;

    return pgn;
  }, [gameState.moveHistory, gameState.isCheckmate, gameState.isStalemate, gameState.currentPlayer, options]);

  return {
    gameState: { ...gameState, board: displayBoard },
    selectSquare,
    resetGame,
    isSquareSelected,
    isValidMove,
    whiteTime,
    blackTime,
    // Navigation
    goToFirstMove,
    goToPreviousMove,
    goToNextMove,
    goToLastMove,
    isViewingHistory,
    historyIndex,
    canGoBack: historyIndex > 0 || (historyIndex === -1 && gameState.moveHistory.length > 0),
    canGoForward: historyIndex !== -1 && historyIndex < gameState.moveHistory.length,
    // PGN Export
    generatePGN,
  };
};
