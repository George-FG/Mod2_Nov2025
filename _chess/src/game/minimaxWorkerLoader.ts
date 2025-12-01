// Loader to run minimax in a Web Worker from the main thread
// Usage: call runMinimaxInWorker({ board, color, depth, maxTime, evaluation })

import type { Board, PieceColor, Move } from './types';

export type EvaluationType = 'balanced' | 'offensive' | 'defensive';

// For Vite with module workers
export function runMinimaxInWorker({ 
  board, 
  color, 
  depth, 
  maxTime,
  evaluation = 'balanced'
}: { 
  board: Board; 
  color: PieceColor; 
  depth: number; 
  maxTime: number;
  evaluation?: EvaluationType;
}): Promise<Move | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./minimaxWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ board, color, depth, maxTime, evaluation });
  });
}
