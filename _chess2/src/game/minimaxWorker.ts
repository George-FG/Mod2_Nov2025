// Web Worker for chess minimax AI - runs in separate thread
import { myMinimaxMove as negamaxMove } from './negamax';
import { simpleEvaluate } from './evaluate';
import { evaluateOffensive } from './evaluateOffensive';
import { evaluateDefensive } from './evaluateDefensive';
import { evaluateSuicidal } from './evaluateSuicidal';
import { evaluate as evaluateAttempt2 } from './evaluateAttempt2';
import type { Board, PieceColor, CastlingRights } from './types';

type EvaluationType = 'balanced' | 'offensive' | 'defensive' | 'suicidal' | 'attempt2';

self.onmessage = function(e: MessageEvent) {
  const { board, color, depth, maxTime, evaluation = 'balanced', castlingRights, positionHistory } = e.data as {
    board: Board;
    color: PieceColor;
    depth: number;
    maxTime: number;
    evaluation?: EvaluationType;
    castlingRights?: CastlingRights;
    positionHistory?: string[];
  };

  // Select evaluation function and algorithm based on strategy
  let move;

  if (evaluation === 'attempt2') {
    // Use negamax with transposition table for attempt2
    move = negamaxMove(board, color, depth, evaluateAttempt2, maxTime, castlingRights, positionHistory);
  } else {
    // Use standard minimax for other strategies
    let evaluateFunction;

    switch (evaluation) {
      case 'offensive':
        evaluateFunction = evaluateOffensive;
        break;
      case 'defensive':
        evaluateFunction = evaluateDefensive;
        break;
      case 'suicidal':
        evaluateFunction = evaluateSuicidal;
        break;
      case 'balanced':
      default:
        evaluateFunction = simpleEvaluate;
        break;
    }

    move = negamaxMove(board, color, depth, evaluateFunction, maxTime, castlingRights, positionHistory);
  }

  self.postMessage(move);
};
