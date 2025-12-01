import type { Board, PieceColor, Move } from './types';
import { myMinimaxMove } from './myMinimax';

/**
 * Wraps the synchronous minimax in a Promise that yields to the event loop
 * This allows the UI to remain responsive during AI calculation
 */
export function asyncMinimaxMove(
  board: Board,
  color: PieceColor,
  depth: number,
  evaluate: (board: Board, color: PieceColor) => number,
  maxTime?: number
): Promise<Move | null> {
  return new Promise((resolve) => {
    // Use setImmediate if available (Node), otherwise setTimeout
    const schedule = typeof setImmediate !== 'undefined' ? setImmediate : (fn: () => void) => setTimeout(fn, 0);
    
    schedule(() => {
      const result = myMinimaxMove(board, color, depth, evaluate, maxTime);
      resolve(result);
    });
  });
}
