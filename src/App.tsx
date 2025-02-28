import React, { useState } from "react";
import "./styles.css";

/** ---------- Type Definitions ---------- **/
type WedgeData = {
  color: string;
  multiplier: number;
};

type Bets = {
  Red: number;
  White: number;
  Blue: number;
  Gold: number;
};

type SpinResult = {
  color: string;
  multiplier: number;
  winnings: number;
};

/** ---------- The 40 Wedges ---------- **/
const EXACT_ORDER: WedgeData[] = [
  { color: "Gold", multiplier: 20 },
  { color: "Red", multiplier: 2 },
  { color: "White", multiplier: 3 },
  { color: "Red", multiplier: 2 },
  { color: "White", multiplier: 3 },
  { color: "Blue", multiplier: 2 },
  { color: "Red", multiplier: 3 },
  { color: "White", multiplier: 5 },
  { color: "Red", multiplier: 2 },
  { color: "Blue", multiplier: 5 },
  { color: "White", multiplier: 2 },
  { color: "Red", multiplier: 2 },
  { color: "White", multiplier: 4 },
  { color: "Blue", multiplier: 2 },
  { color: "Red", multiplier: 3 },
  { color: "Blue", multiplier: 2 },
  { color: "White", multiplier: 3 },
  { color: "Red", multiplier: 2 },
  { color: "Blue", multiplier: 3 },
  { color: "Red", multiplier: 2 },
  { color: "Gold", multiplier: 15 },
  { color: "Red", multiplier: 3 },
  { color: "Blue", multiplier: 2 },
  { color: "Red", multiplier: 3 },
  { color: "White", multiplier: 2 },
  { color: "Blue", multiplier: 3 },
  { color: "Red", multiplier: 2 },
  { color: "White", multiplier: 2 },
  { color: "Blue", multiplier: 4 },
  { color: "White", multiplier: 2 },
  { color: "Red", multiplier: 4 },
  { color: "White", multiplier: 2 },
  { color: "Blue", multiplier: 4 },
  { color: "White", multiplier: 3 },
  { color: "Red", multiplier: 2 },
  { color: "Blue", multiplier: 10 },
  { color: "White", multiplier: 2 },
  { color: "Red", multiplier: 3 },
  { color: "White", multiplier: 4 },
  { color: "Red", multiplier: 2 },
];

/** ---------- SVG Helpers ---------- **/
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // Shift angle so 0° is at top
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    `Z`,
  ].join(" ");
}

function getFillColor(color: string) {
  switch (color) {
    case "Red":
      return "#d40000";
    case "White":
      return "#fafafa";
    case "Blue":
      return "#0066cc";
    case "Gold":
      return "#c9a100";
    default:
      return "#999";
  }
}

