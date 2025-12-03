import type { Board, PieceColor } from './types';
import { isCheckmate } from './evaluate';

// ----------------- Basic piece values (centipawns) -----------------

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// --------- Heuristic weights (centipawns) ---------------------------

const W = {
  // Pawn structure
  doubledPawn: -12,
  isolatedPawn: -10,
  centralPawnAdvance: 5,  // bonus for central pawns (d/e files) pushed a bit
  pawnAdvance: 2,         // small bonus for other pawn advances

  // Development / piece activity
  minorDev: 10,           // N/B off home rank
  rookDev: 6,             // rook off home rank
  centerKnight: 6,        // knight near centre
  centerBishop: 4,
  centerRook: 2,
  centerQueen: 2,
  bishopPair: 25,

  // Piece defense
  pawnDefendsPiece: 2,    // small bonus if defended by pawn

  // King safety (opening / middlegame)
  castlingBonus: 40,              // moderate preference to castle
  kingCentralPenalty: -8,         // per file step from edge (b–g)
  kingAdvancePenalty: -15,        // per rank away from home
  kingShieldPenalty: -6,          // per missing pawn in front
  kingMovedBeforeCastling: -60,   // king off start square and not castled

  // Endgame king activity
  kingCenterEndgame: 10,      // encourage centre king in endgame
  oppKingEdgeEndgame: 10,     // push opponent king to edge
  kingDistanceEndgame: 5,     // bring kings closer when winning
};

// Endgame detection: when total non-pawn material is this or less, switch to endgame rules
const ENDGAME_THRESHOLD = 1400; // ~ “one rook + one minor each” type of position

// ----------------- Helper types -------------------------------------

type SideStats = {
  color: PieceColor;
  material: number;
  nonPawnMaterial: number;
  bishopCount: number;
  queenCount: number;

  // development / activity
  minorDev: number;
  rookDev: number;
  centerActivity: number;

  // pawn structure
  pawnCountByFile: number[];
  pawnPresenceByFile: boolean[];
  centralPawnScore: number;
  pawnAdvanceScore: number;

  // king
  kingRow: number;
  kingCol: number;

  // tactical penalty for loose pieces (attacked by enemy pawn, not defended by any piece)
  loosePiecePenalty: number;
};

function makeSide(color: PieceColor): SideStats {
  return {
    color,
    material: 0,
    nonPawnMaterial: 0,
    bishopCount: 0,
    queenCount: 0,

    minorDev: 0,
    rookDev: 0,
    centerActivity: 0,

    pawnCountByFile: new Array<number>(8).fill(0),
    pawnPresenceByFile: new Array<boolean>(8).fill(false),
    centralPawnScore: 0,
    pawnAdvanceScore: 0,

    kingRow: -1,
    kingCol: -1,

    loosePiecePenalty: 0,
  };
}

// ----------------- Attack helper ------------------------------------

// Light-weight attack detector for defense checks.
// We only use this when a piece is already known to be attacked by a pawn,
// so calling this is not insanely frequent.
function isSquareAttackedByColor(
  board: Board,
  row: number,
  col: number,
  color: PieceColor
): boolean {
  // Pawns
  if (color === 'white') {
    const r = row - 1;
    if (r >= 0) {
      if (col > 0) {
        const p = board[r][col - 1];
        if (p && p.color === 'white' && p.type === 'p') return true;
      }
      if (col < 7) {
        const p = board[r][col + 1];
        if (p && p.color === 'white' && p.type === 'p') return true;
      }
    }
  } else {
    const r = row + 1;
    if (r < 8) {
      if (col > 0) {
        const p = board[r][col - 1];
        if (p && p.color === 'black' && p.type === 'p') return true;
      }
      if (col < 7) {
        const p = board[r][col + 1];
        if (p && p.color === 'black' && p.type === 'p') return true;
      }
    }
  }

  // Knights
  const knightDeltas = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightDeltas) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const p = board[r][c];
    if (p && p.color === color && p.type === 'n') return true;
  }

  // Bishops / Queens (diagonals)
  const diagDirs = [
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  for (const [dr, dc] of diagDirs) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r][c];
      if (p) {
        if (p.color === color && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // Rooks / Queens (orthogonals)
  const orthoDirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (const [dr, dc] of orthoDirs) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r][c];
      if (p) {
        if (p.color === color && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // King
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r > 7 || c < 0 || c > 7) continue;
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') return true;
    }
  }

  return false;
}

