import type { Note, LineBreak } from "../api/types";

export interface GameNote extends Note {
  index: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface Phrase {
  notes: GameNote[];
  startTimeMs: number;
  endTimeMs: number;
  lineBreak: LineBreak | null;
}

export interface PlayerState {
  id: number;
  microphoneId: string;
  score: number;
  currentPitch: number;
  pitchHistory: PitchSample[];
  noteScores: Map<number, NoteResult>;
}

export interface PitchSample {
  timeMs: number;
  frequency: number;
}

export interface NoteResult {
  noteIndex: number;
  maxPoints: number;
  earnedPoints: number;
  accuracy: number;
  pitchSamples: PitchSample[];
}
