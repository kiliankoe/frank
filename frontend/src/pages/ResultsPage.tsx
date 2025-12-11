import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores";
import { getFileUrl } from "../api/client";
import { getPlayerColor } from "../constants/playerColors";

export function ResultsPage() {
  const navigate = useNavigate();
  const { song, players, gameState, resetGame } = useGameStore();

  useEffect(() => {
    if (!song || gameState !== "finished") {
      navigate("/");
    }
  }, [song, gameState, navigate]);

  const handlePlayAgain = () => {
    // Keep the song, reset scores
    const currentSong = song;
    resetGame();
    if (currentSong) {
      useGameStore.getState().setSong(currentSong);
      navigate("/play");
    }
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

        {/* Scores */}
        <div className="max-w-2xl mx-auto space-y-4">
          {sortedPlayers.map((player, index) => {
            const color = getPlayerColor(player.color);
            return (
              <div
                key={player.id}
                className={`bg-white/5 rounded-lg p-6 flex items-center gap-4 ${
                  index === 0 ? "ring-2 ring-yellow-500" : ""
                }`}
              >
                {/* Rank */}
                <div
                  className={`text-4xl font-bold ${
                    index === 0
                      ? "text-yellow-500"
                      : index === 1
                        ? "text-gray-400"
                        : index === 2
                          ? "text-amber-600"
                          : "text-gray-600"
                  }`}
                >
                  #{index + 1}
                </div>

                {/* Player Color */}
                <div className="flex items-center gap-3 flex-1">
                  <span
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div>
                    <div
                      className="text-xl font-semibold"
                      style={{ color: color.hex }}
                    >
                      {color.name}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {player.noteScores.length} notes scored
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {player.score}
                  </div>
                  <div className="text-gray-400 text-sm">points</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={handlePlayAgain}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={handleNewSong}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Choose New Song
          </button>
        </div>
      </div>
    </div>
  );
}
