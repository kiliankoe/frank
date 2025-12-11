import { create } from "zustand";
import type { Song, SongSummary, SearchableSong } from "../api/types";
import { getSongs, getSong } from "../api/client";

// Convert SongSummary to SearchableSong with pre-computed lowercase fields
function toSearchableSong(song: SongSummary): SearchableSong {
  return {
    ...song,
    _searchTitle: song.title.toLowerCase(),
    _searchArtist: song.artist.toLowerCase(),
  };
}

interface SongState {
  // All songs with pre-computed search fields
  allSongs: SearchableSong[];
  currentSong: Song | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Computed filtered songs based on search query
  getFilteredSongs: () => SearchableSong[];

  fetchSongs: () => Promise<void>;
  fetchSong: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearCurrentSong: () => void;
}

export const useSongStore = create<SongState>((set, get) => ({
  allSongs: [],
  currentSong: null,
  searchQuery: "",
  isLoading: false,
  error: null,

  getFilteredSongs: () => {
    const { allSongs, searchQuery } = get();
    if (!searchQuery.trim()) {
      return allSongs;
    }
    const query = searchQuery.toLowerCase();
    return allSongs.filter(
      (song) =>
        song._searchTitle.includes(query) || song._searchArtist.includes(query),
    );
  },

  fetchSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const songs = await getSongs();
      // Pre-compute lowercase fields for all songs once
      const searchableSongs = songs.map(toSearchableSong);
      set({ allSongs: searchableSongs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchSong: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const song = await getSong(id);
      set({ currentSong: song, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  clearCurrentSong: () => set({ currentSong: null }),
}));
