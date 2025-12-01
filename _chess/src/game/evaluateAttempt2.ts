import type { Board, PieceColor } from './types';

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Starting material for one side (used just for normalization at the end)
const STARTING_MATERIAL =
  8 * 100 + 2 * 320 + 2 * 330 + 2 * 500 + 1 * 900; // 3900

// ---------- Piece-Square Tables (midgame / endgame) ----------
// Values are in centipawns, from White's point of view.
// Board indexing: row 0 = rank 8, row 7 = rank 1.

const pstPawnMg = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],  // White back rank (pawns shouldn't be here)
  [ 5, 10, 10,-20,-20, 10, 10,  5],  // White pawn starting row
  [ 5, -5, -5,  5,  5, -5, -5,  5],
  [ 0,  0,  0, 20, 20,  0,  0,  0],
  [ 5,  5, 10, 25, 25, 10,  5,  5],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [50, 50, 50, 50, 50, 50, 50, 50],  // Near promotion for white
  [ 0,  0,  0,  0,  0,  0,  0,  0],  // Black back rank
];

const pstPawnEg = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 0,  0,  0,  5,  5,  0,  0,  0],
  [ 0,  0,  0, 10, 10,  0,  0,  0],
  [ 0,  0,  5, 15, 15,  5,  0,  0],
  [ 5,  5, 10, 20, 20, 10,  5,  5],
  [10, 10, 10, 15, 15, 10, 10, 10],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];

const pstKnight = [
  [-50,-40,-30,-30,-30,-30,-40,-50],  // White back rank
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],  // Black back rank
];

const pstBishop = [
  [-20,-10,-10,-10,-10,-10,-10,-20],  // White back rank
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],  // Black back rank
];

const pstRook = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],  // White back rank
  [ 5, 10, 10, 10, 10, 10, 10,  5],  // 7th rank bonus for white
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [-5,  0,  0,  0,  0,  0,  0,-5],
  [ 0,  0,  0,  5,  5,  0,  0,  0],  // Black back rank
];

const pstQueen = [
  [-20,-10,-10, -5, -5,-10,-10,-20],  // White back rank
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],  // Black back rank
];

const pstKingMg = [
  [ 40, 60, 20,  0,  0, 20, 60, 40],  // White's back rank (row 0)
  [ 30, 30,-20,-20,-20,-20, 30, 30],  // One square forward
  [-40,-40,-40,-40,-40,-40,-40,-40],
  [-50,-50,-50,-50,-50,-50,-50,-50],
  [-50,-50,-50,-50,-50,-50,-50,-50],
  [-50,-50,-50,-50,-50,-50,-50,-50],
  [-50,-50,-50,-50,-50,-50,-50,-50],
  [-50,-50,-50,-50,-50,-50,-50,-50],  // Black's back rank (row 7)
];

const pstKingEg = [
  [-50,-30,-30,-30,-30,-30,-30,-50],  // White back rank
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-50,-40,-30,-20,-20,-30,-40,-50],  // Black back rank
];

// Phase weights for tapered eval (standard-ish)
const PHASE_VALUES: Record<string, number> = {
  p: 0,
  n: 1,
  b: 1,
  r: 2,
  q: 4,
  k: 0,
};

const FULL_PHASE = 24; // 4*queen + 4*rooks + 4*bishops + 4*knights = 24

// ------- Helper types / small structs --------------------------------

type SideStats = {
  color: PieceColor;
  material: number;
  mgPos: number; // midgame positional sum from PST + features
  egPos: number; // endgame positional sum
  nonPawnMaterial: number;

  // Pawn structure
  pawnCountByFile: number[];
  pawnPresenceByFile: boolean[];
  pawnMap: boolean[][]; // [row][col] has own pawn
  pawnIsCentral: number;
  pawnChains: number;

  // King
  kingRow: number;
  kingCol: number;

  // Development / pieces
  minorDev: number;
  rookDev: number;
  undevelopedMinorsOnBackRank: number;
  totalMinors: number;
  bishopCount: number;
  queenOnStart: boolean;
  queenOffStart: boolean;
  rookFiles: number[];

  // Mobility and piece interactions
  totalMobility: number;
  attackingSquares: number;
  defendingPieces: number;
  multipleAttackers: number;
};

