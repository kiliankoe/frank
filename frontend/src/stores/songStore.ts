import { create } from "zustand";
import type { Song, SongSummary } from "../api/types";
import { getSongs, getSong, searchSongs } from "../api/client";

interface SongState {
  songs: SongSummary[];
  currentSong: Song | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  fetchSongs: () => Promise<void>;
  fetchSong: (id: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearCurrentSong: () => void;
}

export const useSongStore = create<SongState>((set) => ({
  songs: [],
  currentSong: null,
  searchQuery: "",
  isLoading: false,
  error: null,

  fetchSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const songs = await getSongs();
      set({ songs, isLoading: false });
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

  search: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query });
    try {
      const songs = query ? await searchSongs(query) : await getSongs();
      set({ songs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  clearCurrentSong: () => set({ currentSong: null }),
}));
