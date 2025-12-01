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
      <header style={{ textAlign: 'center', marginTop: '1.5rem', position: 'relative' }}>
        <button
          onClick={handleBackToSetup}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '0',
            padding: '0.5rem 1rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          ← New Game
        </button>
        <h1 style={{ margin: 0 }}>Chess</h1>
        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          White: {gameOptions.whitePlayer === 'human' ? '👤 Human' : '🤖 AI'} vs Black: {gameOptions.blackPlayer === 'human' ? '👤 Human' : '🤖 AI'}
        </div>
      </header>
      <ChessBoard gameOptions={gameOptions} />
    </>
  );
}

export default App;
