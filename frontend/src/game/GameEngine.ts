import type { Song } from "../api/types";
import type { PlayerState, PitchSample, NoteResult, Phrase } from "./types";
import { AudioEngine } from "../audio/AudioEngine";
import { NoteTracker } from "./NoteTracker";
import { Scorer } from "./Scorer";
import { getFileUrl } from "../api/client";
import { msToBeat } from "../utils/timeUtils";

export type GameEngineState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "finished";

export interface GameEngineCallbacks {
  onStateChange?: (state: GameEngineState) => void;
  onTimeUpdate?: (timeMs: number, beat: number) => void;
  onNoteComplete?: (playerId: number, result: NoteResult) => void;
  onPitchUpdate?: (playerId: number, pitch: number) => void;
  onPhraseChange?: (phrase: Phrase | null) => void;
  onGameEnd?: () => void;
}

export class GameEngine {
  private song: Song | null = null;
  private audioEngine: AudioEngine;
  private noteTrackers: Map<number, NoteTracker> = new Map(); // track -> NoteTracker (1 = P1, 2 = P2)
  private scorer: Scorer;
  private state: GameEngineState = "idle";
  private players: Map<number, PlayerState> = new Map();
  private playerTracks: Map<number, number> = new Map(); // playerId -> track (1 or 2)
  private callbacks: GameEngineCallbacks = {};
  private animationFrameId: number | null = null;
  private currentNoteIndices: Map<number, number> = new Map();
  private notePitchSamples: Map<number, Map<number, PitchSample[]>> = new Map();

  constructor() {
    this.audioEngine = new AudioEngine();
    this.scorer = new Scorer();
  }