// ----------------------- Main evaluation ----------------------------

export function evaluate(board: Board, color: PieceColor): number {
  // --- Hard win/loss (checkmate) ------------------------------------
  const opponentColor: PieceColor = color === 'white' ? 'black' : 'white';
  if (isCheckmate(board, opponentColor)) {
    return 100000; // we delivered mate
  }
  if (isCheckmate(board, color)) {
    return -100000; // we are mated
  }

  const white = makeSide('white');
  const black = makeSide('black');

  // For pawn-defense bonus
  let whitePawnDefenseBonus = 0;
  let blackPawnDefenseBonus = 0;

  // -------- First pass: material, dev, central activity, king pos, pawns ----

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const side = piece.color === 'white' ? white : black;
      const isWhitePiece = piece.color === 'white';
      const value = PIECE_VALUES[piece.type];

      side.material += value;
      if (piece.type !== 'p' && piece.type !== 'k') {
        side.nonPawnMaterial += value;
      }
      if (piece.type === 'b') side.bishopCount++;
      if (piece.type === 'q') side.queenCount++;

      // Distance from that side's home rank: white home=0, black home=7
      const rankFromHome = isWhitePiece ? row : 7 - row;

      // Simple centralization score: distance to board centre (3.5, 3.5)
      const distFile = Math.abs(col - 3.5);
      const distRank = Math.abs(row - 3.5);
      const centerDist = Math.max(distFile, distRank);
      const centerBonusBase = 3.5 - centerDist; // larger when closer to centre

      switch (piece.type) {
        case 'k': {
          side.kingRow = row;
          side.kingCol = col;
          break;
        }

        case 'p': {
          // track pawn structure
          side.pawnCountByFile[col]++;
          side.pawnPresenceByFile[col] = true;

          // small bonus for advancing pawns (but not too big)
          if (isWhitePiece) {
            side.pawnAdvanceScore += row * W.pawnAdvance;
          } else {
            side.pawnAdvanceScore += (7 - row) * W.pawnAdvance;
          }

          // extra for central pawns on d/e files advanced a bit
          const isCentralFile = col === 3 || col === 4;
          if (isCentralFile && rankFromHome >= 1 && rankFromHome <= 4) {
            side.centralPawnScore += W.centralPawnAdvance;
          }
          break;
        }

        case 'n': {
          if (rankFromHome > 0) side.minorDev++;
          side.centerActivity += centerBonusBase * W.centerKnight;
          break;
        }

        case 'b': {
          if (rankFromHome > 0) side.minorDev++;
          side.centerActivity += centerBonusBase * W.centerBishop;
          break;
        }

        case 'r': {
          if (rankFromHome > 0) side.rookDev++;
          side.centerActivity += centerBonusBase * W.centerRook;
          break;
        }

        case 'q': {
          side.centerActivity += centerBonusBase * W.centerQueen;
          break;
        }
      }
    }
  }

  // -------- Pawn-defense + loose-piece penalty --------------------

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.type === 'k') continue;

      const isWhitePiece = piece.color === 'white';
      const mySide = isWhitePiece ? white : black;

      // ---- defended by pawn? (backward diagonal) ----
      const defRow = isWhitePiece ? row - 1 : row + 1;
      let defendedByPawn = false;

      if (defRow >= 0 && defRow < 8) {
        // left diagonal
        if (col > 0) {
          const d = board[defRow][col - 1];
          if (d && d.type === 'p' && d.color === piece.color) defendedByPawn = true;
        }
        // right diagonal
        if (!defendedByPawn && col < 7) {
          const d = board[defRow][col + 1];
          if (d && d.type === 'p' && d.color === piece.color) defendedByPawn = true;
        }
      }

      if (defendedByPawn) {
        if (piece.color === 'white') whitePawnDefenseBonus += W.pawnDefendsPiece;
        else blackPawnDefenseBonus += W.pawnDefendsPiece;
      }

      // ---- attacked by enemy pawn? (forward diagonal of enemy) ----
      let attackedByEnemyPawn = false;
      if (isWhitePiece) {
        // black pawn attacks downwards: from (r+1, c±1) to (r,c)
        const atkRow = row + 1;
        if (atkRow < 8) {
          if (col > 0) {
            const a = board[atkRow][col - 1];
            if (a && a.type === 'p' && a.color === 'black') attackedByEnemyPawn = true;
          }
          if (!attackedByEnemyPawn && col < 7) {
            const a = board[atkRow][col + 1];
            if (a && a.type === 'p' && a.color === 'black') attackedByEnemyPawn = true;
          }
        }
      } else {
        // white pawn attacks upwards: from (r-1, c±1) to (r,c)
        const atkRow = row - 1;
        if (atkRow >= 0) {
          if (col > 0) {
            const a = board[atkRow][col - 1];
            if (a && a.type === 'p' && a.color === 'white') attackedByEnemyPawn = true;
          }
          if (!attackedByEnemyPawn && col < 7) {
            const a = board[atkRow][col + 1];
            if (a && a.type === 'p' && a.color === 'white') attackedByEnemyPawn = true;
          }
        }
      }

      if (attackedByEnemyPawn) {
        // Now check if defended by *any* friendly piece
        const defendedByAnyPiece = isSquareAttackedByColor(board, row, col, piece.color);

        if (!defendedByAnyPiece) {
          // Big “loose piece” penalty, counted inside the material term
          let penalty = 0;
          switch (piece.type) {
            case 'p':
              penalty = 15;
              break;
            case 'n':
            case 'b':
              penalty = 80;   // ~0.8 pawn
              break;
            case 'r':
              penalty = 120;
              break;
            case 'q':
              penalty = 180;
              break;
          }
          mySide.loosePiecePenalty += penalty;
        }
      }
    }
  }

  // -------- Game phase detection (discrete) --------------------------

  const totalNonPawnMaterial = white.nonPawnMaterial + black.nonPawnMaterial;
  const isEndgame = totalNonPawnMaterial <= ENDGAME_THRESHOLD;

  // -------- Pawn structure penalties / bonuses --------------------------

  function pawnStructure(me: SideStats): number {
    let score = 0;

    for (let file = 0; file < 8; file++) {
      const cnt = me.pawnCountByFile[file];

      if (cnt > 1) {
        score += (cnt - 1) * W.doubledPawn;
      }

      if (cnt > 0) {
        const hasNeighbor =
          (file > 0 && me.pawnPresenceByFile[file - 1]) ||
          (file < 7 && me.pawnPresenceByFile[file + 1]);
        if (!hasNeighbor) {
          score += W.isolatedPawn;
        }
      }
    }

    score += me.centralPawnScore;
    score += me.pawnAdvanceScore;

    return score;
  }

  // -------- Development / bishop pair / centre -------------------------

  function developmentAndPieces(me: SideStats): number {
    let score = 0;

    score += me.minorDev * W.minorDev;
    score += me.rookDev * W.rookDev;
    score += me.centerActivity;

    if (me.bishopCount >= 2) {
      score += W.bishopPair;
    }

    return score;
  }

  // -------- Passed pawn evaluation (stronger in endgame) -----------

  function evaluatePassedPawns(board: Board, side: PieceColor): number {
    if (!isEndgame) return 0;

    let score = 0;
    const isWhiteSide = side === 'white';
    const dir = isWhiteSide ? 1 : -1;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece || piece.type !== 'p' || piece.color !== side) continue;

        let isPassed = true;

        // check all squares ahead on this and adjacent files for enemy pawns
        for (let r = row + dir; r >= 0 && r < 8; r += dir) {
          for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
            const enemy = board[r][c];
            if (enemy && enemy.type === 'p' && enemy.color !== side) {
              isPassed = false;
              break;
            }
          }
          if (!isPassed) break;
        }

        if (isPassed) {
          // more advanced passed pawns are more valuable
          const rank = isWhiteSide ? row : (7 - row);
          score += 20 + rank * 15; // max ~125 for a very advanced passer
        }
      }
    }

    return score;
  }

  // -------- King safety / activity ---------------------------------

  function kingTerms(me: SideStats): number {
    let score = 0;
    if (me.kingRow === -1) return score;

    const row = me.kingRow;
    const col = me.kingCol;
    const isWhiteSide = me.color === 'white';

    const homeRank = isWhiteSide ? 0 : 7;
    const startFile = 3; // d-file (king starting position)
    const onHomeRank = row === homeRank;
    const onStartSquare = onHomeRank && col === startFile;
    const castled = onHomeRank && (col === 5 || col === 1);

    if (!isEndgame) {
      // Pure opening/middlegame king safety
      if (castled) {
        score += W.castlingBonus;
      } else {
        if (!onStartSquare) {
          score += W.kingMovedBeforeCastling;
        }

        const fileFromEdge = Math.min(col, 7 - col); // 0 on a/h, 3 in centre
        score += fileFromEdge * W.kingCentralPenalty;

        const ranksAdvanced = isWhiteSide
          ? Math.max(0, row - homeRank)
          : Math.max(0, homeRank - row);
        score += ranksAdvanced * W.kingAdvancePenalty;

        const pawnRow = isWhiteSide ? row + 1 : row - 1;
        if (pawnRow >= 0 && pawnRow < 8) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            if (c < 0 || c > 7) continue;

            const front = board[pawnRow][c];
            if (!front || front.type !== 'p' || front.color !== me.color) {
              score += W.kingShieldPenalty;
            }
          }
        }
      }
    } else {
      // Pure endgame king activity
      const distFile = Math.abs(col - 3.5);
      const distRank = Math.abs(row - 3.5);
      const centerDist = Math.max(distFile, distRank);
      const centerBonus = (3.5 - centerDist) * W.kingCenterEndgame;
      score += centerBonus;
    }

    return score;
  }

  // -------- Endgame king race terms (only in endgame) -------------

  function endgameKingRace(me: SideStats, opp: SideStats): number {
    if (!isEndgame) return 0;
    if (me.kingRow === -1 || opp.kingRow === -1) return 0;

    const oppKingCenterDist = Math.max(
      Math.abs(opp.kingRow - 3.5),
      Math.abs(opp.kingCol - 3.5)
    );
    const kingDist =
      Math.abs(me.kingRow - opp.kingRow) +
      Math.abs(me.kingCol - opp.kingCol);

    let score = 0;
    score += oppKingCenterDist * W.oppKingEdgeEndgame;
    score += (14 - kingDist) * W.kingDistanceEndgame; // 14 = max manhattan

    return score;
  }

  // -------- Combine for each side --------------------------------------

  function baseEvalSide(me: SideStats, pawnDefenseBonus: number): number {
    let s = 0;

    s += me.material;
    s += pawnStructure(me);
    s += developmentAndPieces(me);
    s += kingTerms(me);
    s += pawnDefenseBonus;

    return s;
  }

  let whiteScore = baseEvalSide(white, whitePawnDefenseBonus);
  let blackScore = baseEvalSide(black, blackPawnDefenseBonus);

  // Passed pawns (only meaningful in endgame)
  whiteScore += evaluatePassedPawns(board, 'white');
  blackScore += evaluatePassedPawns(board, 'black');

  // Endgame king race when one side is better
  if (isEndgame) {
    if (whiteScore > blackScore + 100) {
      whiteScore += endgameKingRace(white, black);
    } else if (blackScore > whiteScore + 100) {
      blackScore += endgameKingRace(black, white);
    }
  }

  // ================== MATERIAL vs POSITION SPLIT ======================

  // 1) Pure material adjusted by loose-piece “tactical” penalties
  const whiteMat = white.material - white.loosePiecePenalty;
  const blackMat = black.material - black.loosePiecePenalty;
  const materialDiff = whiteMat - blackMat;

  // 2) Everything else is "positional"
  const whitePos = whiteScore - white.material;
  const blackPos = blackScore - black.material;
  let positionalDiff = whitePos - blackPos;

  // Hard clamp: positional factors may NEVER outweigh a pawn.
  // Clamp a bit looser in endgame but still < 1 pawn.
  const MAX_POSITIONAL = isEndgame ? 60 : 40;
  if (positionalDiff > MAX_POSITIONAL) positionalDiff = MAX_POSITIONAL;
  if (positionalDiff < -MAX_POSITIONAL) positionalDiff = -MAX_POSITIONAL;

  let totalDiff = materialDiff + positionalDiff;

  // Small anti-draw bias:
  // If we are materially ahead but the eval is very close to 0,
  // nudge it away from 0 so engines don't happily repeat.
  const NEAR_ZERO = 10; // 0.1 pawn
  if (materialDiff !== 0 && Math.abs(totalDiff) < NEAR_ZERO) {
    const sign = materialDiff > 0 ? 1 : -1;
    totalDiff = sign * NEAR_ZERO;
  }

  // Return from the perspective of `color`
  return color === 'white' ? totalDiff : -totalDiff;
}
