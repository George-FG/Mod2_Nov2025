// Web Worker for chess minimax AI - runs in separate thread
import { myMinimaxMove } from './myMinimax';
import { simpleEvaluate } from './evaluate';
import { evaluateOffensive } from './evaluateOffensive';
import { evaluateDefensive } from './evaluateDefensive';
import { evaluateSuicidal } from './evaluateSuicidal';
import { evaluateAttempt2 } from './evaluateAttempt2';
import type { Board, PieceColor, CastlingRights } from './types';

type EvaluationType = 'balanced' | 'offensive' | 'defensive' | 'suicidal' | 'attempt2';

self.onmessage = function(e: MessageEvent) {
  const { board, color, depth, maxTime, evaluation = 'balanced', castlingRights } = e.data as {
    board: Board;
    color: PieceColor;
    depth: number;
    maxTime: number;
    evaluation?: EvaluationType;
    castlingRights?: CastlingRights;
  };

  // Select evaluation function based on strategy
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
    case 'attempt2':
      evaluateFunction = evaluateAttempt2;
      break;
    case 'balanced':
    default:
      evaluateFunction = simpleEvaluate;
      break;
  }

  const move = myMinimaxMove(board, color, depth, evaluateFunction, maxTime, castlingRights);

  self.postMessage(move);
};
