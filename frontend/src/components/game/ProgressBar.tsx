import { formatTime } from "../../utils/timeUtils";

interface ProgressBarProps {
  currentTimeMs: number;
  durationMs: number;
}

export function ProgressBar({ currentTimeMs, durationMs }: ProgressBarProps) {
  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>{formatTime(currentTimeMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
