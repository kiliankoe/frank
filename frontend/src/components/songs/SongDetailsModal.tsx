import { useEffect } from "react";
import type { Song } from "../../api/types";
import { getFileUrl } from "../../api/client";
import { useAudioStore } from "../../stores";
import { getPlayerColor } from "../../constants/playerColors";

interface SongDetailsModalProps {
  song: Song;
  onStart: () => void;
  onCancel: () => void;
}

export function SongDetailsModal({
  song,
  onStart,
  onCancel,
}: SongDetailsModalProps) {
  const { micAssignments } = useAudioStore();
  const coverUrl = getFileUrl(song.id, "cover");

  const isDuet = Boolean(song.notes_p2 && song.notes_p2.length > 0);
  const hasVideo = Boolean(song.metadata.video_file);
  const maxPlayers = isDuet ? 2 : 4;

  // Get configured players (limited by maxPlayers)
  const activePlayers = micAssignments.slice(0, maxPlayers);

  // Handle Enter key to start, Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && activePlayers.length > 0) {
        e.preventDefault();
        onStart();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStart, onCancel, activePlayers.length]);

  // Calculate note count
  const noteCount =
    song.notes.length + (song.notes_p2 ? song.notes_p2.length : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - click to close */}
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
        onClick={onCancel}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden border border-white/10">
        {/* Cover image header */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 right-4 flex gap-2">
            {hasVideo && (
              <span className="bg-purple-600 text-white text-sm px-3 py-1 rounded-full font-medium">
                Video
              </span>
            )}
            {isDuet && (
              <span className="bg-pink-600 text-white text-sm px-3 py-1 rounded-full font-medium">
                Duet
              </span>
            )}
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              {song.metadata.title}
            </h2>
            <p className="text-xl text-gray-200 drop-shadow-lg">
              {song.metadata.artist}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {song.metadata.genre && (
              <MetadataItem label="Genre" value={song.metadata.genre} />
            )}
            {song.metadata.year && (
              <MetadataItem
                label="Year"
                value={song.metadata.year.toString()}
              />
            )}
            {song.metadata.language && (
              <MetadataItem label="Language" value={song.metadata.language} />
            )}
            <MetadataItem
              label="BPM"
              value={Math.round(song.metadata.bpm).toString()}
            />
            <MetadataItem label="Notes" value={noteCount.toString()} />
            {song.metadata.edition && (
              <MetadataItem label="Edition" value={song.metadata.edition} />
            )}
            {song.metadata.creator && (
              <MetadataItem label="Creator" value={song.metadata.creator} />
            )}
          </div>

          {/* Duet singers */}
          {isDuet && (
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Duet Parts
              </h3>
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <span className="text-purple-400 font-medium">P1</span>
                  <p className="text-white">
                    {song.metadata.duet_singer_p1 || "Singer 1"}
                  </p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex-1 text-center">
                  <span className="text-pink-400 font-medium">P2</span>
                  <p className="text-white">
                    {song.metadata.duet_singer_p2 || "Singer 2"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Players section */}
          <div className="bg-white/5 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Players Ready
            </h3>
            {activePlayers.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {activePlayers.map((assignment, index) => {
                  const color = getPlayerColor(assignment.colorId);
                  const singerName = isDuet
                    ? index === 0
                      ? song.metadata.duet_singer_p1 || "P1"
                      : song.metadata.duet_singer_p2 || "P2"
                    : color.name;
                  return (
                    <div
                      key={assignment.deviceId}
                      className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-white">{singerName}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No microphones configured. Go to mic settings to add players.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={activePlayers.length === 0}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Singing
            </button>
          </div>

          {activePlayers.length === 0 && (
            <p className="text-center text-gray-500 text-sm">
              Configure at least one microphone to start
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-white font-medium truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}
