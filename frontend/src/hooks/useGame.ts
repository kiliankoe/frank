import { useState, useEffect, useRef, useCallback } from "react";
import type { Song } from "../api/types";
import { GameEngine, type GameEngineState } from "../game/GameEngine";
import type { Phrase, PlayerState } from "../game/types";

interface UseGameOptions {
  song: Song;
  playerMicrophones: { id: number; microphoneId: string; name: string }[];
}

interface UseGameReturn {
  gameEngine: GameEngine | null;
  gameState: GameEngineState;
  currentTimeMs: number;
  currentPhrase: Phrase | null;
  players: PlayerState[];
  isLoading: boolean;
  error: string | null;
  audioElement: HTMLAudioElement | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useGame({
  song,
  playerMicrophones,
}: UseGameOptions): UseGameReturn {
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameEngineState>("idle");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );

  // Initialize game engine
  useEffect(() => {
    const engine = new GameEngine();
    engineRef.current = engine;

    engine.setCallbacks({
      onStateChange: setGameState,
      onTimeUpdate: (timeMs) => {
        setCurrentTimeMs(timeMs);
      },
      onPhraseChange: setCurrentPhrase,
      onPitchUpdate: () => {
        // Update players state to trigger re-render with new pitch
        setPlayers([...engine.getPlayers()]);
      },
      onNoteComplete: () => {
        setPlayers([...engine.getPlayers()]);
      },
      onGameEnd: () => {
        setPlayers([...engine.getPlayers()]);
      },
    });

    // Add players
    for (const player of playerMicrophones) {
      engine.addPlayer(player.id, player.microphoneId);
    }

    // Load song
    setIsLoading(true);
    setError(null);
    engine
      .loadSong(song)
      .then(() => {
        setIsLoading(false);
        setPlayers([...engine.getPlayers()]);
        setAudioElement(engine.getAudioEngine().getAudioElement());
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      engine.dispose();
    };
  }, [song, playerMicrophones]);

  const start = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.start();
    }
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return {
    gameEngine: engineRef.current,
    gameState,
    currentTimeMs,
    currentPhrase,
    players,
    isLoading,
    error,
    audioElement,
    start,
    pause,
    resume,
    stop,
  };
}
