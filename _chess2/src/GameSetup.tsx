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

const DEPTH_POINTS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 80, 100, 150, 200, 300, 500];
const DEPTH_OPTIONS = DEPTH_POINTS.map((points, i) => ({
  label: `${i + 1}`,
  value: i + 1,
  points,
}));

const MOVE_TIME_OPTIONS = [
  { label: "Instant", value: 0, points: 0 },
  { label: "0.1s", value: 100, points: 1 },
  { label: "0.25s", value: 250, points: 2 },
  { label: "0.5s", value: 500, points: 3 },
  { label: "1s", value: 1000, points: 4 },
  { label: "2s", value: 2000, points: 5 },
  { label: "3s", value: 3000, points: 7 },
  { label: "5s", value: 5000, points: 10 },
  { label: "8s", value: 8000, points: 15 },
  { label: "10s", value: 10000, points: 22 },
  { label: "15s", value: 15000, points: 30 },
  { label: "30s", value: 30000, points: 50 },
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
  const [whiteAIDepth, setWhiteAIDepth] = useState<number>(5);
  const [whiteAIMaxTime, setWhiteAIMaxTime] = useState<number>(5000);
  const [whiteAIEvaluation, setWhiteAIEvaluation] = useState<EvaluationType>("balanced");
  const [whiteAIMode, setWhiteAIMode] = useState<string>("normal");
  const [blackAIDepth, setBlackAIDepth] = useState<number>(5);
  const [blackAIMaxTime, setBlackAIMaxTime] = useState<number>(5000);
  const [blackAIEvaluation, setBlackAIEvaluation] = useState<EvaluationType>("balanced");
  const [blackAIMode, setBlackAIMode] = useState<string>("normal");
  const [clockEnabled, setClockEnabled] = useState<boolean>(false);
  const [initialTime, setInitialTime] = useState<number>(900); // 15 minutes default

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

  // Points for each evaluation type
  const EVAL_POINTS: Record<EvaluationType, number> = {
    balanced: 50,
    offensive: 25,
    defensive: 25,
    suicidal: 0,
    attempt2: 100,
  };

  // Display names for evaluation types
  const EVAL_DISPLAY_NAMES: Record<EvaluationType, string> = {
    balanced: 'Balanced',
    offensive: 'Offensive',
    defensive: 'Defensive',
    suicidal: 'I Will Lose',
    attempt2: 'Pro',
  };

  // Helper to calculate total points for AI settings
  const getAIPoints = (player: 'white' | 'black') => {
    let depthPoints = 0, moveTimePoints = 0, evalPoints = 0;
    if (player === 'white' && whitePlayer === 'ai') {
      const depthObj = DEPTH_OPTIONS.find(o => o.value === whiteAIDepth);
      const moveTimeObj = MOVE_TIME_OPTIONS.find(o => o.value === whiteAIMaxTime);
      depthPoints = depthObj ? depthObj.points : 0;
      moveTimePoints = moveTimeObj ? moveTimeObj.points : 0;
      evalPoints = EVAL_POINTS[whiteAIEvaluation] || 0;
    } else if (player === 'black' && blackPlayer === 'ai') {
      const depthObj = DEPTH_OPTIONS.find(o => o.value === blackAIDepth);
      const moveTimeObj = MOVE_TIME_OPTIONS.find(o => o.value === blackAIMaxTime);
      depthPoints = depthObj ? depthObj.points : 0;
      moveTimePoints = moveTimeObj ? moveTimeObj.points : 0;
      evalPoints = EVAL_POINTS[blackAIEvaluation] || 0;
    }
    return depthPoints + moveTimePoints + evalPoints;
  };

  // AI mode limits
  const AI_MODE_LIMITS: Record<string, number | undefined> = {
    normal: 200,
    hard: 70,
    sandbox: undefined,
  };

  const getAIRemainingPoints = (player: 'white' | 'black', skip?: 'depth' | 'moveTime' | 'eval') => {
    // skip: which field to skip in the calculation (for option disabling)
    const mode = player === 'white' ? whiteAIMode : blackAIMode;
    const limit = AI_MODE_LIMITS[mode];
    let depthPoints = 0, moveTimePoints = 0, evalPoints = 0;
    if (player === 'white' && whitePlayer === 'ai') {
      if (skip !== 'depth') {
        const depthObj = DEPTH_OPTIONS.find(o => o.value === whiteAIDepth);
        depthPoints = depthObj ? depthObj.points : 0;
      }
      if (skip !== 'moveTime') {
        const moveTimeObj = MOVE_TIME_OPTIONS.find(o => o.value === whiteAIMaxTime);
        moveTimePoints = moveTimeObj ? moveTimeObj.points : 0;
      }
      if (skip !== 'eval') {
        evalPoints = EVAL_POINTS[whiteAIEvaluation] || 0;
      }
    } else if (player === 'black' && blackPlayer === 'ai') {
      if (skip !== 'depth') {
        const depthObj = DEPTH_OPTIONS.find(o => o.value === blackAIDepth);
        depthPoints = depthObj ? depthObj.points : 0;
      }
      if (skip !== 'moveTime') {
        const moveTimeObj = MOVE_TIME_OPTIONS.find(o => o.value === blackAIMaxTime);
        moveTimePoints = moveTimeObj ? moveTimeObj.points : 0;
      }
      if (skip !== 'eval') {
        evalPoints = EVAL_POINTS[blackAIEvaluation] || 0;
      }
    }
    const used = depthPoints + moveTimePoints + evalPoints;
    if (limit === undefined) return Infinity;
    return Math.max(0, limit - used);
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
          <div className="ai-settings-container">
            {whitePlayer === "ai" && (
              <div className="ai-settings">
                <h2>White AI <span style={{ fontSize: '0.8em', marginLeft: 8, color: '#888' }}>(Total Points: {getAIPoints('white')}, Remaining: {getAIRemainingPoints('white')})</span></h2>
                <div className="ai-setting-group">
                  <label>Mode</label>
                  <select value={whiteAIMode} onChange={e => {
                    const newMode = e.target.value;
                    setWhiteAIMode(newMode);
                    // Reset to defaults if switching to a mode with lower limit and currently over
                    const newLimit = AI_MODE_LIMITS[newMode];
                    if (newLimit !== undefined && getAIPoints('white') > newLimit) {
                      setWhiteAIDepth(5);
                      setWhiteAIMaxTime(5000);
                      setWhiteAIEvaluation('balanced');
                    }
                  }} className="move-time-select">
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Strategy</label>
                  <select
                    value={whiteAIEvaluation}
                    onChange={(e) => {
                      const newEval = e.target.value as EvaluationType;
                      const newEvalPoints = EVAL_POINTS[newEval] || 0;
                      const remaining = getAIRemainingPoints('white', 'eval');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      if (limit === undefined || newEvalPoints <= remaining) {
                        setWhiteAIEvaluation(newEval);
                      }
                    }}
                    className="move-time-select"
                  >
                    {Object.entries(EVAL_POINTS).map(([key, pts]) => {
                      const evalType = key as EvaluationType;
                      const remaining = getAIRemainingPoints('white', 'eval');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      const disabled = limit !== undefined && pts > remaining;
                      return (
                        <option key={key} value={key} disabled={disabled}>
                          {EVAL_DISPLAY_NAMES[evalType]} (Points: {pts})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Depth</label>
                  <select
                    value={whiteAIDepth}
                    onChange={(e) => {
                      const newDepth = Number(e.target.value);
                      const newDepthPoints = DEPTH_OPTIONS.find(o => o.value === newDepth)?.points || 0;
                      const remaining = getAIRemainingPoints('white', 'depth');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      if (limit === undefined || newDepthPoints <= remaining) {
                        setWhiteAIDepth(newDepth);
                      }
                    }}
                    className="move-time-select"
                  >
                    {DEPTH_OPTIONS.map((option) => {
                      const remaining = getAIRemainingPoints('white', 'depth');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      const disabled = limit !== undefined && option.points > remaining;
                      return (
                        <option key={option.value} value={option.value} disabled={disabled}>
                          {option.label} (Points: {option.points})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Max Move Time</label>
                  <select
                    value={whiteAIMaxTime}
                    onChange={(e) => {
                      const newMaxTime = Number(e.target.value);
                      const newMaxTimePoints = MOVE_TIME_OPTIONS.find(o => o.value === newMaxTime)?.points || 0;
                      const remaining = getAIRemainingPoints('white', 'moveTime');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      if (limit === undefined || newMaxTimePoints <= remaining) {
                        setWhiteAIMaxTime(newMaxTime);
                      }
                    }}
                    className="move-time-select"
                  >
                    {MOVE_TIME_OPTIONS.map((option) => {
                      const remaining = getAIRemainingPoints('white', 'moveTime');
                      const limit = AI_MODE_LIMITS[whiteAIMode];
                      const disabled = limit !== undefined && option.points > remaining;
                      return (
                        <option key={option.value} value={option.value} disabled={disabled}>
                          {option.label} (Points: {option.points})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {blackPlayer === "ai" && (
              <div className="ai-settings">
                <h2>Black AI <span style={{ fontSize: '0.8em', marginLeft: 8, color: '#888' }}>(Total Points: {getAIPoints('black')}, Remaining: {getAIRemainingPoints('black')})</span></h2>
                <div className="ai-setting-group">
                  <label>Mode</label>
                  <select value={blackAIMode} onChange={e => {
                    const newMode = e.target.value;
                    setBlackAIMode(newMode);
                    // Reset to defaults if switching to a mode with lower limit and currently over
                    const newLimit = AI_MODE_LIMITS[newMode];
                    if (newLimit !== undefined && getAIPoints('black') > newLimit) {
                      setBlackAIDepth(5);
                      setBlackAIMaxTime(5000);
                      setBlackAIEvaluation('balanced');
                    }
                  }} className="move-time-select">
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Strategy</label>
                  <select
                    value={blackAIEvaluation}
                    onChange={(e) => {
                      const newEval = e.target.value as EvaluationType;
                      const newEvalPoints = EVAL_POINTS[newEval] || 0;
                      const remaining = getAIRemainingPoints('black', 'eval');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      if (limit === undefined || newEvalPoints <= remaining) {
                        setBlackAIEvaluation(newEval);
                      }
                    }}
                    className="move-time-select"
                  >
                    {Object.entries(EVAL_POINTS).map(([key, pts]) => {
                      const evalType = key as EvaluationType;
                      const remaining = getAIRemainingPoints('black', 'eval');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      const disabled = limit !== undefined && pts > remaining;
                      return (
                        <option key={key} value={key} disabled={disabled}>
                          {EVAL_DISPLAY_NAMES[evalType]} (Points: {pts})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Depth</label>
                  <select
                    value={blackAIDepth}
                    onChange={(e) => {
                      const newDepth = Number(e.target.value);
                      const newDepthPoints = DEPTH_OPTIONS.find(o => o.value === newDepth)?.points || 0;
                      const remaining = getAIRemainingPoints('black', 'depth');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      if (limit === undefined || newDepthPoints <= remaining) {
                        setBlackAIDepth(newDepth);
                      }
                    }}
                    className="move-time-select"
                  >
                    {DEPTH_OPTIONS.map((option) => {
                      const remaining = getAIRemainingPoints('black', 'depth');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      const disabled = limit !== undefined && option.points > remaining;
                      return (
                        <option key={option.value} value={option.value} disabled={disabled}>
                          {option.label} (Points: {option.points})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="ai-setting-group">
                  <label>Max Move Time</label>
                  <select
                    value={blackAIMaxTime}
                    onChange={(e) => {
                      const newMaxTime = Number(e.target.value);
                      const newMaxTimePoints = MOVE_TIME_OPTIONS.find(o => o.value === newMaxTime)?.points || 0;
                      const remaining = getAIRemainingPoints('black', 'moveTime');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      if (limit === undefined || newMaxTimePoints <= remaining) {
                        setBlackAIMaxTime(newMaxTime);
                      }
                    }}
                    className="move-time-select"
                  >
                    {MOVE_TIME_OPTIONS.map((option) => {
                      const remaining = getAIRemainingPoints('black', 'moveTime');
                      const limit = AI_MODE_LIMITS[blackAIMode];
                      const disabled = limit !== undefined && option.points > remaining;
                      return (
                        <option key={option.value} value={option.value} disabled={disabled}>
                          {option.label} (Points: {option.points})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="clock-section">
          <h2>⏱️ Chess Clock</h2>
          <div className="clock-toggle">
            <label>
              <input
                type="checkbox"
                checked={clockEnabled}
                onChange={(e) => setClockEnabled(e.target.checked)}
              />
              <span>Enable Chess Clock</span>
            </label>
          </div>
          {clockEnabled && (
            <div className="clock-time-selector">
              <label>Time per Player</label>
              <select
                value={initialTime}
                onChange={(e) => setInitialTime(Number(e.target.value))}
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