  setCallbacks(callbacks: GameEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  async loadSong(song: Song): Promise<void> {
    this.setState("loading");
    this.song = song;

    // Load audio
    const audioUrl = getFileUrl(song.id, "audio");
    const audioElement = this.audioEngine.loadAudio(audioUrl);

    // Wait for audio to be loadable
    await new Promise<void>((resolve, reject) => {
      audioElement.addEventListener("canplaythrough", () => resolve(), {
        once: true,
      });
      audioElement.addEventListener(
        "error",
        () => reject(new Error("Failed to load audio")),
        { once: true },
      );
    });

    // Create note trackers for each track
    this.noteTrackers.set(
      1,
      new NoteTracker(
        song.notes,
        song.line_breaks,
        song.metadata.bpm,
        song.metadata.gap,
      ),
    );

    // For duets, create a separate tracker for P2
    if (song.notes_p2 && song.notes_p2.length > 0) {
      this.noteTrackers.set(
        2,
        new NoteTracker(
          song.notes_p2,
          song.line_breaks_p2 ?? [],
          song.metadata.bpm,
          song.metadata.gap,
        ),
      );
    }

    // Set up end handler
    audioElement.addEventListener("ended", () => {
      this.endGame();
    });

    this.setState("ready");
  }

  addPlayer(id: number, microphoneId: string, track?: number): void {
    // Auto-assign track: first player to track 1, second to track 2 (if duet)
    const assignedTrack =
      track ?? (this.players.size === 0 ? 1 : this.noteTrackers.has(2) ? 2 : 1);

    this.players.set(id, {
      id,
      microphoneId,
      score: 0,
      currentPitch: -1,
      pitchHistory: [],
      noteScores: new Map(),
    });
    this.playerTracks.set(id, assignedTrack);
    this.currentNoteIndices.set(id, -1);
    this.notePitchSamples.set(id, new Map());
  }

  removePlayer(id: number): void {
    this.players.delete(id);
    this.playerTracks.delete(id);
    this.currentNoteIndices.delete(id);
    this.notePitchSamples.delete(id);
  }

  async connectPlayerMicrophones(): Promise<void> {
    const micManager = this.audioEngine.getMicrophoneManager();

    for (const player of this.players.values()) {
      try {
        await micManager.connectMicrophone(player.microphoneId);
      } catch (err) {
        console.error("Failed to connect mic for player", player.id, err);
      }
    }
  }

  async start(): Promise<void> {
    if (this.state !== "ready" && this.state !== "paused") {
      throw new Error("Game not ready to start");
    }

    await this.audioEngine.resume();
    await this.connectPlayerMicrophones();

    this.audioEngine.play();
    this.setState("playing");
    this.startGameLoop();
  }

  pause(): void {
    if (this.state !== "playing") return;

    this.audioEngine.pause();
    this.setState("paused");
    this.stopGameLoop();
  }

  resume(): void {
    if (this.state !== "paused") return;

    this.audioEngine.play();
    this.setState("playing");
    this.startGameLoop();
  }

  stop(): void {
    this.audioEngine.stop();
    this.stopGameLoop();
    this.setState("ready");
  }

  private startGameLoop(): void {
    const loop = () => {
      this.update();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopGameLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private update(): void {
    const primaryTracker = this.noteTrackers.get(1);
    if (!primaryTracker || !this.song) return;

    const timeMs = this.audioEngine.getCurrentTime();
    const beat = msToBeat(
      timeMs,
      this.song.metadata.bpm,
      this.song.metadata.gap,
    );

    // Notify time update
    this.callbacks.onTimeUpdate?.(timeMs, beat);

    // Get current phrase (from primary track for display)
    const currentPhrase = primaryTracker.getCurrentPhrase(timeMs);
    this.callbacks.onPhraseChange?.(currentPhrase);

    // Update each player
    const micManager = this.audioEngine.getMicrophoneManager();

    for (const player of this.players.values()) {
      // Get the note tracker for this player's track
      const playerTrack = this.playerTracks.get(player.id) ?? 1;
      const noteTracker = this.noteTrackers.get(playerTrack) ?? primaryTracker;

      // Get current pitch
      const pitch = micManager.getPitch(player.microphoneId);
      player.currentPitch = pitch;

      // Add to history
      if (pitch > 0) {
        player.pitchHistory.push({ timeMs, frequency: pitch });
        // Keep only last 5 seconds
        const cutoff = timeMs - 5000;
        player.pitchHistory = player.pitchHistory.filter(
          (s) => s.timeMs > cutoff,
        );
      }

      this.callbacks.onPitchUpdate?.(player.id, pitch);

      // Check for current note (using player's track)
      const currentNote = noteTracker.getCurrentNote(timeMs);
      const lastNoteIndex = this.currentNoteIndices.get(player.id) ?? -1;

      if (currentNote) {
        // If we're in a note, collect pitch samples
        let samples = this.notePitchSamples
          .get(player.id)
          ?.get(currentNote.index);
        if (!samples) {
          samples = [];
          this.notePitchSamples.get(player.id)?.set(currentNote.index, samples);
        }
        samples.push({ timeMs, frequency: pitch });

        this.currentNoteIndices.set(player.id, currentNote.index);
      } else if (lastNoteIndex >= 0) {
        // Note just ended, calculate score
        const samples =
          this.notePitchSamples.get(player.id)?.get(lastNoteIndex) ?? [];
        const note = noteTracker.getAllNotes()[lastNoteIndex];

        if (note) {
          const result = this.scorer.calculateNoteScore(
            note,
            note.index,
            samples,
          );

          player.score += result.earnedPoints;
          player.noteScores.set(note.index, result);

          this.callbacks.onNoteComplete?.(player.id, result);
        }

        this.currentNoteIndices.set(player.id, -1);
      }
    }
  }

  private endGame(): void {
    this.stopGameLoop();
    this.setState("finished");
    this.callbacks.onGameEnd?.();
  }

  private setState(state: GameEngineState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  getState(): GameEngineState {
    return this.state;
  }

  getSong(): Song | null {
    return this.song;
  }

  getNoteTracker(track: number = 1): NoteTracker | null {
    return this.noteTrackers.get(track) ?? null;
  }

  getPlayerTrack(playerId: number): number {
    return this.playerTracks.get(playerId) ?? 1;
  }

  getPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getPlayer(id: number): PlayerState | undefined {
    return this.players.get(id);
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }

  seekTo(timeMs: number): void {
    const audioElement = this.audioEngine.getAudioElement();
    if (audioElement) {
      audioElement.currentTime = timeMs / 1000;
    }
  }

  /**
   * Get the next note across all tracks after the current time
   */
  getNextNoteAcrossAllTracks(timeMs: number): { startTimeMs: number } | null {
    let earliestNote: { startTimeMs: number } | null = null;

    for (const tracker of this.noteTrackers.values()) {
      const nextNote = tracker.getNextNote(timeMs);
      if (
        nextNote &&
        (!earliestNote || nextNote.startTimeMs < earliestNote.startTimeMs)
      ) {
        earliestNote = nextNote;
      }
    }

    return earliestNote;
  }

  getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  dispose(): void {
    this.stopGameLoop();
    this.audioEngine.dispose();
  }
}
