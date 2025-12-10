interface PlayerScore {
  id: number;
  name: string;
  score: number;
  color?: string;
}

interface ScoreDisplayProps {
  players: PlayerScore[];
  maxScore?: number;
}

export function ScoreDisplay({ players, maxScore }: ScoreDisplayProps) {
  const colors = ["#a855f7", "#ec4899", "#3b82f6", "#10b981"];

  return (
    <div className="flex gap-6">
      {players.map((player, index) => (
        <div key={player.id} className="text-right">
          <div className="text-sm text-gray-400">{player.name}</div>
          <div
            className="text-3xl font-bold"
            style={{ color: player.color || colors[index % colors.length] }}
          >
            {player.score.toLocaleString()}
          </div>
          {maxScore && maxScore > 0 && (
            <div className="text-xs text-gray-500">
              {Math.round((player.score / maxScore) * 100)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
