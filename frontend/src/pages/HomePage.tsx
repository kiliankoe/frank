import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSongStore, useGameStore } from "../stores";
import { SongSearch, SongList } from "../components/songs";
import type { SongSummary } from "../api/types";

export function HomePage() {
  const navigate = useNavigate();
  const { songs, isLoading, error, fetchSongs } = useSongStore();
  const { setSong } = useGameStore();
  const { fetchSong } = useSongStore();

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleSelectSong = async (songSummary: SongSummary) => {
    await fetchSong(songSummary.id);
    const song = useSongStore.getState().currentSong;
    if (song) {
      setSong(song);
      navigate("/play");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Choose a Song</h1>
        <p className="text-gray-400">Select a song to start singing</p>
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
  );
}
