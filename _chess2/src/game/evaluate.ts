import type { Board, PieceColor, Position } from './types';
import { isKingInCheck, getValidMoves, wouldMoveResultInCheck } from './moveValidation';

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Total starting material for one side: 8 pawns + 2 knights + 2 bishops + 2 rooks + 1 queen
const STARTING_MATERIAL = 8 * 100 + 2 * 320 + 2 * 330 + 2 * 500 + 1 * 900; // = 3900

export function simpleEvaluate(board: Board, color: PieceColor): number {
  const opponentColor = color === 'white' ? 'black' : 'white';
  
  let myScore = 0;
  let opponentScore = 0;
  let myKingRow = 0, myKingCol = 0;
  let oppKingRow = 0, oppKingCol = 0;
  
  // Track piece development and pawn structure
  let myDevelopedPieces = 0;
  let oppDevelopedPieces = 0;
  const myPawnFiles: boolean[] = new Array(8).fill(false);
  const oppPawnFiles: boolean[] = new Array(8).fill(false);

  // Calculate material and positional scores
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) continue;

      const value = pieceValues[piece.type];
      const tableRow = piece.color === 'white' ? 7 - row : row;

      // Material value
      if (piece.color === color) {
        myScore += value;
      } else {
        opponentScore += value;
      }

      // Pawn structure analysis
      if (piece.type === 'p') {
        let pawnBonus = 0;
        
        // Encourage center pawns to advance (small bonuses - material always dominates)
        const isCenterPawn = (col === 3 || col === 4);
        
        if (isCenterPawn) {
          // Small bonus for advancing center pawns
          if (tableRow === 1) pawnBonus += 0;   // Starting position
          if (tableRow === 2) pawnBonus += 2;   // One square
          if (tableRow === 3) pawnBonus += 5;   // Two squares
          if (tableRow === 4) pawnBonus += 8;   // Deep center control
        } else {
          // Tiny bonus for other pawns
          if (tableRow === 2) pawnBonus += 1;
          if (tableRow === 3) pawnBonus += 2;
        }
        
        // Supporting center files (c and f)
        if (col === 2 || col === 5) {
          if (tableRow >= 2) pawnBonus += 2;
        }
        
        // Advanced pawn bonus (all pawns)
        if (tableRow >= 5) pawnBonus += tableRow * 3; // 15-21 for ranks 5-7
        if (tableRow === 7) pawnBonus += 50; // Near promotion
        
        if (piece.color === color) {
          myPawnFiles[col] = true;
          myScore += pawnBonus;
        } else {
          oppPawnFiles[col] = true;
          opponentScore += pawnBonus;
        }
        continue;
      }

      // Track piece development
      switch (piece.type) {
        case 'n':
        case 'b':
          // Minor pieces developed if off back rank
          if (piece.color === color && tableRow > 0) myDevelopedPieces++;
          if (piece.color === opponentColor && tableRow > 0) oppDevelopedPieces++;
          break;
        case 'r':
          // Rooks developed if off back rank or not in corner
          if (piece.color === color && (tableRow > 0 || (col !== 0 && col !== 7))) {
            myDevelopedPieces++;
          }
          if (piece.color === opponentColor && (tableRow > 0 || (col !== 0 && col !== 7))) {
            oppDevelopedPieces++;
          }
          break;
        case 'q': {
          // Queen developed if not on starting square (d1/d8)
          const queenStarted = tableRow === 0 && col === 3;

          if (piece.color === color && !queenStarted) myDevelopedPieces++;
          if (piece.color === opponentColor && !queenStarted) oppDevelopedPieces++;
          break;
        }
        case 'k':
          if (piece.color === color) {
            myKingRow = row;
            myKingCol = col;
          } else {
            oppKingRow = row;
            oppKingCol = col;
          }
          break;
      }
    }
  }

  // Pawn structure penalties
  let myPawnStructurePenalty = 0;
  let oppPawnStructurePenalty = 0;
  
  for (let col = 0; col < 8; col++) {
    // Doubled pawns penalty (checked by counting pawns per file)
    let myPawnsInFile = 0;
    let oppPawnsInFile = 0;
    
    for (let row = 0; row < 8; row++) {
      const piece = board[row][col];

      if (piece && piece.type === 'p') {
        if (piece.color === color) myPawnsInFile++;
        else oppPawnsInFile++;
      }
    }
    
    if (myPawnsInFile > 1) myPawnStructurePenalty += (myPawnsInFile - 1) * 10;
    if (oppPawnsInFile > 1) oppPawnStructurePenalty += (oppPawnsInFile - 1) * 10;
    
    // Isolated pawn penalty (no friendly pawns on adjacent files)
    if (myPawnsInFile > 0) {
      const hasSupport = (col > 0 && myPawnFiles[col - 1]) || (col < 7 && myPawnFiles[col + 1]);

      if (!hasSupport) myPawnStructurePenalty += 8;
    }
    if (oppPawnsInFile > 0) {
      const hasSupport = (col > 0 && oppPawnFiles[col - 1]) || (col < 7 && oppPawnFiles[col + 1]);

      if (!hasSupport) oppPawnStructurePenalty += 8;
    }
  }

  myScore -= myPawnStructurePenalty;
  opponentScore -= oppPawnStructurePenalty;

  // Development bonus: reward having multiple pieces developed
  const developmentBonus = (myDevelopedPieces - oppDevelopedPieces) * 8;

  myScore += developmentBonus;

  // Piece defense bonus: reward pieces that defend other pieces
  let myDefenseBonus = 0;
  let oppDefenseBonus = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece || piece.type === 'k') continue;
      
      // Check if piece is defended by a pawn (simple diagonal check)
      const isWhite = piece.color === 'white';
      const defenseRow = isWhite ? row - 1 : row + 1;
      
      if (defenseRow >= 0 && defenseRow < 8) {
        // Check left diagonal
        if (col > 0) {
          const defender = board[defenseRow][col - 1];

          if (defender && defender.type === 'p' && defender.color === piece.color) {
            if (piece.color === color) myDefenseBonus += 2;
            else oppDefenseBonus += 2;
          }
        }
        // Check right diagonal
        if (col < 7) {
          const defender = board[defenseRow][col + 1];

          if (defender && defender.type === 'p' && defender.color === piece.color) {
            if (piece.color === color) myDefenseBonus += 2;
            else oppDefenseBonus += 2;
          }
        }
      }
    }
  }
  
  myScore += myDefenseBonus;
  opponentScore += oppDefenseBonus;

  // Endgame detection (low material)
  const totalMaterial = myScore + opponentScore;
  const isEndgame = totalMaterial < 2000;

  // In endgame when winning, push opponent king to edge
  if (isEndgame && myScore > opponentScore) {
    const oppKingCenterDist = Math.max(
      Math.abs(oppKingRow - 3.5),
      Math.abs(oppKingCol - 3.5)
    );

    myScore += oppKingCenterDist * 10;

    // Reward keeping own king close to opponent king (for mating)
    const kingDist = Math.abs(myKingRow - oppKingRow) + Math.abs(myKingCol - oppKingCol);

    myScore += (14 - kingDist) * 5;
  }

  // Combine scores with small random noise to prevent repetition
  const materialDiff = (myScore - opponentScore) / STARTING_MATERIAL;
  const noise = (Math.random() - 0.5) * 0.01;

  return materialDiff + noise;
}

// Fast check for checkmate/stalemate - only called when moves.length === 0
export function isCheckmate(board: Board, color: PieceColor): boolean {
  if (!isKingInCheck(board, color)) return false;

  return !hasAnyLegalMove(board, color);
}

export function isStalemate(board: Board, color: PieceColor): boolean {
  if (isKingInCheck(board, color)) return false;

  return !hasAnyLegalMove(board, color);
}

function hasAnyLegalMove(board: Board, color: PieceColor): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece || piece.color !== color) continue;

      const from: Position = { row, col };
      const moves = getValidMoves(board, from, piece);
      
      for (const to of moves) {
        if (!wouldMoveResultInCheck(board, from, to, color)) {
          return true; // Early exit on first legal move found
        }
      }
    }
  }

  return false;
}
