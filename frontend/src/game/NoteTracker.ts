import type { Note, LineBreak } from "../api/types";
import type { GameNote, Phrase } from "./types";
import { beatToMs } from "../utils/timeUtils";

export class NoteTracker {
  private notes: GameNote[];
  private phrases: Phrase[];
  private bpm: number;
  private gap: number;

  constructor(
    notes: Note[],
    lineBreaks: LineBreak[],
    bpm: number,
    gap: number,
  ) {
    this.bpm = bpm;
    this.gap = gap;
    this.notes = this.processNotes(notes);
    this.phrases = this.buildPhrases(this.notes, lineBreaks);
  }

  private processNotes(notes: Note[]): GameNote[] {
    return notes.map((note, index) => ({
      ...note,
      index,
      startTimeMs: beatToMs(note.start_beat, this.bpm, this.gap),
      endTimeMs: beatToMs(note.start_beat + note.length, this.bpm, this.gap),
    }));
  }

  private buildPhrases(notes: GameNote[], lineBreaks: LineBreak[]): Phrase[] {
    if (notes.length === 0) return [];

    const phrases: Phrase[] = [];
    let currentPhraseNotes: GameNote[] = [];
    let lineBreakIndex = 0;

    for (const note of notes) {
      // Check if we've passed a line break
      while (
        lineBreakIndex < lineBreaks.length &&
        note.start_beat >= lineBreaks[lineBreakIndex].start_beat
      ) {
        if (currentPhraseNotes.length > 0) {
          phrases.push(
            this.createPhrase(
              currentPhraseNotes,
              lineBreaks[lineBreakIndex - 1] ?? null,
            ),
          );
          currentPhraseNotes = [];
        }
        lineBreakIndex++;
      }

      currentPhraseNotes.push(note);
    }

    // Add remaining notes as final phrase
    if (currentPhraseNotes.length > 0) {
      phrases.push(
        this.createPhrase(
          currentPhraseNotes,
          lineBreaks[lineBreakIndex - 1] ?? null,
        ),
      );
    }

    return phrases;
  }

  private createPhrase(notes: GameNote[], lineBreak: LineBreak | null): Phrase {
    return {
      notes,
      startTimeMs: notes[0].startTimeMs,
      endTimeMs: notes[notes.length - 1].endTimeMs,
      lineBreak,
    };
  }

  /**
   * Get all notes
   */
  getAllNotes(): GameNote[] {
    return this.notes;
  }

  /**
   * Get all phrases
   */
  getAllPhrases(): Phrase[] {
    return this.phrases;
  }

  /**
   * Get the current note at a given time
   */
  getCurrentNote(timeMs: number): GameNote | null {
    return (
      this.notes.find(
        (note) => timeMs >= note.startTimeMs && timeMs <= note.endTimeMs,
      ) ?? null
    );
  }

  /**
   * Get the next upcoming note after the current time
   */
  getNextNote(timeMs: number): GameNote | null {
    return this.notes.find((note) => note.startTimeMs > timeMs) ?? null;
  }

  /**
   * Get notes within a time range (for visualization)
   */
  getNotesInRange(startMs: number, endMs: number): GameNote[] {
    return this.notes.filter(
      (note) => note.endTimeMs >= startMs && note.startTimeMs <= endMs,
    );
  }

  /**
   * Get the current phrase at a given time
   */
  getCurrentPhrase(timeMs: number): Phrase | null {
    return (
      this.phrases.find(
        (phrase) =>
          timeMs >= phrase.startTimeMs - 2000 &&
          timeMs <= phrase.endTimeMs + 500,
      ) ?? null
    );
  }

  /**
   * Get the next phrase after the current one
   * This accounts for the lead-in window used by getCurrentPhrase
   */
  getNextPhrase(timeMs: number): Phrase | null {
    const currentPhrase = this.getCurrentPhrase(timeMs);
    if (currentPhrase) {
      // Find the phrase after the current one
      const currentIndex = this.phrases.indexOf(currentPhrase);
      return this.phrases[currentIndex + 1] ?? null;
    }
    // No current phrase - return the first upcoming phrase
    return this.phrases.find((phrase) => phrase.startTimeMs > timeMs) ?? null;
  }

  /**
   * Get total song duration based on notes
   */
  getSongDuration(): number {
    if (this.notes.length === 0) return 0;
    return this.notes[this.notes.length - 1].endTimeMs;
  }

  /**
   * Get progress through the song (0-1)
   */
  getProgress(timeMs: number): number {
    const duration = this.getSongDuration();
    if (duration === 0) return 0;
    return Math.min(1, Math.max(0, timeMs / duration));
  }
}
