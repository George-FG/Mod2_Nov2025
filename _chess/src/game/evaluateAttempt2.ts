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

// ---------- Piece-Square Tables (from “normal” white POV) ----------
// These assume white home rank is at the bottom (row 7).
// Your board has white home at row 0, so we index with [7 - row][col].

const PST_PAWN_MG = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 5, -5, -5,  5,  5, -5, -5,  5],
  [ 0,  0,  0, 20, 20,  0,  0,  0],
  [ 5,  5, 10, 25, 25, 10,  5,  5],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];

const PST_PAWN_EG = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [10, 10, 10, 15, 15, 10, 10, 10],
  [ 5,  5, 10, 20, 20, 10,  5,  5],
  [ 0,  0,  5, 15, 15,  5,  0,  0],
  [ 0,  0,  0, 10, 10,  0,  0,  0],
  [ 0,  0,  0,  5,  5,  0,  0,  0],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];

const PST_KNIGHT = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

const PST_BISHOP = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];

const PST_ROOK = [
  [ 0,  0,  0,  5,  5,  0,  0,  0],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [ 5, 10, 10, 10, 10, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];

const PST_QUEEN = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
];

// King PST: we will ONLY use this in the endgame, not in midgame.
const PST_KING_EG = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50],
];

// ------------- Phase values (tapered eval) -------------------------

const PHASE_VALUES: Record<string, number> = {
  p: 0,
  n: 1,
  b: 1,
  r: 2,
  q: 4,
  k: 0,
};

const FULL_PHASE = 24;

// --------- Heuristic weights (centipawns) ---------------------------

const W = {
  // Pawn structure
  doubledPawn: -15,
  isolatedPawn: -12,
  centralPawnBonus: 6,
  pawnChainBonus: 4,
  passedPawnBase: 15,
  passedPawnPerRank: 2,

  // Pieces / dev
  bishopPair: 25,
  minorDev: 8,
  rookDev: 5,
  earlyQueenPenalty: -12,

  // King – very strict in opening/middlegame
  castlingBonus: 100,
  kingCentralPenalty: -25,        // per step from edge (files b–g)
  kingAdvancePenalty: -40,        // per rank away from home
  kingShieldPenalty: -15,         // per missing pawn in front
  kingMovedBeforeCastling: -400,  // huge: king off start & not castled
};

// ----------------- Helper types -------------------------------------

type SideStats = {
  color: PieceColor;
  material: number;
  mgPos: number;
  egPos: number;
  nonPawnMaterial: number;
  queenCount: number;

  pawnCountByFile: number[];
  pawnPresenceByFile: boolean[];
  pawnMap: boolean[][];

  centralPawns: number;
  pawnChains: number;

  kingRow: number;
  kingCol: number;

  minorDev: number;
  rookDev: number;
  undevelopedMinorsOnBackRank: number;
  totalMinors: number;
  bishopCount: number;
  queenOnStart: boolean;
  queenOffStart: boolean;
};

function makeSide(color: PieceColor): SideStats {
  return {
    color,
    material: 0,
    mgPos: 0,
    egPos: 0,
    nonPawnMaterial: 0,
    queenCount: 0,

    pawnCountByFile: new Array<number>(8).fill(0),
    pawnPresenceByFile: new Array<boolean>(8).fill(false),
    pawnMap: Array.from({ length: 8 }, () => new Array<boolean>(8).fill(false)),

    centralPawns: 0,
    pawnChains: 0,

    kingRow: -1,
    kingCol: -1,

    minorDev: 0,
    rookDev: 0,
    undevelopedMinorsOnBackRank: 0,
    totalMinors: 0,
    bishopCount: 0,
    queenOnStart: false,
    queenOffStart: false,
  };
}

// In your board: row 0 = white home, row 7 = black home.
// PSTs assume white home at row 7 → always index [7 - row][col].
function pstIndex(row: number, col: number): [number, number] {
  return [7 - row, col];
}

// ----------------------- Main evaluation ----------------------------

