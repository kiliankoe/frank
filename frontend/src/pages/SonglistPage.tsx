import { useCallback, useEffect, useMemo, useState } from "react";
import { addToQueue, getFileUrl, getQueue, getSongs } from "../api/client";
import type { QueueEntry, SongSummary } from "../api/types";

interface ArtistGroup {
  name: string;
  songs: SongSummary[];
}

function groupByArtist(songs: SongSummary[]): ArtistGroup[] {
  const grouped = new Map<string, SongSummary[]>();

  for (const song of songs) {
    const existing = grouped.get(song.artist);
    if (existing) {
      existing.push(song);
    } else {
      grouped.set(song.artist, [song]);
    }
  }

  // Sort artists alphabetically, then songs within each artist
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, artistSongs]) => ({
      name,
      songs: artistSongs.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

function ArtistSection({
  artist,
  isExpanded,
  onToggle,
  onSelectSong,
}: {
  artist: ArtistGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectSong: (song: SongSummary) => void;
}) {
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10"
      >
        <span className="font-semibold text-white">{artist.name}</span>
        <span className="text-gray-400 text-sm">
          {artist.songs.length} song{artist.songs.length !== 1 ? "s" : ""}
          <svg
            className={`inline-block ml-2 w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>
      {isExpanded && (
        <div className="bg-white/5">
          {artist.songs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => onSelectSong(song)}
              className="w-full px-4 py-3 pl-8 flex items-center gap-3 text-left hover:bg-white/10 active:bg-white/15 border-t border-white/5"
            >
              {song.cover_url ? (
                <img
                  src={getFileUrl(song.id, "cover")}
                  alt=""
                  className="w-10 h-10 rounded object-cover bg-gray-800 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-800 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white truncate">{song.title}</div>
                <div className="text-gray-400 text-xs flex gap-2">
                  {song.is_duet && <span className="text-pink-400">Duet</span>}
                  {song.language && <span>{song.language}</span>}
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddToQueueModal({
  song,
  onClose,
  onSubmit,
}: {
  song: SongSummary;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Add to Queue</h2>
          <p className="text-gray-400 text-sm mt-1">
            {song.title} - {song.artist}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label
              htmlFor="submitter-name"
              className="block text-sm text-gray-400 mb-2"
            >
              Your name
            </label>
            <input
              id="submitter-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 active:bg-white/25"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Adding..." : "Add to Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QueueDisplay({ queue }: { queue: QueueEntry[] }) {
  if (queue.length === 0) return null;

  return (
    <div className="bg-purple-900/30 border-t border-purple-500/30">
      <div className="px-4 py-2 text-sm font-semibold text-purple-300">
        Up Next ({queue.length})
      </div>
      <div className="max-h-48 overflow-y-auto">
        {queue.map((entry, index) => (
          <div
            key={entry.id}
            className="px-4 py-2 flex items-center gap-3 border-t border-white/5"
          >
            <span className="text-purple-400 font-mono text-sm w-6">
              {index + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm truncate">
                {entry.song_title}
              </div>
              <div className="text-gray-400 text-xs truncate">
                {entry.song_artist} - requested by {entry.submitter}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SonglistPage() {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSong, setSelectedSong] = useState<SongSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch songs on mount
  useEffect(() => {
    getSongs()
      .then(setSongs)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  // Poll queue every 5 seconds
  useEffect(() => {
    const fetchQueue = () => getQueue().then(setQueue).catch(console.error);
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter songs by search query
  const filteredSongs = useMemo(() => {
    if (!search.trim()) return songs;
    const query = search.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query),
    );
  }, [songs, search]);

  // Group filtered songs by artist
  const artistGroups = useMemo(
    () => groupByArtist(filteredSongs),
    [filteredSongs],
  );

  // Auto-expand when searching
  useEffect(() => {
    if (search.trim()) {
      setExpandedArtists(new Set(artistGroups.map((a) => a.name)));
    }
  }, [search, artistGroups]);

  const toggleArtist = useCallback((artistName: string) => {
    setExpandedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(artistName)) {
        next.delete(artistName);
      } else {
        next.add(artistName);
      }
      return next;
    });
  }, []);

  const handleAddToQueue = useCallback(
    async (name: string) => {
      if (!selectedSong) return;
      try {
        await addToQueue(selectedSong.id, name);
        setQueue(await getQueue());
        setSuccessMessage(`Added "${selectedSong.title}" to the queue!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add to queue");
      }
      setSelectedSong(null);
    },
    [selectedSong],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Loading songs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header with search */}
      <header className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-white/10 z-40">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white mb-3">Song List</h1>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search songs or artists..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <svg
                  className="w-5 h-5"
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
            )}
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}{" "}
            {search && `matching "${search}"`}
          </p>
        </div>
      </header>

      {/* Song list */}
      <main className="flex-1 overflow-y-auto">
        {artistGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No songs found</div>
        ) : (
          artistGroups.map((artist) => (
            <ArtistSection
              key={artist.name}
              artist={artist}
              isExpanded={expandedArtists.has(artist.name)}
              onToggle={() => toggleArtist(artist.name)}
              onSelectSong={setSelectedSong}
            />
          ))
        )}
      </main>

      {/* Queue display */}
      <QueueDisplay queue={queue} />

      {/* Success toast */}
      {successMessage && (
        <div className="fixed bottom-4 left-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg text-center z-50 animate-pulse">
          {successMessage}
        </div>
      )}

      {/* Add to queue modal */}
      {selectedSong && (
        <AddToQueueModal
          song={selectedSong}
          onClose={() => setSelectedSong(null)}
          onSubmit={handleAddToQueue}
        />
      )}
    </div>
  );
}
