import { useEffect, useCallback, useRef, memo } from "react";
import type { SearchableSong } from "../../api/types";
import { getFileUrl } from "../../api/client";

interface CarouselCardProps {
  song: SearchableSong;
  offset: number; // Distance from center (-3, -2, -1, 0, 1, 2, 3)
  onClick: () => void;
}

// Memoized card to prevent re-renders when offset doesn't change
const CarouselCard = memo(function CarouselCard({
  song,
  offset,
  onClick,
}: CarouselCardProps) {
  const coverUrl = song.cover_url || getFileUrl(song.id, "cover");
  const isCenter = offset === 0;

  // Calculate transform based on offset from center
  const scale = isCenter ? 1 : Math.max(0.6, 1 - Math.abs(offset) * 0.15);
  const translateX = offset * 220; // Spacing between cards
  const zIndex = 10 - Math.abs(offset);
  const opacity = Math.max(0.3, 1 - Math.abs(offset) * 0.2);

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-1/2 top-1/2 w-48 transition-all duration-300 ease-out focus:outline-none"
      style={{
        transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale})`,
        zIndex,
        opacity,
      }}
    >
      <div
        className={`rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isCenter
            ? "ring-4 ring-purple-500 ring-opacity-75"
            : "hover:ring-2 hover:ring-white/30"
        }`}
      >
        <div className="aspect-square bg-gray-800 relative">
          <img
            src={coverUrl}
            alt={`${song.title} cover`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Badges */}
          {isCenter && (
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
          )}
        </div>
        {isCenter && (
          <div className="p-3 bg-black/80">
            <h3 className="font-semibold text-white text-center truncate">
              {song.title}
            </h3>
            <p className="text-gray-400 text-sm text-center truncate">
              {song.artist}
            </p>
          </div>
        )}
      </div>
    </button>
  );
});

interface SongCarouselProps {
  songs: SearchableSong[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onConfirmSelection: () => void;
  isSearchFocused: boolean;
}

// Number of cards to render on each side of center
const VISIBLE_RANGE = 4;

export function SongCarousel({
  songs,
  selectedIndex,
  onSelectIndex,
  onConfirmSelection,
  isSearchFocused,
}: SongCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle navigation when search is focused
      if (isSearchFocused) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onSelectIndex(Math.max(0, selectedIndex - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          onSelectIndex(Math.min(songs.length - 1, selectedIndex + 1));
          break;
        case "Enter":
          e.preventDefault();
          onConfirmSelection();
          break;
      }
    },
    [
      selectedIndex,
      songs.length,
      onSelectIndex,
      onConfirmSelection,
      isSearchFocused,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (songs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-lg">No songs found</p>
      </div>
    );
  }

  // Only render visible cards for performance
  const visibleCards: {
    song: SearchableSong;
    offset: number;
    index: number;
  }[] = [];
  for (let i = -VISIBLE_RANGE; i <= VISIBLE_RANGE; i++) {
    const index = selectedIndex + i;
    if (index >= 0 && index < songs.length) {
      visibleCards.push({
        song: songs[index],
        offset: i,
        index,
      });
    }
  }

  return (
    <div ref={containerRef} className="relative h-80 w-full overflow-hidden">
      {visibleCards.map(({ song, offset, index }) => (
        <CarouselCard
          key={song.id}
          song={song}
          offset={offset}
          onClick={() => {
            if (offset === 0) {
              onConfirmSelection();
            } else {
              onSelectIndex(index);
            }
          }}
        />
      ))}

      {/* Navigation hints */}
      {selectedIndex > 0 && (
        <button
          type="button"
          onClick={() => onSelectIndex(selectedIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
          aria-label="Previous song"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      {selectedIndex < songs.length - 1 && (
        <button
          type="button"
          onClick={() => onSelectIndex(selectedIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
          aria-label="Next song"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Position indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-gray-400 text-sm z-20">
        {selectedIndex + 1} / {songs.length}
      </div>
    </div>
  );
}