export default function App() {
  /** ---------- States ---------- **/
  const [bets, setBets] = useState<Bets>({
    Red: 0,
    White: 0,
    Blue: 0,
    Gold: 0,
  });
  const [balance, setBalance] = useState<number>(500);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);

  // Keep track of cumulative rotation
  const [rotation, setRotation] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);

  /** ---------- Wheel Geometry ---------- **/
  const totalWedges = EXACT_ORDER.length; // 40
  const sliceAngle = 360 / totalWedges; // e.g. 9° if 40 wedges
  const svgSize = 500;
  const cx = 250;
  const cy = 250;
  const r = 220;
  const labelRadiusFactor = 0.7;

  /**
   * buildWheelPaths():
   * SHIFT each wedge so wedge i is centered at i * sliceAngle.
   */
  function buildWheelPaths() {
    const paths = [];
    for (let i = 0; i < totalWedges; i++) {
      const wedge = EXACT_ORDER[i];
      const startAngle = i * sliceAngle - sliceAngle / 2;
      const endAngle = (i + 1) * sliceAngle - sliceAngle / 2;
      const d = describeArc(cx, cy, r, startAngle, endAngle);
      const midAngle = i * sliceAngle;
      paths.push({ ...wedge, d, midAngle });
    }
    return paths;
  }
  const wheelPaths = buildWheelPaths();

  /**
   * placeBet(color, amount):
   * Subtract from balance if there's enough, add to that color's bet.
   */
  const placeBet = (color: keyof Bets, amount: number) => {
    if (balance < amount) {
      alert("You don't have enough balance to place that bet.");
      return;
    }
    // Immediately remove from balance
    setBalance((prev) => prev - amount);
    // Add to the chosen color's bet
    setBets((prev) => ({ ...prev, [color]: prev[color] + amount }));
  };

  /**
   * clearBets():
   *  - For convenience BEFORE spinning only:
   *  - Return all bet amounts to the balance, set bets to 0.
   */
  const clearBets = () => {
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
    // Return to balance
    setBalance((prev) => prev + totalBet);
    // Zero out bets
    setBets({ Red: 0, White: 0, Blue: 0, Gold: 0 });
  };

  /**
   * resetBetsAfterRound():
   *  - After the spin finishes, we do NOT refund bets.
   *  - The bet is lost if no win; if there's a win, we already added that to the balance.
   *  - Just zero out the bets to start fresh next round.
   */
  const resetBetsAfterRound = () => {
    setBets({ Red: 0, White: 0, Blue: 0, Gold: 0 });
  };

  /**
   * spinWheel():
   *  - If total bet > 0, spin the wheel.
   *  - After 4.5s animation, pick winner & update balance if there's a win.
   *  - 3s after showing result, we reset for next round.
   */
  const spinWheel = () => {
    if (isSpinning) return;

    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
    if (totalBet === 0) {
      alert("You must place at least one bet first!");
      return;
    }

    setIsSpinning(true);
    setResult(null);
    setWinningIndex(null);

    // Random wedge
    const randomIndex = Math.floor(Math.random() * totalWedges);
    const extraSpins = 3 * 360;
    const finalRotation = rotation + extraSpins - sliceAngle * randomIndex;
    setRotation(finalRotation);

    // After the 4.5s spin
    setTimeout(() => {
      setWinningIndex(randomIndex);

      // Determine result
      const { color, multiplier } = EXACT_ORDER[randomIndex];
      const wager = bets[color] || 0;
      const winnings = wager * multiplier; // Winnings if any

      // If user wins, add to balance
      if (winnings > 0) {
        setBalance((prev) => prev + winnings);
      }

      setResult({ color, multiplier, winnings });
      setIsSpinning(false);

      // Auto-reset 3s after result
      setTimeout(() => {
        // Clear out the wedge highlight & result
        setResult(null);
        setWinningIndex(null);

        // The losing bets remain lost; we do NOT refund them
        resetBetsAfterRound();

        // If you want the wheel to reset to top angle each round, uncomment:
        // setRotation(0);
      }, 3000);
    }, 4500);
  };

  return (
    <div className="game-container">
      {/* Casino environment background layers */}
      <div className="casino-background"></div>
      <div className="neon-lights"></div>
      <div className="back-wall-lights"></div>

      {/* Header */}
      <header className="header-bar">
        <h1 className="game-title">Color Wheel</h1>
        <div className="balance-area">
          <span>Balance: ${balance}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Bet Panel */}
        <div className="bet-panel">
          <h2 className="section-title">Place Your Bets</h2>
          {(["Red", "White", "Blue", "Gold"] as (keyof Bets)[]).map((color) => (
            <div key={color} className="bet-row">
              <div className="bet-color">
                <span>{color}</span>
                {/* Realistic chip */}
                <div className={`bet-chip chip-${color.toLowerCase()}`}></div>
              </div>
              <div className="bet-buttons">
                <button onClick={() => placeBet(color, 5)}>+ $5</button>
                <button onClick={() => placeBet(color, 10)}>+ $10</button>
                <button onClick={() => placeBet(color, 25)}>+ $25</button>
              </div>
              <div className="bet-amount">
                <strong>${bets[color]}</strong>
              </div>
            </div>
          ))}
          <button
            className="clear-bets"
            onClick={clearBets}
            disabled={isSpinning}
            title="Remove all your bets before spinning."
          >
            Clear All Bets
          </button>
        </div>

        {/* Spin Button */}
        <button
          className="spin-button"
          onClick={spinWheel}
          disabled={isSpinning}
        >
          {isSpinning ? "Spinning..." : "SPIN"}
        </button>

        {/* 3D Wheel Environment */}
        <div className="wheel-stage">
          {/* Metallic hardware support */}
          <div className="wheel-support-frame">
            <div className="support-arm arm-left"></div>
            <div className="support-arm arm-right"></div>
            <div className="support-ring"></div>
          </div>

          <div className="wheel-3d">
            <div className="center-cone"></div>

            <svg width={svgSize} height={svgSize} className="wheel-svg">
              <g
                style={{
                  transformOrigin: "50% 50%",
                  transform: `rotate(${rotation}deg)`,
                  transition: "transform 4.5s cubic-bezier(0.33, 1, 0.68, 1)",
                }}
              >
                {wheelPaths.map((wp, index) => {
                  const isWinning = index === winningIndex;
                  return (
                    <g key={index}>
                      <path
                        d={wp.d}
                        fill={getFillColor(wp.color)}
                        stroke="#222"
                        strokeWidth="1"
                        className={isWinning ? "winning-wedge" : ""}
                      />
                      <text
                        x={
                          cx +
                          r *
                            labelRadiusFactor *
                            Math.cos(((wp.midAngle - 90) * Math.PI) / 180)
                        }
                        y={
                          cy +
                          r *
                            labelRadiusFactor *
                            Math.sin(((wp.midAngle - 90) * Math.PI) / 180)
                        }
                        fill={wp.color === "White" ? "#111" : "#fff"}
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        x{wp.multiplier}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Result Panel */}
      {result && (
        <div className="result-panel">
          <h3>Result</h3>
          <p>
            Winning Wedge: <strong>x{result.multiplier}</strong>{" "}
            {result.color === "Gold" && "(Gold)"}
          </p>
          {result.winnings > 0 ? (
            <p className="win-msg">
              You won <strong>${result.winnings}</strong>!
            </p>
          ) : (
            <p className="lose-msg">No win this time. Better luck next spin!</p>
          )}
        </div>
      )}
    </div>
  );
}