function makeSide(color: PieceColor): SideStats {
  return {
    color,
    material: 0,
    mgPos: 0,
    egPos: 0,
    nonPawnMaterial: 0,

    pawnCountByFile: new Array<number>(8).fill(0),
    pawnPresenceByFile: new Array<boolean>(8).fill(false),
    pawnMap: Array.from({ length: 8 }, () => new Array<boolean>(8).fill(false)),
    pawnIsCentral: 0,
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
    rookFiles: [],

    totalMobility: 0,
    attackingSquares: 0,
    defendingPieces: 0,
    multipleAttackers: 0,
  };
}

// Mirror PST row for black
function pstIndex(pieceColor: PieceColor, row: number, col: number): [number, number] {
  return pieceColor === 'white' ? [row, col] : [7 - row, col];
}

// Weights for extra features (small, so material dominates)
const W = {
  doubledPawn: -15,
  isolatedPawn: -12,
  centralPawnBonus: 6,
  pawnChainBonus: 4,
  passedPawnBase: 15,
  passedPawnPerRank: 2,

  bishopPair: 25,

  minorDevelopment: 10,
  rookDevelopment: 6,
  earlyQueenPenalty: -15,

  castlingBonus: 500,
  kingExposurePenalty: -200,
  kingCentralMidgamePenalty: -150,
  kingMovedEarlyPenalty: -100,

  // Mobility and piece interactions
  mobilityPerMove: 2,
  attackerBonus: 3,
  defenderBonus: 2,
  multipleAttackerBonus: 5,

  // Castling incentive bonus (applied when castling is still possible)
  castlingAvailableBonus: 30,
};

// Helper: Get pseudo-legal moves for a piece at (row, col)
function getPieceMobility(board: Board, row: number, col: number, piece: { type: string; color: PieceColor }): number {
  let mobility = 0;

  const isWhite = piece.color === 'white';
  const forward = isWhite ? -1 : 1;

  switch (piece.type) {
    case 'p': {
      // Pawns: forward moves and captures
      const nextRow = row + forward;

      if (nextRow >= 0 && nextRow < 8) {
        // Forward
        if (!board[nextRow][col]) mobility++;
        // Double push from starting position
        const startRow = isWhite ? 6 : 1;

        if (row === startRow && !board[nextRow][col]) {
          const doubleRow = row + 2 * forward;

          if (!board[doubleRow][col]) mobility++;
        }
        // Captures
        if (col > 0 && board[nextRow][col - 1] && board[nextRow][col - 1]!.color !== piece.color) mobility++;
        if (col < 7 && board[nextRow][col + 1] && board[nextRow][col + 1]!.color !== piece.color) mobility++;
      }
      break;
    }

    case 'n': {
      // Knight moves
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];

      for (const [dr, dc] of knightMoves) {
        const r = row + dr;
        const c = col + dc;

        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = board[r][c];

          if (!target || target.color !== piece.color) mobility++;
        }
      }
      break;
    }

    case 'b': {
      // Bishop: diagonals
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = board[r][c];

          if (!target) {
            mobility++;
          } else {
            if (target.color !== piece.color) mobility++;
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }

    case 'r': {
      // Rook: straight lines
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = board[r][c];

          if (!target) {
            mobility++;
          } else {
            if (target.color !== piece.color) mobility++;
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }

    case 'q': {
      // Queen: all 8 directions
      const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = board[r][c];

          if (!target) {
            mobility++;
          } else {
            if (target.color !== piece.color) mobility++;
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }

    case 'k': {
      // King: adjacent squares
      const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

      for (const [dr, dc] of dirs) {
        const r = row + dr;
        const c = col + dc;

        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = board[r][c];

          if (!target || target.color !== piece.color) mobility++;
        }
      }
      break;
    }
  }

  return mobility;
}

