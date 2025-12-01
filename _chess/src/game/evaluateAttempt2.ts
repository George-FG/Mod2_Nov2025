import type { Board, PieceColor } from './types';

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Total starting material for one side: 8 pawns + 2 knights + 2 bishops + 2 rooks + 1 queen
const STARTING_MATERIAL =
  8 * 100 + 2 * 320 + 2 * 330 + 2 * 500 + 1 * 900; // 3900

// ---- Tunable weights (all in centipawns) -----------------------------

const WEIGHTS = {
  pawnAdvanceCenter: 4,        // bonus for advanced central pawns
  pawnAdvanceOther: 2,         // bonus for advanced non-central pawns
  pawnOnSupportFile: 2,        // small bonus for c/f file support
  passedPawn: 30,              // simple passed pawn bonus
  nearPromotion: 50,           // pawn on last rank (tableRow 7)
  doubledPawnPenalty: 12,      // each extra pawn on same file
  isolatedPawnPenalty: 10,     // pawn with no neighbors on adjacent files
  minorDevelopment: 8,         // N/B off back rank
  rookDevelopment: 6,          // rook off corner or back rank
  kingSafetyMidgame: 4,        // penalty per "distance" from safe zone
  kingEdgeBonusEndgame: 10,    // push enemy king to edge when winning
  kingProximityEndgame: 5,     // bring own king closer in endgame
};

const ENDGAME_NON_PAWN_THRESHOLD = 1400; // approx "low material" threshold

