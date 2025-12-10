import type { SongSummary } from "../../api/types";
import { SongCard } from "./SongCard";

interface SongListProps {
  songs: SongSummary[];
  onSelectSong: (song: SongSummary) => void;
  isLoading?: boolean;
}

export function SongList({ songs, onSelectSong, isLoading }: SongListProps) {
  if (isLoading) {
    // Static skeleton placeholders - array index is fine as key since order never changes
    const skeletons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {skeletons.map((id) => (
          <div key={id} className="animate-pulse">
            <div className="aspect-square bg-white/10 rounded-lg" />
            <div className="mt-2 h-4 bg-white/10 rounded w-3/4" />
            <div className="mt-1 h-3 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No songs found</p>
        <p className="text-gray-500 text-sm mt-2">
          Add UltraStar songs to the songs directory and restart the server
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {songs.map((song) => (
        <SongCard key={song.id} song={song} onSelect={onSelectSong} />
      ))}
    </div>
  );
}