// Helper: Build attack/defend maps for piece interactions
function buildAttackDefendMaps(board: Board, color: PieceColor) {
  const attacked = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const defended = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece || piece.color !== color) continue;

      const isWhite = piece.color === 'white';
      const forward = isWhite ? -1 : 1;

      const targets: [number, number][] = [];

      switch (piece.type) {
        case 'p': {
          // Pawns attack diagonally
          const nextRow = row + forward;

          if (nextRow >= 0 && nextRow < 8) {
            if (col > 0) targets.push([nextRow, col - 1]);
            if (col < 7) targets.push([nextRow, col + 1]);
          }
          break;
        }

        case 'n': {
          const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
          ];

          for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;

            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
              targets.push([r, c]);
            }
          }
          break;
        }

        case 'b': {
          const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

          for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;

            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
              targets.push([r, c]);
              if (board[r][c]) break;
              r += dr;
              c += dc;
            }
          }
          break;
        }

        case 'r': {
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

          for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;

            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
              targets.push([r, c]);
              if (board[r][c]) break;
              r += dr;
              c += dc;
            }
          }
          break;
        }

        case 'q': {
          const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

          for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;

            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
              targets.push([r, c]);
              if (board[r][c]) break;
              r += dr;
              c += dc;
            }
          }
          break;
        }

        case 'k': {
          const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

          for (const [dr, dc] of dirs) {
            const r = row + dr;
            const c = col + dc;

            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
              targets.push([r, c]);
            }
          }
          break;
        }
      }

      // Mark attacked/defended squares
      for (const [r, c] of targets) {
        const target = board[r][c];

        if (target) {
          if (target.color !== color) {
            attacked[r][c]++;
          } else {
            defended[r][c]++;
          }
        }
      }
    }
  }

  return { attacked, defended };
}