export function evaluateAttempt2(board: Board, color: PieceColor): number {

  // Raw material (pieces only, no positional stuff)
  let myMaterial = 0;
  let oppMaterial = 0;

  // Non-pawn material for endgame detection
  let myNonPawnMaterial = 0;
  let oppNonPawnMaterial = 0;

  // Positional scores (we keep them separate from raw material)
  let myPositional = 0;
  let oppPositional = 0;

  // Development tracking
  let myDevCount = 0;
  let oppDevCount = 0;

  // King positions
  let myKingRow = -1;
  let myKingCol = -1;
  let oppKingRow = -1;
  let oppKingCol = -1;

  // Pawn structure tracking
  const myPawnCountByFile = new Array<number>(8).fill(0);
  const oppPawnCountByFile = new Array<number>(8).fill(0);
  const myPawnPresenceByFile = new Array<boolean>(8).fill(false);
  const oppPawnPresenceByFile = new Array<boolean>(8).fill(false);

  // For passed pawn detection: store a simple map of pawn existence by rank & file per side
  const whitePawnMap = Array.from({ length: 8 }, () => new Array<boolean>(8).fill(false));
  const blackPawnMap = Array.from({ length: 8 }, () => new Array<boolean>(8).fill(false));

  // -------- First pass: material, development, basic pawn advancement, king positions -----

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) continue;

      const isWhite = piece.color === 'white';
      const isMe = piece.color === color;
      const value = pieceValues[piece.type];

      // tableRow: 0 = starting rank, 7 = promotion rank from that side's perspective
      const tableRow = isWhite ? 7 - row : row;

      // --- Material ---
      if (isMe) {
        myMaterial += value;
        if (piece.type !== 'p' && piece.type !== 'k') {
          myNonPawnMaterial += value;
        }
      } else {
        oppMaterial += value;
        if (piece.type !== 'p' && piece.type !== 'k') {
          oppNonPawnMaterial += value;
        }
      }

      // --- Piece-specific positional terms ---
      if (piece.type === 'p') {
        // Track pawn presence & counts
        if (isMe) {
          myPawnCountByFile[col]++;
          myPawnPresenceByFile[col] = true;
        } else {
          oppPawnCountByFile[col]++;
          oppPawnPresenceByFile[col] = true;
        }

        // Record in pawn maps for passed-pawn check
        if (isWhite) whitePawnMap[row][col] = true;
        else blackPawnMap[row][col] = true;

        // Pawn advancement / centralization
        let pawnScore = 0;
        const isCenterFile = col === 3 || col === 4;

        if (isCenterFile) {
          // Encourage advanced central pawns
          pawnScore += tableRow * WEIGHTS.pawnAdvanceCenter;
        } else {
          // Smaller bonus for other pawns
          pawnScore += tableRow * WEIGHTS.pawnAdvanceOther;
        }

        // c/f file support of center
        if ((col === 2 || col === 5) && tableRow >= 2) {
          pawnScore += WEIGHTS.pawnOnSupportFile;
        }

        // Near promotion (from that side’s perspective)
        if (tableRow === 7) {
          pawnScore += WEIGHTS.nearPromotion;
        }

        if (isMe) myPositional += pawnScore;
        else oppPositional += pawnScore;

        continue; // done with pawn
      }

      // Development: simple heuristic
      switch (piece.type) {
        case 'n':
        case 'b': {
          // Minor piece developed if off back rank
          const developed = tableRow > 0;

          if (developed) {
            if (isMe) myDevCount++;
            else oppDevCount++;
          }
          break;
        }
        case 'r': {
          // Rook developed if off back rank OR not in a corner
          const developed = tableRow > 0 || (col !== 0 && col !== 7);

          if (developed) {
            if (isMe) myDevCount++;
            else oppDevCount++;
          }
          break;
        }
        case 'q': {
          // Queen developed if not on starting square (d1/d8)
          const queenOnStart = isWhite ? row === 7 && col === 3 : row === 0 && col === 3;

          if (!queenOnStart) {
            if (isMe) myDevCount++;
            else oppDevCount++;
          }
          break;
        }
        case 'k': {
          if (isMe) {
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
  }

  // -------- Second pass: pawn structure (doubled / isolated / passed) ----------------------

  let myPawnStructurePenalty = 0;
  let oppPawnStructurePenalty = 0;
  let myPawnStructureBonus = 0;
  let oppPawnStructureBonus = 0;

  // Doubled + isolated with counts and presence
  for (let file = 0; file < 8; file++) {
    const myCount = myPawnCountByFile[file];
    const oppCount = oppPawnCountByFile[file];

    if (myCount > 1) {
      myPawnStructurePenalty += (myCount - 1) * WEIGHTS.doubledPawnPenalty;
    }
    if (oppCount > 1) {
      oppPawnStructurePenalty += (oppCount - 1) * WEIGHTS.doubledPawnPenalty;
    }

    if (myCount > 0) {
      const hasNeighbor =
        (file > 0 && myPawnPresenceByFile[file - 1]) ||
        (file < 7 && myPawnPresenceByFile[file + 1]);

      if (!hasNeighbor) {
        myPawnStructurePenalty += WEIGHTS.isolatedPawnPenalty;
      }
    }

    if (oppCount > 0) {
      const hasNeighbor =
        (file > 0 && oppPawnPresenceByFile[file - 1]) ||
        (file < 7 && oppPawnPresenceByFile[file + 1]);

      if (!hasNeighbor) {
        oppPawnStructurePenalty += WEIGHTS.isolatedPawnPenalty;
      }
    }
  }

  // Crude passed pawn detection:
  // white: no black pawn in front on same or adjacent file
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (whitePawnMap[row][col]) {
        let blocked = false;

        for (let r = row - 1; r >= 0; r--) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;

            if (c < 0 || c > 7) continue;
            if (blackPawnMap[r][c]) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }
        if (!blocked) {
          // if this side is "color", it’s my passed pawn, otherwise opponent’s
          const isMine = color === 'white';

          if (isMine) myPawnStructureBonus += WEIGHTS.passedPawn;
          else oppPawnStructureBonus += WEIGHTS.passedPawn;
        }
      }

      if (blackPawnMap[row][col]) {
        let blocked = false;

        for (let r = row + 1; r < 8; r++) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;

            if (c < 0 || c > 7) continue;
            if (whitePawnMap[r][c]) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }
        if (!blocked) {
          const isMine = color === 'black';

          if (isMine) myPawnStructureBonus += WEIGHTS.passedPawn;
          else oppPawnStructureBonus += WEIGHTS.passedPawn;
        }
      }
    }
  }

  myPositional += myPawnStructureBonus - myPawnStructurePenalty;
  oppPositional += oppPawnStructureBonus - oppPawnStructurePenalty;

  // -------- Development bonus -------------------------------------------------------------

  const devDiff = myDevCount - oppDevCount;
  const developmentScore = devDiff * WEIGHTS.minorDevelopment;

  myPositional += developmentScore;

  // -------- King safety / endgame logic ---------------------------------------------------

  const totalNonPawnMaterial = myNonPawnMaterial + oppNonPawnMaterial;
  const isEndgame = totalNonPawnMaterial < ENDGAME_NON_PAWN_THRESHOLD;

  if (myKingRow !== -1 && oppKingRow !== -1) {
    if (isEndgame) {
      // When winning in endgame, push enemy king to edge and bring own king closer
      if (myMaterial > oppMaterial) {
        const oppKingCenterDist = Math.max(
          Math.abs(oppKingRow - 3.5),
          Math.abs(oppKingCol - 3.5)
        );

        myPositional += oppKingCenterDist * WEIGHTS.kingEdgeBonusEndgame;

        const kingDist =
          Math.abs(myKingRow - oppKingRow) + Math.abs(myKingCol - oppKingCol);

        myPositional += (14 - kingDist) * WEIGHTS.kingProximityEndgame;
      }
    } else {
      // Midgame king safety: prefer kings a bit away from the center
      const myCenterDist = Math.max(
        Math.abs(myKingRow - 3.5),
        Math.abs(myKingCol - 3.5)
      );
      const oppCenterDist = Math.max(
        Math.abs(oppKingRow - 3.5),
        Math.abs(oppKingCol - 3.5)
      );

      // Penalize my king being "too central" compared to his
      const kingSafetyDiff = (oppCenterDist - myCenterDist) * WEIGHTS.kingSafetyMidgame;

      myPositional += kingSafetyDiff;
    }
  }

  // -------- Combine material + positional and normalize -----------------------------------

  const myTotal = myMaterial + myPositional;
  const oppTotal = oppMaterial + oppPositional;

  // Score from `color`’s point of view (positive = good for `color`)
  const diff = myTotal - oppTotal;

  // Normalize roughly to [-1, 1] range
  const score = diff / STARTING_MATERIAL;

  return score;
}
