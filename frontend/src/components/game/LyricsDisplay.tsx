import type { Phrase } from "../../game/types";

interface LyricsDisplayProps {
  currentPhrase: Phrase | null;
  nextPhrase: Phrase | null;
  currentTimeMs: number;
}

export function LyricsDisplay({
  currentPhrase,
  nextPhrase,
  currentTimeMs,
}: LyricsDisplayProps) {
  const renderPhrase = (phrase: Phrase | null, isCurrent: boolean) => {
    if (!phrase) return null;

    return (
      <div
        className={`transition-opacity duration-300 ${isCurrent ? "opacity-100" : "opacity-40"}`}
      >
        <div className="flex flex-wrap justify-center gap-x-1">
          {phrase.notes.map((note) => {
            const isActive =
              isCurrent &&
              currentTimeMs >= note.startTimeMs &&
              currentTimeMs <= note.endTimeMs;
            const isPast = currentTimeMs > note.endTimeMs;

            return (
              <span
                key={note.index}
                className={`text-3xl font-bold transition-colors duration-100 ${
                  isActive
                    ? "text-yellow-400 scale-105"
                    : isPast
                      ? "text-purple-400"
                      : "text-white"
                } ${note.note_type === "golden" ? "text-yellow-300" : ""}`}
              >
                {note.text}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="text-center py-8 space-y-4">
      {renderPhrase(currentPhrase, true)}
      {nextPhrase && (
        <div className="mt-6">{renderPhrase(nextPhrase, false)}</div>
      )}
    </div>
  );
}
