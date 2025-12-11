import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores";
import { getFileUrl } from "../api/client";
import { getPlayerColor } from "../constants/playerColors";

function AnimatedScoreBar({
  score,
  maxScore,
  color,
  colorName,
  delay,
  duration,
}: {
  score: number;
  maxScore: number;
  color: string;
  colorName: string;
  delay: number;
  duration: number;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const startTime = performance.now() + delay;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      if (elapsed < 0) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - (1 - progress) ** 3;

      setAnimatedScore(Math.round(score * eased));
      setBarWidth((score / maxScore) * 100 * eased);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [score, maxScore, delay, duration]);

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 text-right">
        <span className="text-sm font-medium" style={{ color }}>
          {colorName}
        </span>
      </div>
      <div className="flex-1 h-16 bg-white/10 rounded-lg overflow-hidden relative">
        <div
          className="h-full rounded-lg transition-none"
          style={{
            width: `${barWidth}%`,
            backgroundColor: color,
            boxShadow: `0 0 20px ${color}40`,
          }}
        />
      </div>
      <div className="w-24 text-right">
        <span className="text-2xl font-bold text-white">{animatedScore}</span>
      </div>
    </div>
  );
}

// Debug function to assign random scores - call from browser console:
// window.__debugRandomScores()
if (typeof window !== "undefined") {
  (window as unknown as { __debugRandomScores: () => void }).__debugRandomScores =
    () => {
      const state = useGameStore.getState();
      for (const player of state.players) {
        const randomScore = Math.floor(Math.random() * 10000);
        // Reset player scores first, then add a fake note score
        useGameStore.setState((s) => ({
          players: s.players.map((p) =>
            p.id === player.id
              ? {
                  ...p,
                  score: randomScore,
                  noteScores: [
                    {
                      noteIndex: 0,
                      maxPoints: 10000,
                      earnedPoints: randomScore,
                      accuracy: randomScore / 10000,
                    },
                  ],
                }
              : p,
          ),
        }));
      }
      console.log(
        "Random scores assigned:",
        useGameStore.getState().players.map((p) => ({ id: p.id, score: p.score })),
      );
    };
}

export function ResultsPage() {
  const navigate = useNavigate();
  const { song, players, gameState, resetGame, restartSameSong } =
    useGameStore();

  useEffect(() => {
    // Only redirect to home if there's no song (initial load without a game)
    // Don't redirect on gameState change since handlePlayAgain changes it intentionally
    if (!song && gameState !== "finished") {
      navigate("/");
    }
  }, [song, gameState, navigate]);

  const handlePlayAgain = () => {
    // Navigate first, then reset - this prevents the useEffect from redirecting
    navigate("/play");
    restartSameSong();
  };

  const handleNewSong = () => {
    resetGame();
    navigate("/");
  };

  if (!song) {
    return null;
  }

  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Calculate max score for bar scaling (use highest player score or a minimum)
  const maxScore = Math.max(...players.map((p) => p.score), 1);

  // Animation duration based on score - all bars animate at same rate
  // so higher scores take longer to complete
  const baseDuration = 2000; // 2 seconds for full animation

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          Results
        </h1>

        {/* Song Info */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
            <img
              src={getFileUrl(song.id, "cover")}
              alt={song.metadata.title}
              className="w-20 h-20 rounded object-cover bg-gray-800"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h2 className="text-xl font-bold text-white">
                {song.metadata.title}
              </h2>
              <p className="text-gray-400">{song.metadata.artist}</p>
            </div>
          </div>
        </div>

        {/* Animated Score Bars */}
        <div className="max-w-3xl mx-auto space-y-4 bg-white/5 rounded-xl p-6">
          {sortedPlayers.map((player) => {
            const color = getPlayerColor(player.color);
            // All bars animate at the same rate - higher scores take longer
            const duration = (player.score / maxScore) * baseDuration;
            return (
              <AnimatedScoreBar
                key={player.id}
                score={player.score}
                maxScore={maxScore}
                color={color.hex}
                colorName={color.name}
                delay={500}
                duration={duration || baseDuration}
              />
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={handlePlayAgain}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={handleNewSong}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Choose New Song
          </button>
        </div>
      </div>
    </div>
  );
}
