import { create } from "zustand";
import type { Song } from "../api/types";

export type GameState =
  | "idle"
  | "setup"
  | "countdown"
  | "playing"
  | "paused"
  | "finished";

export interface Player {
  id: number;
  color: string; // Color ID from playerColors constants
  microphoneId?: string;
  score: number;
  noteScores: NoteScore[];
}

export interface NoteScore {
  noteIndex: number;
  maxPoints: number;
  earnedPoints: number;
  accuracy: number;
}

interface GameStoreState {
  gameState: GameState;
  song: Song | null;
  players: Player[];
  currentTime: number;
  currentBeat: number;
  startTime: number | null;

  setSong: (song: Song) => void;
  setGameState: (state: GameState) => void;
  addPlayer: (color: string, microphoneId?: string) => void;
  removePlayer: (id: number) => void;
  updatePlayerScore: (playerId: number, noteScore: NoteScore) => void;
  setCurrentTime: (time: number) => void;
  setCurrentBeat: (beat: number) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  restartSameSong: () => void;
}

let playerIdCounter = 0;

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: "idle",
  song: null,
  players: [],
  currentTime: 0,
  currentBeat: 0,
  startTime: null,

  setSong: (song) => set({ song, gameState: "setup" }),

  setGameState: (gameState) => set({ gameState }),

  addPlayer: (color, microphoneId) => {
    const id = ++playerIdCounter;
    set((state) => ({
      players: [
        ...state.players,
        { id, color, microphoneId, score: 0, noteScores: [] },
      ],
    }));
  },

  removePlayer: (id) => {
    set((state) => ({
      players: state.players.filter((p) => p.id !== id),
    }));
  },

  updatePlayerScore: (playerId, noteScore) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              noteScores: [...p.noteScores, noteScore],
              score: p.score + noteScore.earnedPoints,
            }
          : p,
      ),
    }));
  },

  setCurrentTime: (currentTime) => set({ currentTime }),

  setCurrentBeat: (currentBeat) => set({ currentBeat }),

  startGame: () => {
    set({
      gameState: "countdown",
      startTime: null,
      currentTime: 0,
      currentBeat: 0,
    });
  },

  pauseGame: () => {
    const { gameState } = get();
    if (gameState === "playing") {
      set({ gameState: "paused" });
    }
  },

  resumeGame: () => {
    const { gameState } = get();
    if (gameState === "paused") {
      set({ gameState: "playing" });
    }
  },

  endGame: () => set({ gameState: "finished" }),

  resetGame: () => {
    set({
      gameState: "idle",
      song: null,
      players: [],
      currentTime: 0,
      currentBeat: 0,
      startTime: null,
    });
    playerIdCounter = 0;
  },

  restartSameSong: () => {
    set((state) => ({
      gameState: "setup",
      players: state.players.map((p) => ({
        ...p,
        score: 0,
        noteScores: [],
      })),
      currentTime: 0,
      currentBeat: 0,
      startTime: null,
    }));
  },
}));
