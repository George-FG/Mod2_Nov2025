import type { Board, PieceColor } from './types';

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
  centralPawnAdvance: 5,  // bonus for pawns on d/e files advanced a bit
  pawnAdvance: 2,         // small bonus for other pawn advances

  // Development / piece activity
  minorDev: 10,           // N/B off home rank
  rookDev: 6,             // rook off home rank
  centerKnight: 6,        // knight near centre
  centerBishop: 4,
  centerRook: 2,
  centerQueen: 2,

  bishopPair: 25,

  // King safety (opening / middlegame)
  castlingBonus: 120,         // strong preference to castle
  kingCentralPenalty: -20,    // per file step from edge (b–g)
  kingAdvancePenalty: -35,    // per rank away from home
  kingShieldPenalty: -12,     // per missing pawn in front
  kingMovedBeforeCastling: -400, // king off start square and not castled

  // King activity (pure endgame)
  kingCenterEndgame: 8,       // bonus per step towards centre
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
  };
}

// ----------------------- Main evaluation ----------------------------

export function evaluate(board: Board, color: PieceColor): number {
  const white = makeSide('white');
  const black = makeSide('black');

  // -------- First pass: material, simple piece activity, king pos, pawns ----

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
          // minor development
          if (rankFromHome > 0) side.minorDev++;
          // central knights
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

  // -------- Game phase detection ---------------------------------------

  const totalNonPawnMaterial = white.nonPawnMaterial + black.nonPawnMaterial;

  // crude thresholds
  const isEndgame = totalNonPawnMaterial <= 1000; // e.g. just a few minor pieces left

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

  // -------- Development / bishop pair ----------------------------------

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

  // -------- King safety / activity -------------------------------------

  function kingTerms(me: SideStats): number {
    let score = 0;
    if (me.kingRow === -1) return score;

    const row = me.kingRow;
    const col = me.kingCol;
    const isWhite = me.color === 'white';

    const homeRank = isWhite ? 0 : 7;
    const startFile = 4; // e-file
    const onHomeRank = row === homeRank;
    const onStartSquare = onHomeRank && col === startFile;
    const castled = onHomeRank && (col === 6 || col === 2);

    if (!isEndgame) {
      // opening / middlegame: very strict
      if (castled) {
        score += W.castlingBonus;
      } else {
        // If king left starting square and is not castled: huge penalty
        if (!onStartSquare) {
          score += W.kingMovedBeforeCastling;
        }

        // central file penalty (b–g bad)
        const fileFromEdge = Math.min(col, 7 - col); // 0 on a/h, 3 in centre
        score += fileFromEdge * W.kingCentralPenalty;

        // rank advance penalty (walking up the board)
        const ranksAdvanced = isWhite
          ? Math.max(0, row - homeRank)
          : Math.max(0, homeRank - row);
        score += ranksAdvanced * W.kingAdvancePenalty;

        // pawn shield in front of king
        const pawnRow = isWhite ? row + 1 : row - 1;
        if (pawnRow >= 0 && pawnRow < 8) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            if (c < 0 || c > 7) continue;

            // check if there is a pawn of same color there
            const front = board[pawnRow][c];
            if (!front || front.type !== 'p' || front.color !== me.color) {
              score += W.kingShieldPenalty;
            }
          }
        }
      }
    } else {
      // pure endgame: encourage king centralization
      const distFile = Math.abs(col - 3.5);
      const distRank = Math.abs(row - 3.5);
      const centerDist = Math.max(distFile, distRank);
      const centerBonus = (3.5 - centerDist) * W.kingCenterEndgame;
      score += centerBonus;
    }

    return score;
  }

  // -------- Combine for each side --------------------------------------

  function evalSide(me: SideStats): number {
    let s = 0;

    s += me.material;
    s += pawnStructure(me);
    s += developmentAndPieces(me);
    s += kingTerms(me);

    return s;
  }

  const whiteScore = evalSide(white);
  const blackScore = evalSide(black);

  const diff = whiteScore - blackScore;

  // Return from the perspective of `color`
  return color === 'white' ? diff : -diff;
}
