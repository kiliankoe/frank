import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSongStore, useGameStore } from "../stores";
import { SongSearch, SongList } from "../components/songs";
import type { QueueEntry, SongSummary } from "../api/types";
import {
  getQueue,
  removeFromQueue,
  removeFromQueueBySong,
} from "../api/client";

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
  const [queue, setQueue] = useState<QueueEntry[]>([]);

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
      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Choose a Song
            </h1>
            <p className="text-gray-400">
              Select a song to start singing
              {queue.length > 0 && (
                <span className="text-purple-400 ml-2">
                  ({queue.length} request{queue.length !== 1 ? "s" : ""}{" "}
                  waiting)
                </span>
              )}
            </p>
          </div>

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
    </div>
  );
}
