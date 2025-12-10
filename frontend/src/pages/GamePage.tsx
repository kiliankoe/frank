import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, useAudioStore } from "../stores";
import { MicrophoneSetup } from "../components/audio";
import {
  LyricsDisplay,
  PitchTrack,
  VideoBackground,
  ScoreDisplay,
  ProgressBar,
} from "../components/game";
import { useGame } from "../hooks/useGame";
import { getFileUrl } from "../api/client";
import { Scorer } from "../game/Scorer";

function GameSetup() {
  const navigate = useNavigate();
  const { song, setGameState } = useGameStore();
  const { selectedMicrophones, initAudio } = useAudioStore();

  useEffect(() => {
    if (!song) {
      navigate("/");
      return;
    }
    initAudio();
  }, [song, navigate, initAudio]);

  const handleStart = () => {
    if (selectedMicrophones.length === 0) {
      alert("Please select at least one microphone");
      return;
    }
    setGameState("countdown");
  };

  const handleBack = () => {
    useGameStore.getState().resetGame();
    navigate("/");
  };

  if (!song) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        type="button"
        onClick={handleBack}
        className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Songs
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white/5 rounded-lg p-6">
          <div className="flex gap-4">
            <img
              src={getFileUrl(song.id, "cover")}
              alt={song.metadata.title}
              className="w-32 h-32 rounded-lg object-cover bg-gray-800"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {song.metadata.title}
              </h1>
              <p className="text-gray-400 text-lg">{song.metadata.artist}</p>
              {song.metadata.genre && (
                <p className="text-gray-500 mt-2">{song.metadata.genre}</p>
              )}
              {song.metadata.year && (
                <p className="text-gray-500">{song.metadata.year}</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Notes:</span>
              <span className="text-white ml-2">{song.notes.length}</span>
            </div>
            <div>
              <span className="text-gray-500">BPM:</span>
              <span className="text-white ml-2">
                {Math.round(song.metadata.bpm * 4)}
              </span>
            </div>
            {song.notes_p2 && (
              <div className="col-span-2">
                <span className="text-pink-400">Duet Mode Available</span>
              </div>
            )}
          </div>
        </div>

        <MicrophoneSetup />
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={handleStart}
          disabled={selectedMicrophones.length === 0}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg text-xl font-semibold transition-colors"
        >
          Start Singing
        </button>
        {selectedMicrophones.length === 0 && (
          <p className="text-gray-400 mt-2">
            Select at least one microphone to start
          </p>
        )}
      </div>
    </div>
  );
}

function Countdown({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white mb-4">Get Ready!</h2>
        <div className="text-9xl font-bold text-purple-500 animate-pulse">
          {count || "GO!"}
        </div>
      </div>
    </div>
  );
}

function GamePlay() {
  const navigate = useNavigate();
  const { song, players: storePlayers, setGameState } = useGameStore();
  const { selectedMicrophones } = useAudioStore();

  const playerMicrophones = useMemo(() => {
    return storePlayers.map((player, index) => ({
      id: player.id,
      microphoneId: player.microphoneId || selectedMicrophones[index] || "",
      name: player.name,
    }));
  }, [storePlayers, selectedMicrophones]);

  const {
    gameEngine,
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
  } = useGame({
    song: song as NonNullable<typeof song>,
    playerMicrophones,
  });

  const scorer = useMemo(() => new Scorer(), []);

  // Calculate max score per track
  const maxScoreP1 = useMemo(
    () => (song ? scorer.calculateMaxScore(song.notes) : 0),
    [song, scorer],
  );
  const maxScoreP2 = useMemo(
    () =>
      song?.notes_p2 ? scorer.calculateMaxScore(song.notes_p2) : maxScoreP1,
    [song, scorer, maxScoreP1],
  );

  // Helper to get max score for a player based on their track
  const getPlayerMaxScore = (playerId: number) => {
    if (!gameEngine) return maxScoreP1;
    const track = gameEngine.getPlayerTrack(playerId);
    return track === 2 ? maxScoreP2 : maxScoreP1;
  };

  useEffect(() => {
    if (gameState === "ready") {
      start();
    }
  }, [gameState, start]);

  useEffect(() => {
    if (gameState === "finished") {
      // Update store with final scores
      for (const player of players) {
        const storePlayer = storePlayers.find((p) => p.id === player.id);
        if (storePlayer) {
          for (const [, noteScore] of player.noteScores) {
            useGameStore.getState().updatePlayerScore(player.id, {
              noteIndex: noteScore.noteIndex,
              maxPoints: noteScore.maxPoints,
              earnedPoints: noteScore.earnedPoints,
              accuracy: noteScore.accuracy,
            });
          }
        }
      }
      setGameState("finished");
      navigate("/results");
    }
  }, [gameState, players, storePlayers, setGameState, navigate]);

  const handlePause = useCallback(() => {
    if (gameState === "playing") {
      pause();
    } else if (gameState === "paused") {
      resume();
    }
  }, [gameState, pause, resume]);

  const handleEnd = useCallback(() => {
    setGameState("finished");
    navigate("/results");
  }, [setGameState, navigate]);

  const handleSkip = useCallback(() => {
    if (!gameEngine) return;

    const currentTime = gameEngine.getCurrentTime();
    const nextNote = gameEngine.getNextNoteAcrossAllTracks(currentTime);

    if (nextNote) {
      // Skip to 5 seconds before the next note
      const skipToTime = Math.max(0, nextNote.startTimeMs - 5000);
      // Only skip forward, not backward
      if (skipToTime > currentTime) {
        gameEngine.seekTo(skipToTime);
      }
    } else {
      // No more notes, skip to results
      handleEnd();
    }
  }, [gameEngine, handleEnd]);

  // Keyboard shortcuts: spacebar for pause/resume, escape to exit, S to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handlePause();
      } else if (e.code === "Escape") {
        e.preventDefault();
        handleEnd();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePause, handleEnd, handleSkip]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-2xl text-white mb-4">Loading...</div>
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-2xl text-red-500 mb-4">Error</div>
          <div className="text-gray-400">{error}</div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded"
          >
            Back to Songs
          </button>
        </div>
      </div>
    );
  }

  if (!song || !gameEngine) return null;

  const primaryNoteTracker = gameEngine.getNoteTracker(1);
  const secondaryNoteTracker = gameEngine.getNoteTracker(2);
  const isDuet = secondaryNoteTracker !== null;

  // Get phrases for both tracks
  const nextPhrase = primaryNoteTracker?.getNextPhrase(currentTimeMs) ?? null;
  const duration = primaryNoteTracker?.getSongDuration() ?? 0;

  // P2 phrases for duets
  const currentPhraseP2 =
    secondaryNoteTracker?.getCurrentPhrase(currentTimeMs) ?? null;
  const nextPhraseP2 =
    secondaryNoteTracker?.getNextPhrase(currentTimeMs) ?? null;

  // Helper to get visible notes for a specific player's track
  const getPlayerNotes = (playerId: number) => {
    const track = gameEngine.getPlayerTrack(playerId);
    const tracker = gameEngine.getNoteTracker(track);
    return (
      tracker?.getNotesInRange(currentTimeMs - 1000, currentTimeMs + 3000) ?? []
    );
  };

  const videoUrl = song.metadata.video_file
    ? getFileUrl(song.id, "video")
    : null;
  const backgroundUrl = song.metadata.background_file
    ? getFileUrl(song.id, "background")
    : null;

  const playerColors = ["#a855f7", "#ec4899", "#3b82f6", "#10b981"];

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Video/Background */}
      <div className="absolute inset-0">
        <VideoBackground
          videoUrl={videoUrl}
          backgroundUrl={backgroundUrl}
          audioElement={audioElement}
          videoGap={song.metadata.video_gap ?? 0}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Game UI */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Top bar */}
        <div className="p-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">
              {song.metadata.title}
            </h2>
            <p className="text-gray-400">{song.metadata.artist}</p>
          </div>
          <div className="flex items-start gap-4">
            <ScoreDisplay
              players={players.map((p, i) => ({
                id: p.id,
                name:
                  storePlayers.find((sp) => sp.id === p.id)?.name ??
                  `Player ${i + 1}`,
                score: p.score,
                color: playerColors[i % playerColors.length],
                maxScore: getPlayerMaxScore(p.id),
              }))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePause}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                title={gameState === "paused" ? "Resume (Space)" : "Pause (Space)"}
              >
                {gameState === "paused" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleEnd}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="End Song (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Pitch tracks */}
        <div className="flex-1 px-4 space-y-2">
          {players.map((player, index) => (
            <div
              key={player.id}
              className="h-32 bg-black/30 rounded-lg overflow-hidden"
            >
              <PitchTrack
                notes={getPlayerNotes(player.id)}
                currentTimeMs={currentTimeMs}
                playerPitch={player.currentPitch}
                pitchHistory={player.pitchHistory}
                playerColor={playerColors[index % playerColors.length]}
              />
            </div>
          ))}
        </div>

        {/* Lyrics */}
        <div className="px-4">
          <LyricsDisplay
            currentPhrase={currentPhrase}
            nextPhrase={nextPhrase}
            currentTimeMs={currentTimeMs}
            currentPhraseP2={isDuet ? currentPhraseP2 : undefined}
            nextPhraseP2={isDuet ? nextPhraseP2 : undefined}
            singerP1={
              isDuet ? (song.metadata.duet_singer_p1 ?? "Player 1") : undefined
            }
            singerP2={
              isDuet ? (song.metadata.duet_singer_p2 ?? "Player 2") : undefined
            }
          />
        </div>

        {/* Bottom bar */}
        <div className="p-4">
          <ProgressBar currentTimeMs={currentTimeMs} durationMs={duration} />
        </div>
      </div>
    </div>
  );
}

export function GamePage() {
  const { gameState, setGameState } = useGameStore();

  if (gameState === "setup" || gameState === "idle") {
    return <GameSetup />;
  }

  if (gameState === "countdown") {
    return <Countdown onComplete={() => setGameState("playing")} />;
  }

  return <GamePlay />;
}
