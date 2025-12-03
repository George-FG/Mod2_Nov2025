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
  pawnDefendsPiece: 2,    // piece defended by own pawn

  // King safety (opening / middlegame)
  castlingBonus: 40,              // moderate preference to castle
  kingCentralPenalty: -8,         // per file step from edge (b–g)
  kingAdvancePenalty: -15,        // per rank away from home
  kingShieldPenalty: -6,          // per missing pawn in front
  kingMovedBeforeCastling: -60,   // king off start square and not castled

  // Endgame king activity
  kingCenterEndgame: 8,       // encourage centre king in endgame
  oppKingEdgeEndgame: 10,     // push opponent king to edge
  kingDistanceEndgame: 5,     // bring kings closer when winning,
};

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

  // “tactical” penalty for loose pieces (attacked by pawn, not defended by pawn)
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
      const isWhite = piece.color === 'white';
      const value = PIECE_VALUES[piece.type];

      side.material += value;
      if (piece.type !== 'p' && piece.type !== 'k') {
        side.nonPawnMaterial += value;
      }
      if (piece.type === 'b') side.bishopCount++;
      if (piece.type === 'q') side.queenCount++;

      // Distance from that side's home rank: white home=0, black home=7
      const rankFromHome = isWhite ? row : 7 - row;

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
          if (isWhite) {
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

  // -------- Pawn-defense + pawn-attack (loose piece) --------------------
  // Reward pieces defended by own pawns and penalise pieces attacked by enemy pawns
  // without pawn defense. This is treated as a “material-like” penalty.

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

      // If attacked by enemy pawn and NOT defended by own pawn: big “loose piece” penalty
      if (attackedByEnemyPawn && !defendedByPawn) {
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

  // -------- Game phase detection ---------------------------------------

  const totalNonPawnMaterial = white.nonPawnMaterial + black.nonPawnMaterial;
  // Smooth endgame weight: 0 in opening (3900+), 1.0 when very low material (< 1300)
  const endgameWeight = Math.max(0, Math.min(1, (2600 - totalNonPawnMaterial) / 1300));

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

  // -------- King safety / activity (smooth transition) ----------

  function kingTerms(me: SideStats, egWeight: number): number {
    let score = 0;
    if (me.kingRow === -1) return score;

    const row = me.kingRow;
    const col = me.kingCol;
    const isWhite = me.color === 'white';

    const homeRank = isWhite ? 0 : 7;
    const startFile = 3; // d-file (king starting position)
    const onHomeRank = row === homeRank;
    const onStartSquare = onHomeRank && col === startFile;
    const castled = onHomeRank && (col === 5 || col === 1);

    const mgWeight = 1.0 - egWeight; // middlegame weight

    // Middlegame king safety (weighted down in endgame)
    if (mgWeight > 0.1) {
      if (castled) {
        score += W.castlingBonus * mgWeight;
      } else {
        // If king left starting square and is not castled: penalty
        if (!onStartSquare) {
          score += W.kingMovedBeforeCastling * mgWeight;
        }

        // central file penalty (b–g bad)
        const fileFromEdge = Math.min(col, 7 - col); // 0 on a/h, 3 in centre
        score += fileFromEdge * W.kingCentralPenalty * mgWeight;

        // rank advance penalty (walking up the board)
        const ranksAdvanced = isWhite
          ? Math.max(0, row - homeRank)
          : Math.max(0, homeRank - row);
        score += ranksAdvanced * W.kingAdvancePenalty * mgWeight;

        // pawn shield in front of king
        const pawnRow = isWhite ? row + 1 : row - 1;
        if (pawnRow >= 0 && pawnRow < 8) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            if (c < 0 || c > 7) continue;

            const front = board[pawnRow][c];
            if (!front || front.type !== 'p' || front.color !== me.color) {
              score += W.kingShieldPenalty * mgWeight;
            }
          }
        }
      }
    }

    // Endgame: encourage king centralization (weighted up in endgame)
    if (egWeight > 0.1) {
      const distFile = Math.abs(col - 3.5);
      const distRank = Math.abs(row - 3.5);
      const centerDist = Math.max(distFile, distRank);
      const centerBonus = (3.5 - centerDist) * W.kingCenterEndgame;
      score += centerBonus * egWeight;
    }

    return score;
  }

  // -------- Endgame king race terms -------------

  function endgameKingRace(
    me: SideStats,
    opp: SideStats
  ): number {
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

  function baseEvalSide(me: SideStats, pawnDefenseBonus: number, egWeight: number): number {
    let s = 0;

    s += me.material;
    s += pawnStructure(me);
    s += developmentAndPieces(me);
    s += kingTerms(me, egWeight);
    s += pawnDefenseBonus;

    return s;
  }

  const whiteBase = baseEvalSide(white, whitePawnDefenseBonus, endgameWeight);
  const blackBase = baseEvalSide(black, blackPawnDefenseBonus, endgameWeight);

  let whiteScore = whiteBase;
  let blackScore = blackBase;

  // Add relational endgame king terms when in endgame and one side is winning
  if (endgameWeight > 0.5) {
    if (whiteBase > blackBase + 100) {
      whiteScore += endgameKingRace(white, black) * endgameWeight;
    } else if (blackBase > whiteBase + 100) {
      blackScore += endgameKingRace(black, white) * endgameWeight;
    }
  }

  // ================== MATERIAL vs POSITION SPLIT ======================

  // 1) Pure material, adjusted by loose-piece “tactical” penalties
  const whiteMat = white.material - white.loosePiecePenalty;
  const blackMat = black.material - black.loosePiecePenalty;
  const materialDiff = whiteMat - blackMat;

  // 2) Everything else is "positional"
  const whitePos = whiteScore - white.material;
  const blackPos = blackScore - black.material;
  let positionalDiff = whitePos - blackPos;

  // Hard clamp: positional factors may NEVER outweigh a pawn.
  const MAX_POSITIONAL = 40;
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
