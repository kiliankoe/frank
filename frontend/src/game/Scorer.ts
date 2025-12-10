import type { Note } from "../api/types";
import type { PitchSample, NoteResult } from "./types";
import { getPitchAccuracy } from "../utils/pitchUtils";

const POINTS_PER_BEAT = 10;
const GOLDEN_MULTIPLIER = 2;

export class Scorer {
  /**
   * Calculate the score for a completed note
   */
  calculateNoteScore(
    note: Note,
    noteIndex: number,
    pitchSamples: PitchSample[],
  ): NoteResult {
    const multiplier =
      note.note_type === "golden" || note.note_type === "goldenrap"
        ? GOLDEN_MULTIPLIER
        : 1;

    const maxPoints = note.length * POINTS_PER_BEAT * multiplier;

    // Freestyle and rap notes don't require pitch matching
    if (note.note_type === "freestyle") {
      return {
        noteIndex,
        maxPoints: 0,
        earnedPoints: 0,
        accuracy: 1,
        pitchSamples,
      };
    }

    if (note.note_type === "rap" || note.note_type === "goldenrap") {
      // Rap notes just need to detect sound (any pitch)
      const validSamples = pitchSamples.filter((s) => s.frequency > 0);
      const accuracy =
        pitchSamples.length > 0 ? validSamples.length / pitchSamples.length : 0;

      return {
        noteIndex,
        maxPoints,
        earnedPoints: Math.round(maxPoints * accuracy),
        accuracy,
        pitchSamples,
      };
    }

    // Normal and golden notes need pitch matching
    if (pitchSamples.length === 0) {
      return {
        noteIndex,
        maxPoints,
        earnedPoints: 0,
        accuracy: 0,
        pitchSamples,
      };
    }

    // Use weighted accuracy scoring - partial credit for close pitches
    let totalAccuracy = 0;
    let validSamples = 0;

    for (const sample of pitchSamples) {
      if (sample.frequency > 0) {
        totalAccuracy += getPitchAccuracy(sample.frequency, note.pitch);
        validSamples++;
      }
    }

    // Calculate weighted accuracy
    // Give some baseline credit for singing (even if off-pitch) to feel more rewarding
    const pitchAccuracy = validSamples > 0 ? totalAccuracy / validSamples : 0;
    const participationBonus = validSamples > 0 ? 0.1 : 0; // Small bonus for any sound
    const accuracy = Math.min(1, pitchAccuracy + participationBonus);

    const earnedPoints = Math.round(maxPoints * accuracy);

    return {
      noteIndex,
      maxPoints,
      earnedPoints,
      accuracy,
      pitchSamples,
    };
  }

  /**
   * Calculate total possible score for a song
   */
  calculateMaxScore(notes: Note[]): number {
    return notes.reduce((total, note) => {
      if (note.note_type === "freestyle") return total;

      const multiplier =
        note.note_type === "golden" || note.note_type === "goldenrap"
          ? GOLDEN_MULTIPLIER
          : 1;

      return total + note.length * POINTS_PER_BEAT * multiplier;
    }, 0);
  }
}
