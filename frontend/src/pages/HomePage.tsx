import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSongStore, useGameStore, useAudioStore } from "../stores";
import { SongSearch, SongList } from "../components/songs";
import { MicSettingsModal } from "../components/audio";
import type { QueueEntry, SongSummary } from "../api/types";
import {
  getQueue,
  removeFromQueue,
  removeFromQueueBySong,
} from "../api/client";
import { getPlayerColor } from "../constants/playerColors";

function QueueSidebar({
  queue,
  onPlaySong,
  onRemove,
}: {
  queue: QueueEntry[];
  onPlaySong: (entry: QueueEntry) => void;
  onRemove: (entryId: number) => void;
}) {
  if (queue.length === 0) return null;

  return (
    <div className="w-80 flex-shrink-0 bg-white/5 rounded-lg p-4 h-fit sticky top-4">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
        Song Requests ({queue.length})
      </h2>
      <div className="space-y-2">
        {queue.map((entry, index) => (
          <div
            key={entry.id}
            className="bg-white/5 rounded-lg p-3 group hover:bg-white/10 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-purple-400 font-mono text-sm mt-1">
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {entry.song_title}
                </div>
                <div className="text-gray-400 text-sm truncate">
                  {entry.song_artist}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Requested by {entry.submitter}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onPlaySong(entry)}
                  className="p-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white"
                  title="Play this song"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  className="p-1.5 rounded bg-red-600/50 hover:bg-red-600 text-white"
                  title="Remove from queue"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {queue.length > 0 && (
        <button
          type="button"
          onClick={() => onPlaySong(queue[0])}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Play Next Song
        </button>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { songs, isLoading, error, fetchSongs } = useSongStore();
  const { setSong } = useGameStore();
  const { fetchSong } = useSongStore();
  const { micAssignments } = useAudioStore();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [showMicSettings, setShowMicSettings] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Poll queue every 5 seconds
  useEffect(() => {
    const fetchQueueData = () => getQueue().then(setQueue).catch(console.error);
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectSong = useCallback(
    async (songSummary: SongSummary) => {
      await fetchSong(songSummary.id);
      const song = useSongStore.getState().currentSong;
      if (song) {
        setSong(song);
        // Remove from queue if this song was requested
        await removeFromQueueBySong(songSummary.id);
        navigate("/play");
      }
    },
    [fetchSong, setSong, navigate],
  );

  const handlePlayFromQueue = useCallback(
    async (entry: QueueEntry) => {
      await fetchSong(entry.song_id);
      const song = useSongStore.getState().currentSong;
      if (song) {
        setSong(song);
        // Remove from queue when playing
        await removeFromQueue(entry.id);
        navigate("/play");
      }
    },
    [fetchSong, setSong, navigate],
  );

  const handleRemoveFromQueue = useCallback(async (entryId: number) => {
    await removeFromQueue(entryId);
    setQueue((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Settings button - top right */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setShowMicSettings(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {/* Show assigned mic colors */}
          {micAssignments.length > 0 ? (
            <div className="flex -space-x-1">
              {micAssignments.map((assignment) => (
                <span
                  key={assignment.colorId}
                  className="w-4 h-4 rounded-full ring-2 ring-gray-900"
                  style={{ backgroundColor: getPlayerColor(assignment.colorId).hex }}
                />
              ))}
            </div>
          ) : (
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
          <span className="text-gray-300 text-sm">
            {micAssignments.length > 0 ? `${micAssignments.length} mic${micAssignments.length > 1 ? "s" : ""}` : "Setup Mics"}
          </span>
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          <div className="mb-6 max-w-md">
            <SongSearch />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <SongList
            songs={songs}
            onSelectSong={handleSelectSong}
            isLoading={isLoading}
          />
        </div>

        <QueueSidebar
          queue={queue}
          onPlaySong={handlePlayFromQueue}
          onRemove={handleRemoveFromQueue}
        />
      </div>

      <MicSettingsModal
        isOpen={showMicSettings}
        onClose={() => setShowMicSettings(false)}
      />
    </div>
  );
}