export function evaluate(board: Board, color: PieceColor): number {
  const white = makeSide('white');
  const black = makeSide('black');

  let phase = FULL_PHASE;

  // -------- First pass: material, PSTs (no king PST midgame), stats ----
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) continue;

      const side = piece.color === 'white' ? white : black;
      const isWhite = piece.color === 'white';
      const value = PIECE_VALUES[piece.type];
      const [pr, pc] = pstIndex(row, col);
      const rankFromOwnSide = isWhite ? row : 7 - row; // 0 = home rank

      side.material += value;
      if (piece.type !== 'p' && piece.type !== 'k') {
        side.nonPawnMaterial += value;
      }
      if (piece.type === 'q') {
        side.queenCount++;
      }

      phase -= PHASE_VALUES[piece.type];

      switch (piece.type) {
        case 'p':
          side.mgPos += PST_PAWN_MG[pr][pc];
          side.egPos += PST_PAWN_EG[pr][pc];
          break;
        case 'n':
          side.mgPos += PST_KNIGHT[pr][pc];
          side.egPos += PST_KNIGHT[pr][pc] / 2;
          break;
        case 'b':
          side.mgPos += PST_BISHOP[pr][pc];
          side.egPos += PST_BISHOP[pr][pc];
          break;
        case 'r':
          side.mgPos += PST_ROOK[pr][pc];
          side.egPos += PST_ROOK[pr][pc];
          break;
        case 'q':
          side.mgPos += PST_QUEEN[pr][pc];
          side.egPos += PST_QUEEN[pr][pc];
          break;
        case 'k':
          // IMPORTANT: no king PST in middlegame; only in endgame
          side.egPos += PST_KING_EG[pr][pc];
          break;
      }

      // Extra stats
      switch (piece.type) {
        case 'k': {
          side.kingRow = row;
          side.kingCol = col;
          break;
        }

        case 'p': {
          side.pawnCountByFile[col]++;
          side.pawnPresenceByFile[col] = true;
          side.pawnMap[row][col] = true;

          const isCentralFile = col === 3 || col === 4; // d/e

          if (isCentralFile && rankFromOwnSide >= 2 && rankFromOwnSide <= 4) {
            side.centralPawns++;
          }
          break;
        }

        case 'n':
        case 'b': {
          side.totalMinors++;
          const developed = rankFromOwnSide > 0;

          if (developed) side.minorDev++;
          else side.undevelopedMinorsOnBackRank++;
          if (piece.type === 'b') side.bishopCount++;
          break;
        }

        case 'r': {
          const developed = rankFromOwnSide > 0;

          if (developed) side.rookDev++;
          break;
        }

        case 'q': {
          const onStart =
            (isWhite && row === 0 && col === 3) ||
            (!isWhite && row === 7 && col === 3);

          if (onStart) side.queenOnStart = true;
          else side.queenOffStart = true;
          break;
        }
      }
    }
  }

  if (phase < 0) phase = 0;
  if (phase > FULL_PHASE) phase = FULL_PHASE;

  const mgPhase = phase;
  const egPhase = FULL_PHASE - mgPhase;
  const mgWeight = mgPhase / FULL_PHASE;

  const totalNonPawnMaterial = white.nonPawnMaterial + black.nonPawnMaterial;
  const queensOnBoard = white.queenCount + black.queenCount > 0;

  // -------- Pawn chains ------------------------------------------------

  function computePawnChains(side: SideStats) {
    let chains = 0;
    const isWhite = side.color === 'white';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (!side.pawnMap[row][col]) continue;

        // Behind toward home rank:
        // white home = 0 → behind = row - 1
        // black home = 7 → behind = row + 1
        const behindRow = isWhite ? row - 1 : row + 1;

        if (behindRow < 0 || behindRow > 7) continue;

        if (
          (col > 0 && side.pawnMap[behindRow][col - 1]) ||
          (col < 7 && side.pawnMap[behindRow][col + 1])
        ) {
          chains++;
        }
      }
    }

    side.pawnChains = chains;
  }

  computePawnChains(white);
  computePawnChains(black);

  // -------- Pawn structure ---------------------------------------------

  function pawnStructure(me: SideStats, opp: SideStats): number {
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

    score += me.centralPawns * W.centralPawnBonus;
    score += me.pawnChains * W.pawnChainBonus;

    // Passed pawns (smallish)
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (!me.pawnMap[row][col]) continue;

        const isWhite = me.color === 'white';
        let blocked = false;
        let rankFromOwnSide: number;

        if (isWhite) {
          // white moves to higher rows
          rankFromOwnSide = row;
          for (let r = row + 1; r < 8; r++) {
            for (let dc = -1; dc <= 1; dc++) {
              const c = col + dc;

              if (c < 0 || c > 7) continue;
              if (opp.pawnMap[r][c]) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
        } else {
          // black moves to lower rows
          rankFromOwnSide = 7 - row;
          for (let r = row - 1; r >= 0; r--) {
            for (let dc = -1; dc <= 1; dc++) {
              const c = col + dc;

              if (c < 0 || c > 7) continue;
              if (opp.pawnMap[r][c]) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
        }

        if (!blocked) {
          const bonus =
            W.passedPawnBase + rankFromOwnSide * W.passedPawnPerRank;

          score += bonus;
        }
      }
    }

    return score;
  }

  // -------- Development / bishop pair / early queen --------------------

  function developmentAndPieces(me: SideStats): number {
    let score = 0;

    score += me.minorDev * W.minorDev;
    score += me.rookDev * W.rookDev;

    if (me.bishopCount >= 2) {
      score += W.bishopPair;
    }

    if (me.queenOffStart && me.undevelopedMinorsOnBackRank >= 2) {
      score += W.earlyQueenPenalty;
    }

    return score;
  }

  // -------- King safety – the big hammer --------------------------------

  function kingSafety(me: SideStats): number {
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

    // Consider it "real middlegame" if there is nontrivial material and often queens
    const inRealMiddlegame =
      mgWeight > 0.25 && (queensOnBoard || totalNonPawnMaterial > 1200);

    if (inRealMiddlegame) {
      if (castled) {
        score += W.castlingBonus;
      } else {
        // HUGE penalty if king left its starting square and isn't castled
        if (!onStartSquare) {
          score += W.kingMovedBeforeCastling;
        }

        // Penalise centralisation (king used as a defender, etc.)
        const fileFromEdge = Math.min(col, 7 - col); // 0 at a/h, up to 3 in center

        score += fileFromEdge * W.kingCentralPenalty;

        // Penalise rank advance (walking up board)
        const ranksAdvanced = isWhite
          ? Math.max(0, row - homeRank)
          : Math.max(0, homeRank - row);

        score += ranksAdvanced * W.kingAdvancePenalty;

        // Pawn shield: missing pawns in front
        const pawnRow = isWhite ? row + 1 : row - 1;

        if (pawnRow >= 0 && pawnRow < 8) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;

            if (c < 0 || c > 7) continue;
            if (!me.pawnMap[pawnRow][c]) {
              score += W.kingShieldPenalty;
            }
          }
        }
      }
    }

    // Endgame king activity is handled by PST_KING_EG we already added.

    return score;
  }

  // -------- Combine material + positional per side ----------------------

  function evalSide(me: SideStats, opp: SideStats) {
    let mg = me.mgPos;
    let eg = me.egPos;

    const pawnScore = pawnStructure(me, opp);

    mg += pawnScore;
    eg += pawnScore;

    const devScore = developmentAndPieces(me);

    mg += devScore;
    eg += devScore * 0.5;

    const kingScore = kingSafety(me);

    mg += kingScore;

    mg += me.material;
    eg += me.material;

    return { mg, eg };
  }

  const whiteEval = evalSide(white, black);
  const blackEval = evalSide(black, white);

  const whiteScore =
    (whiteEval.mg * mgPhase + whiteEval.eg * egPhase) / FULL_PHASE;
  const blackScore =
    (blackEval.mg * mgPhase + blackEval.eg * egPhase) / FULL_PHASE;

  const diff = whiteScore - blackScore;

  // Return from the perspective of `color`
  return color === 'white' ? diff : -diff;
}
