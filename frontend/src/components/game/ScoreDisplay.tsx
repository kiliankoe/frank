interface PlayerScore {
  id: number;
  score: number;
  color: string; // hex color
  maxScore?: number; // Per-player max score for duets
}

interface ScoreDisplayProps {
  players: PlayerScore[];
  maxScore?: number; // Fallback max score for all players
}

export function ScoreDisplay({ players, maxScore }: ScoreDisplayProps) {
  return (
    <div className="flex gap-6">
      {players.map((player) => {
        const playerMaxScore = player.maxScore ?? maxScore;
        return (
          <div key={player.id} className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.color }}
            />
            <div className="text-right">
              <div
                className="text-3xl font-bold"
                style={{ color: player.color }}
              >
                {player.score.toLocaleString()}
              </div>
              {playerMaxScore && playerMaxScore > 0 && (
                <div className="text-xs text-gray-500">
                  {Math.round((player.score / playerMaxScore) * 100)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
