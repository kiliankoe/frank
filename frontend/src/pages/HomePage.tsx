import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSongStore, useGameStore, useAudioStore } from "../stores";
import { SongCarousel, SongDetailsModal } from "../components/songs";
import { MicSettingsModal } from "../components/audio";
import { usePreview } from "../hooks/usePreview";
import type { QueueEntry, SearchableSong, Song } from "../api/types";
import {
  getQueue,
  removeFromQueue,
  removeFromQueueBySong,
  getFileUrl,
} from "../api/client";
import { getPlayerColor } from "../constants/playerColors";

function QueueIndicator({
  queue,
  onClick,
}: {
  queue: QueueEntry[];
  onClick: () => void;
}) {
  if (queue.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-4 right-4 z-30 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 transition-colors"
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
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
      <span className="font-medium">{queue.length} in queue</span>
    </button>
  );
}

function QueueModal({
  queue,
  onPlaySong,
  onRemove,
  onClose,
}: {
  queue: QueueEntry[];
  onPlaySong: (entry: QueueEntry) => void;
  onRemove: (entryId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Song Requests</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
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
                <div className="flex gap-1">
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
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const {
    allSongs,
    isLoading,
    error,
    fetchSongs,
    searchQuery,
    setSearchQuery,
  } = useSongStore();
  const { setSongAndStart, addPlayer, resetGame } = useGameStore();
  const { fetchSong } = useSongStore();
  const { micAssignments, initAudio } = useAudioStore();

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [songForModal, setSongForModal] = useState<Song | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get filtered songs - filter in the component to ensure reactivity
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSongs;
    }
    const query = searchQuery.toLowerCase();
    return allSongs.filter(
      (song) =>
        song._searchTitle.includes(query) || song._searchArtist.includes(query),
    );
  }, [allSongs, searchQuery]);

  // Reset selection when search query changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on searchQuery change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const selectedSong = filteredSongs[selectedIndex] || null;

  // Preview hook
  const { previewVideoUrl, onVideoReady } = usePreview({
    song: selectedSong,
    enabled: !isSearchFocused, // Disable preview when typing in search
  });

  // Background cover URL
  const backgroundCoverUrl = selectedSong
    ? selectedSong.cover_url || getFileUrl(selectedSong.id, "cover")
    : null;

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

  // Handle "/" key to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isSearchFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && isSearchFocused) {
        searchInputRef.current?.blur();
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchFocused, setSearchQuery]);

  // Open song details modal (fetch full song data first)
  const handleOpenSongModal = useCallback(
    async (songSummary: SearchableSong) => {
      await fetchSong(songSummary.id);
      const fullSong = useSongStore.getState().currentSong;
      if (fullSong) {
        setSongForModal(fullSong);
      }
    },
    [fetchSong],
  );

  const handleConfirmSelection = useCallback(() => {
    if (selectedSong) {
      handleOpenSongModal(selectedSong);
    }
  }, [selectedSong, handleOpenSongModal]);

  // Start the game from the modal
  const handleStartGame = useCallback(async () => {
    if (!songForModal) return;

    // Reset any previous game state
    resetGame();

    // Initialize audio
    await initAudio();

    // Determine max players based on whether it's a duet
    const isDuet = Boolean(
      songForModal.notes_p2 && songForModal.notes_p2.length > 0,
    );
    const maxPlayers = isDuet ? 2 : 4;

    // Create players from mic assignments
    const assignmentsToUse = micAssignments.slice(0, maxPlayers);
    for (const assignment of assignmentsToUse) {
      addPlayer(assignment.colorId, assignment.deviceId);
    }

    // Set song and start countdown
    setSongAndStart(songForModal);

    // Remove from queue if this song was requested
    await removeFromQueueBySong(songForModal.id);

    // Close modal and navigate
    setSongForModal(null);
    navigate("/play");
  }, [
    songForModal,
    resetGame,
    initAudio,
    micAssignments,
    addPlayer,
    setSongAndStart,
    navigate,
  ]);

  const handlePlayFromQueue = useCallback(
    async (entry: QueueEntry) => {
      await fetchSong(entry.song_id);
      const song = useSongStore.getState().currentSong;
      if (song) {
        setShowQueueModal(false);
        setSongForModal(song);
      }
    },
    [fetchSong],
  );

  const handleRemoveFromQueue = useCallback(async (entryId: number) => {
    await removeFromQueue(entryId);
    setQueue((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-950">
      {/* Background - Cover image or video */}
      <div className="absolute inset-0 z-0">
        {previewVideoUrl ? (
          <video
            key={previewVideoUrl}
            className="w-full h-full object-cover"
            muted={false}
            loop
            playsInline
            onLoadedMetadata={(e) => onVideoReady(e.currentTarget)}
          >
            <source src={previewVideoUrl} />
          </video>
        ) : backgroundCoverUrl ? (
          <img
            src={backgroundCoverUrl}
            alt=""
            className="w-full h-full object-cover transition-opacity duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
      </div>

      {/* Search bar - top center */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search songs..."
            className="w-full bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-5 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {!isSearchFocused && !searchQuery && (
              <kbd className="hidden sm:inline-block bg-white/10 text-gray-400 text-xs px-2 py-1 rounded">
                /
              </kbd>
            )}
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Mic settings button - top right */}
      <div className="absolute top-6 right-4 z-20">
        <button
          type="button"
          onClick={() => setShowMicSettings(true)}
          className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-md hover:bg-white/10 rounded-full transition-colors border border-white/20"
        >
          {micAssignments.length > 0 ? (
            <div className="flex -space-x-1">
              {micAssignments.map((assignment) => (
                <span
                  key={assignment.colorId}
                  className="w-4 h-4 rounded-full ring-2 ring-gray-900"
                  style={{
                    backgroundColor: getPlayerColor(assignment.colorId).hex,
                  }}
                />
              ))}
            </div>
          ) : (
            <svg
              className="w-5 h-5 text-gray-300"
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
          <span className="text-gray-200 text-sm">
            {micAssignments.length > 0
              ? `${micAssignments.length} mic${micAssignments.length > 1 ? "s" : ""}`
              : "Mics"}
          </span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-red-500/80 backdrop-blur-md text-white px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && allSongs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-white text-xl">Loading songs...</div>
        </div>
      )}

      {/* Carousel - center of screen */}
      {!isLoading && filteredSongs.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-full max-w-6xl">
            <SongCarousel
              songs={filteredSongs}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onConfirmSelection={handleConfirmSelection}
              isSearchFocused={isSearchFocused}
            />
          </div>
        </div>
      )}

      {/* No songs match search */}
      {!isLoading &&
        filteredSongs.length === 0 &&
        allSongs.length > 0 &&
        searchQuery.trim() !== "" && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-gray-400 text-xl mb-2">
                No songs match your search
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-purple-400 hover:text-purple-300"
              >
                Clear search
              </button>
            </div>
          </div>
        )}

      {/* Song title display - below carousel */}
      {selectedSong && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            {selectedSong.title}
          </h1>
          <p className="text-xl text-gray-300 drop-shadow-lg">
            {selectedSong.artist}
          </p>
          <p className="text-sm text-gray-400 mt-2">Press Enter to play</p>
        </div>
      )}

      {/* Queue indicator */}
      <QueueIndicator queue={queue} onClick={() => setShowQueueModal(true)} />

      {/* Modals */}
      {showQueueModal && (
        <QueueModal
          queue={queue}
          onPlaySong={handlePlayFromQueue}
          onRemove={handleRemoveFromQueue}
          onClose={() => setShowQueueModal(false)}
        />
      )}

      <MicSettingsModal
        isOpen={showMicSettings}
        onClose={() => setShowMicSettings(false)}
      />

      {/* Song details modal */}
      {songForModal && (
        <SongDetailsModal
          song={songForModal}
          onStart={handleStartGame}
          onCancel={() => setSongForModal(null)}
        />
      )}
    </div>
  );
}
