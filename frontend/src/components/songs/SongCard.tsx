import type { SongSummary } from "../../api/types";
import { getFileUrl } from "../../api/client";

interface SongCardProps {
  song: SongSummary;
  onSelect: (song: SongSummary) => void;
}

export function SongCard({ song, onSelect }: SongCardProps) {
  const coverUrl = song.cover_url || getFileUrl(song.id, "cover");

  return (
    <button
      type="button"
      onClick={() => onSelect(song)}
      className="group relative bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all duration-200 text-left w-full"
    >
      <div className="aspect-square bg-gray-800 relative overflow-hidden">
        <img
          src={coverUrl}
          alt={`${song.title} cover`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {song.has_video && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
              Video
            </span>
          )}
          {song.is_duet && (
            <span className="bg-pink-600 text-white text-xs px-2 py-0.5 rounded">
              Duet
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-white truncate">{song.title}</h3>
        <p className="text-gray-400 text-sm truncate">{song.artist}</p>
        {song.genre && (
          <p className="text-gray-500 text-xs mt-1">{song.genre}</p>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="bg-purple-600 text-white px-4 py-2 rounded-full font-medium">
          Play
        </span>
      </div>
    </button>
  );
}
