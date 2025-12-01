import React, { useState } from "react";
import "./GameSetup.css";

export type PlayerType = "human" | "ai";

export type EvaluationType = "balanced" | "offensive" | "defensive" | "suicidal" | "attempt2";

export interface AISettings {
  depth: number;
  maxTime: number;
  evaluation: EvaluationType;
}

export interface GameSetupOptions {
  whitePlayer: PlayerType;
  blackPlayer: PlayerType;
  whiteAI?: AISettings;
  blackAI?: AISettings;
  clockEnabled: boolean;
  initialTime: number;
}

interface GameSetupProps {
  onStartGame: (options: GameSetupOptions) => void;
}

const DEPTH_OPTIONS = Array.from({ length: 15 }, (_, i) => ({
  label: `${i + 1}`,
  value: i + 1,
}));

const MOVE_TIME_OPTIONS = [
  { label: "Instant", value: 0 },
  { label: "0.1s", value: 100 },
  { label: "0.25s", value: 250 },
  { label: "0.5s", value: 500 },
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
  { label: "8s", value: 8000 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
];

const CLOCK_TIME_OPTIONS = [
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "3 minutes", value: 180 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
];

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [whitePlayer, setWhitePlayer] = useState<PlayerType>("human");
  const [blackPlayer, setBlackPlayer] = useState<PlayerType>("ai");
  const [whiteAIDepth, setWhiteAIDepth] = useState<number>(2);
  const [whiteAIMaxTime, setWhiteAIMaxTime] = useState<number>(1000);
  const [whiteAIEvaluation, setWhiteAIEvaluation] = useState<EvaluationType>("balanced");
  const [blackAIDepth, setBlackAIDepth] = useState<number>(2);
  const [blackAIMaxTime, setBlackAIMaxTime] = useState<number>(1000);
  const [blackAIEvaluation, setBlackAIEvaluation] = useState<EvaluationType>("balanced");
  const [clockEnabled, setClockEnabled] = useState<boolean>(false);
  const [initialTime, setInitialTime] = useState<number>(300); // 5 minutes default

  const handleStartGame = () => {
    onStartGame({
      whitePlayer,
      blackPlayer,
      whiteAI: whitePlayer === "ai" ? { depth: whiteAIDepth, maxTime: whiteAIMaxTime, evaluation: whiteAIEvaluation } : undefined,
      blackAI: blackPlayer === "ai" ? { depth: blackAIDepth, maxTime: blackAIMaxTime, evaluation: blackAIEvaluation } : undefined,
      clockEnabled,
      initialTime,
    });
  };

  return (
    <div className="game-setup-container">
      <div className="game-setup-card">
        <h1>Chess Game Setup</h1>
        
        <div className="player-selection">
          <div className="player-option">
            <h2>White Player</h2>
            <div className="radio-group">
              <label className={whitePlayer === "human" ? "selected" : ""}>
                <input
                  type="radio"
                  name="white"
                  value="human"
                  checked={whitePlayer === "human"}
                  onChange={() => setWhitePlayer("human")}
                />
                <span>Human</span>
              </label>
              <label className={whitePlayer === "ai" ? "selected" : ""}>
                <input
                  type="radio"
                  name="white"
                  value="ai"
                  checked={whitePlayer === "ai"}
                  onChange={() => setWhitePlayer("ai")}
                />
                <span>AI</span>
              </label>
            </div>
          </div>

          <div className="vs-divider">VS</div>

          <div className="player-option">
            <h2>Black Player</h2>
            <div className="radio-group">
              <label className={blackPlayer === "human" ? "selected" : ""}>
                <input
                  type="radio"
                  name="black"
                  value="human"
                  checked={blackPlayer === "human"}
                  onChange={() => setBlackPlayer("human")}
                />
                <span>Human</span>
              </label>
              <label className={blackPlayer === "ai" ? "selected" : ""}>
                <input
                  type="radio"
                  name="black"
                  value="ai"
                  checked={blackPlayer === "ai"}
                  onChange={() => setBlackPlayer("ai")}
                />
                <span>AI</span>
              </label>
            </div>
          </div>
        </div>

        {(whitePlayer === "ai" || blackPlayer === "ai") && (
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
            {whitePlayer === "ai" && (
              <div className="ai-settings" style={{ minWidth: 180 }}>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.1rem' }}>White AI</h2>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Strategy</label>
                  <select
                    value={whiteAIEvaluation}
                    onChange={(e) => setWhiteAIEvaluation(e.target.value as EvaluationType)}
                    className="move-time-select"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="offensive">Offensive</option>
                    <option value="defensive">Defensive</option>
                    <option value="suicidal">I Will Lose</option>
                    <option value="attempt2">Attempt 2</option>
                  </select>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Depth</label>
                  <select
                    value={whiteAIDepth}
                    onChange={(e) => setWhiteAIDepth(Number(e.target.value))}
                    className="move-time-select"
                  >
                    {DEPTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Max Move Time</label>
                  <select
                    value={whiteAIMaxTime}
                    onChange={(e) => setWhiteAIMaxTime(Number(e.target.value))}
                    className="move-time-select"
                  >
                    {MOVE_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {blackPlayer === "ai" && (
              <div className="ai-settings" style={{ minWidth: 180 }}>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Black AI</h2>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Strategy</label>
                  <select
                    value={blackAIEvaluation}
                    onChange={(e) => setBlackAIEvaluation(e.target.value as EvaluationType)}
                    className="move-time-select"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="offensive">Offensive</option>
                    <option value="defensive">Defensive</option>
                    <option value="suicidal">I Will Lose</option>
                    <option value="attempt2">Attempt 2</option>
                  </select>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Depth</label>
                  <select
                    value={blackAIDepth}
                    onChange={(e) => setBlackAIDepth(Number(e.target.value))}
                    className="move-time-select"
                  >
                    {DEPTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9rem', color: '#333' }}>Max Move Time</label>
                  <select
                    value={blackAIMaxTime}
                    onChange={(e) => setBlackAIMaxTime(Number(e.target.value))}
                    className="move-time-select"
                  >
                    {MOVE_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem', padding: '1.2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 0.75rem 0', textAlign: 'center', color: 'white', fontSize: '1.1rem' }}>⏱️ Chess Clock</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'white', fontSize: '1rem' }}>
              <input
                type="checkbox"
                checked={clockEnabled}
                onChange={(e) => setClockEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Enable Chess Clock</span>
            </label>
          </div>
          {clockEnabled && (
            <div style={{ background: 'rgba(255,255,255,0.95)', padding: '0.85rem', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, textAlign: 'center', color: '#333', fontSize: '0.9rem' }}>Time per Player</label>
              <select
                value={initialTime}
                onChange={(e) => setInitialTime(Number(e.target.value))}
                className="move-time-select"
                style={{ width: '100%', padding: '0.6rem', fontSize: '1rem', borderRadius: '6px', border: '2px solid #667eea', background: 'white' }}
              >
                {CLOCK_TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button className="start-button" onClick={handleStartGame}>
          Start Game
        </button>
      </div>
    </div>
  );
};

export default GameSetup;
