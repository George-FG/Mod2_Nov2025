// This is a plain JS worker for chess minimax AI
// (Use .js for compatibility with Vite/CRA build tools)
importScripts('myMinimax.js');

onmessage = function(e) {
  const { board, color, depth, maxTime } = e.data;
  // myMinimaxMove must be available globally (imported above)
  const move = self.myMinimaxMove(board, color, depth, simpleEvaluate, maxTime);
  postMessage(move);
};
