import { useState } from 'react';
import './App.css';
import ChessBoard from './ChessBoard';
import GameSetup, { type GameSetupOptions } from './GameSetup';

function App() {
  const [gameOptions, setGameOptions] = useState<GameSetupOptions | null>(null);

  const handleStartGame = (options: GameSetupOptions) => {
    setGameOptions(options);
  };

  const handleBackToSetup = () => {
    setGameOptions(null);
  };

  if (!gameOptions) {
    return <GameSetup onStartGame={handleStartGame} />;
  }

  return (
    <>
      <header className="app-header">
        <button
          onClick={handleBackToSetup}
          className="new-game-button"
        >
          ← New Game
        </button>
        <h1>Chess by Furious George</h1>
        <div className="game-info">
          White: {gameOptions.whitePlayer === 'human' ? '👤 Human' : '🤖 AI'} vs Black: {gameOptions.blackPlayer === 'human' ? '👤 Human' : '🤖 AI'}
        </div>
      </header>
      <ChessBoard gameOptions={gameOptions} />
    </>
  );
}

export default App;