export function evaluateAttempt2(board: Board, color: PieceColor): number {
  const white = makeSide('white');
  const black = makeSide('black');

  let phase = FULL_PHASE;

  // -------- First pass: material, PST, king, basic structure -------------

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) continue;

      const side = piece.color === 'white' ? white : black;
      const value = pieceValues[piece.type];
      const isWhite = piece.color === 'white';
      const [pr, pc] = pstIndex(piece.color, row, col);

      // tableRow: from this side's POV (0 = home rank, 7 = promotion)
      const tableRow = isWhite ? 7 - row : row;

      // Material
      side.material += value;
      if (piece.type !== 'p' && piece.type !== 'k') {
        side.nonPawnMaterial += value;
      }

      // Phase (for tapered eval)
      phase -= PHASE_VALUES[piece.type];

      // Mobility
      const mobility = getPieceMobility(board, row, col, piece);

      side.totalMobility += mobility;

      // PST contributions
      switch (piece.type) {
        case 'p':
          side.mgPos += pstPawnMg[pr][pc];
          side.egPos += pstPawnEg[pr][pc];
          break;
        case 'n':
          side.mgPos += pstKnight[pr][pc];
          side.egPos += pstKnight[pr][pc] / 2; // knights a bit worse in endgame
          break;
        case 'b':
          side.mgPos += pstBishop[pr][pc];
          side.egPos += pstBishop[pr][pc];
          break;
        case 'r':
          side.mgPos += pstRook[pr][pc];
          side.egPos += pstRook[pr][pc];
          break;
        case 'q':
          side.mgPos += pstQueen[pr][pc];
          side.egPos += pstQueen[pr][pc];
          break;
        case 'k':
          side.mgPos += pstKingMg[pr][pc];
          side.egPos += pstKingEg[pr][pc];
          break;
      }

      // Additional structural info
      switch (piece.type) {
        case 'k':
          side.kingRow = row;
          side.kingCol = col;
          break;

        case 'p': {
          side.pawnCountByFile[col]++;
          side.pawnPresenceByFile[col] = true;
          side.pawnMap[row][col] = true;

          const isCentralFile = col === 3 || col === 4; // d/e

          if (isCentralFile && tableRow >= 2 && tableRow <= 4) {
            side.pawnIsCentral++;
          }

          const behindRow = isWhite ? row + 1 : row - 1;

          if (behindRow >= 0 && behindRow < 8) {
            if (
              (col > 0 && side.pawnMap[behindRow][col - 1]) ||
              (col < 7 && side.pawnMap[behindRow][col + 1])
            ) {
              side.pawnChains++;
            }
          }
          break;
        }

        case 'n':
        case 'b': {
          side.totalMinors++;
          const developed = tableRow > 0;

          if (developed) {
            side.minorDev++;
          } else {
            side.undevelopedMinorsOnBackRank++;
          }
          if (piece.type === 'b') side.bishopCount++;
          break;
        }

        case 'r':
          side.rookDev += tableRow > 0 ? 1 : 0;
          side.rookFiles.push(col);
          break;

        case 'q': {
          const onStart =
            (isWhite && row === 7 && col === 3) ||
            (!isWhite && row === 0 && col === 3);

          if (onStart) side.queenOnStart = true;
          else side.queenOffStart = true;
          break;
        }
      }
    }
  }

  if (phase < 0) phase = 0;
  if (phase > FULL_PHASE) phase = FULL_PHASE;

  // ---------- Second pass: piece interactions (attack/defend) ----------

  const whiteAttackDefend = buildAttackDefendMaps(board, 'white');
  const blackAttackDefend = buildAttackDefendMaps(board, 'black');

  // Count attacking and defending for both sides
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];

      if (!piece) {
        continue;
      }

      // White's attack on black pieces and white's defense of white pieces
      const whiteAttackCount = whiteAttackDefend.attacked[row][col];
      const whiteDefendCount = whiteAttackDefend.defended[row][col];
      
      if (piece.color === 'black' && whiteAttackCount > 0) {
        white.attackingSquares += whiteAttackCount;
        if (whiteAttackCount > 1) white.multipleAttackers++;
      }
      if (piece.color === 'white' && whiteDefendCount > 0) {
        white.defendingPieces++;
      }

      // Black's attack on white pieces and black's defense of black pieces
      const blackAttackCount = blackAttackDefend.attacked[row][col];
      const blackDefendCount = blackAttackDefend.defended[row][col];
      
      if (piece.color === 'white' && blackAttackCount > 0) {
        black.attackingSquares += blackAttackCount;
        if (blackAttackCount > 1) black.multipleAttackers++;
      }
      if (piece.color === 'black' && blackDefendCount > 0) {
        black.defendingPieces++;
      }
    }
  }

  // ---------- Pawn structure: doubled / isolated / passed -------------

  function pawnStructure(me: SideStats, opp: SideStats): number {
    let score = 0;

    // doubled / isolated
    for (let file = 0; file < 8; file++) {
      const count = me.pawnCountByFile[file];

      if (count > 1) {
        score += (count - 1) * W.doubledPawn;
      }
      if (count > 0) {
        const hasNeighbor =
          (file > 0 && me.pawnPresenceByFile[file - 1]) ||
          (file < 7 && me.pawnPresenceByFile[file + 1]);

        if (!hasNeighbor) {
          score += W.isolatedPawn;
        }
      }
    }

    // central pawns & pawn chains
    score += me.pawnIsCentral * W.centralPawnBonus;
    score += me.pawnChains * W.pawnChainBonus;

    // modest passed pawn bonus (so it won't overpush in shallow search)
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (!me.pawnMap[row][col]) continue;
        const isWhite = me.color === 'white';

        let blocked = false;
        let rankFromOwnSide: number;

        if (isWhite) {
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
        } else {
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

  // ---------- Development / bishop pair / early queen ----------------

  function developmentAndPieces(me: SideStats): number {
    let score = 0;

    // basic dev
    score += me.minorDev * W.minorDevelopment;
    score += me.rookDev * W.rookDevelopment;

    // bishop pair
    if (me.bishopCount >= 2) {
      score += W.bishopPair;
    }

    // early queen penalty: queen out while many minors undeveloped
    if (me.queenOffStart && me.undevelopedMinorsOnBackRank >= 2) {
      score += W.earlyQueenPenalty;
    }

    return score;
  }

  // ---------- King safety & castling-ish bonus ------------------------

  function kingAndSafety(me: SideStats, mgWeight: number) {
    let mg = 0;
    const eg = 0;

    if (me.kingRow === -1) return { mg, eg };

    const row = me.kingRow;
    const col = me.kingCol;

    // Approximate "castled" detection: king on g/c file on home rank
    let castled = false;

    if (me.color === 'white' && row === 0 && (col === 6 || col === 2)) {
      castled = true;
    }
    if (me.color === 'black' && row === 7 && (col === 6 || col === 2)) {
      castled = true;
    }

    if (castled) {
      mg += W.castlingBonus;
    } else {
      // Penalize uncastled king in midgame
      // Check if king has moved from starting position
      const startRow = me.color === 'white' ? 0 : 7;
      const hasMovedFromStart = row !== startRow || col !== 4;
      
      // Apply penalties even in early midgame
      if (hasMovedFromStart && mgWeight > 0.2) {
        // King moved but didn't castle - massive penalty in midgame
        mg += W.kingExposurePenalty * mgWeight;
        
        // Extra penalty if king is central/exposed (not on edges)
        const distFromCenter = Math.max(Math.abs(row - 3.5), Math.abs(col - 3.5));

        if (distFromCenter < 3) {
          mg += W.kingCentralMidgamePenalty * mgWeight;
        }
        
        // Additional penalty for moving king off back rank in opening/midgame
        if (row !== startRow && mgWeight > 0.3) {
          mg += W.kingMovedEarlyPenalty * mgWeight * 1.5;
        }
        
        // Huge penalty if king moves forward multiple ranks
        if (Math.abs(row - startRow) > 1) {
          mg += W.kingMovedEarlyPenalty * 2 * mgWeight;
        }
      } else if (!hasMovedFromStart && mgWeight > 0.4) {
        // King hasn't moved at all in midgame - penalty for not castling yet
        mg += W.kingExposurePenalty * 0.4 * mgWeight;
      }
    }

    return { mg, eg };
  }

  // ---------- Evaluate both sides: midgame & endgame scores ------------

  function evalSide(me: SideStats, opp: SideStats) {
    // base positional from PST
    let mg = me.mgPos;
    let eg = me.egPos;

    // pawn structure
    const pawnStruct = pawnStructure(me, opp);

    mg += pawnStruct;
    eg += pawnStruct;

    // development / bishop pair / early queen
    const dev = developmentAndPieces(me);

    mg += dev;
    eg += dev * 0.5; // dev matters less in deep endgame

    // mobility
    mg += me.totalMobility * W.mobilityPerMove;
    eg += me.totalMobility * W.mobilityPerMove * 1.2; // mobility more important in endgame

    // piece interactions
    mg += me.attackingSquares * W.attackerBonus;
    mg += me.defendingPieces * W.defenderBonus;
    mg += me.multipleAttackers * W.multipleAttackerBonus;

    // king safety / activity
    const ks = kingAndSafety(me, phase / FULL_PHASE);

    mg += ks.mg;
    eg += ks.eg;

    return {
      mg: me.material + mg,
      eg: me.material + eg,
    };
  }

  const whiteEval = evalSide(white, black);
  const blackEval = evalSide(black, white);

  // Tapered eval: blend midgame and endgame based on phase
  const mgPhase = phase;
  const egPhase = FULL_PHASE - mgPhase;

  const whiteScore =
    (whiteEval.mg * mgPhase + whiteEval.eg * egPhase) / FULL_PHASE;
  const blackScore =
    (blackEval.mg * mgPhase + blackEval.eg * egPhase) / FULL_PHASE;

  const myScore = color === 'white' ? whiteScore : blackScore;
  const oppScore = color === 'white' ? blackScore : whiteScore;

  const diff = myScore - oppScore;

  // normalize to something like [-1, 1] (optional)
  return diff / STARTING_MATERIAL;
}
