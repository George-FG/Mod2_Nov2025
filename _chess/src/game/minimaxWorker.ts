// Web Worker for chess minimax AI - runs in separate thread
import { myMinimaxMove } from './myMinimax';
import { simpleEvaluate } from './evaluate';
import type { Board, PieceColor } from './types';

self.onmessage = function(e: MessageEvent) {
  const { board, color, depth, maxTime } = e.data as {
    board: Board;
    color: PieceColor;
    depth: number;
    maxTime: number;
  };

  const move = myMinimaxMove(board, color, depth, simpleEvaluate, maxTime);

  self.postMessage(move);
};
