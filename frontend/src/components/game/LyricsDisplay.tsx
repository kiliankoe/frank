import type { Phrase } from "../../game/types";

interface LyricsDisplayProps {
  currentPhrase: Phrase | null;
  nextPhrase: Phrase | null;
  currentTimeMs: number;
  // For duets
  currentPhraseP2?: Phrase | null;
  nextPhraseP2?: Phrase | null;
  singerP1?: string;
  singerP2?: string;
}

export function LyricsDisplay({
  currentPhrase,
  nextPhrase,
  currentTimeMs,
  currentPhraseP2,
  nextPhraseP2,
  singerP1,
  singerP2,
}: LyricsDisplayProps) {
  const isDuet = currentPhraseP2 !== undefined;

  const renderPhrase = (
    phrase: Phrase | null,
    isCurrent: boolean,
    color: string = "text-white",
    activeColor: string = "text-yellow-400",
    pastColor: string = "text-purple-400",
  ) => {
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
                    ? `${activeColor} scale-105`
                    : isPast
                      ? pastColor
                      : color
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

  // Single player / non-duet display
  if (!isDuet) {
    return (
      <div className="text-center py-8 space-y-4">
        {renderPhrase(currentPhrase, true)}
        {nextPhrase && (
          <div className="mt-6">{renderPhrase(nextPhrase, false)}</div>
        )}
      </div>
    );
  }

  // Duet display - show both tracks
  return (
    <div className="py-4 space-y-2">
      {/* P1 lyrics */}
      <div className="text-center">
        {singerP1 && (
          <div className="text-purple-400 text-sm mb-1">{singerP1}</div>
        )}
        {renderPhrase(
          currentPhrase,
          true,
          "text-white",
          "text-purple-300",
          "text-purple-500",
        )}
        {nextPhrase && !currentPhrase && (
          <div className="mt-2">
            {renderPhrase(
              nextPhrase,
              false,
              "text-white",
              "text-purple-300",
              "text-purple-500",
            )}
          </div>
        )}
      </div>

      {/* P2 lyrics */}
      <div className="text-center">
        {singerP2 && (
          <div className="text-pink-400 text-sm mb-1">{singerP2}</div>
        )}
        {renderPhrase(
          currentPhraseP2,
          true,
          "text-white",
          "text-pink-300",
          "text-pink-500",
        )}
        {nextPhraseP2 && !currentPhraseP2 && (
          <div className="mt-2">
            {renderPhrase(
              nextPhraseP2,
              false,
              "text-white",
              "text-pink-300",
              "text-pink-500",
            )}
          </div>
        )}
      </div>
    </div>
  );
}
