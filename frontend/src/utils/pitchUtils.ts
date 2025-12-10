/**
 * Convert UltraStar pitch (0 = C4) to MIDI note number (60 = C4)
 */
export function ultrastarPitchToMidi(pitch: number): number {
  return pitch + 60;
}

/**
 * Convert MIDI note number to UltraStar pitch
 */
export function midiToUltrastarPitch(midi: number): number {
  return midi - 60;
}

/**
 * Convert frequency in Hz to MIDI note number
 */
export function frequencyToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 12 * Math.log2(freq / 440) + 69;
}

/**
 * Convert MIDI note number to frequency in Hz
 */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Convert frequency to UltraStar pitch
 */
export function frequencyToUltrastarPitch(freq: number): number {
  return midiToUltrastarPitch(frequencyToMidi(freq));
}

/**
 * Check if detected pitch matches expected pitch (with octave tolerance)
 * @param detectedFreq - Detected frequency in Hz
 * @param expectedPitch - Expected UltraStar pitch (0 = C4)
 * @param tolerance - Semitone tolerance (default 2.5 - slightly forgiving)
 */
export function isPitchMatch(
  detectedFreq: number,
  expectedPitch: number,
  tolerance: number = 2.5,
): boolean {
  if (detectedFreq <= 0) return false;

  const detectedMidi = frequencyToMidi(detectedFreq);
  const expectedMidi = ultrastarPitchToMidi(expectedPitch);

  // Allow octave errors (±12 semitones)
  const diff = Math.abs(detectedMidi - expectedMidi) % 12;
  return diff <= tolerance || diff >= 12 - tolerance;
}

/**
 * Get a scoring weight based on how close the pitch is (for partial credit)
 * Returns 1.0 for perfect match, scales down to 0 for far misses
 * @param detectedFreq - Detected frequency in Hz
 * @param expectedPitch - Expected UltraStar pitch (0 = C4)
 */
export function getPitchAccuracy(
  detectedFreq: number,
  expectedPitch: number,
): number {
  if (detectedFreq <= 0) return 0;

  const detectedMidi = frequencyToMidi(detectedFreq);
  const expectedMidi = ultrastarPitchToMidi(expectedPitch);

  // Get difference within octave
  let diff = Math.abs(detectedMidi - expectedMidi) % 12;
  if (diff > 6) diff = 12 - diff;

  // Perfect match (within 0.5 semitones) = 1.0
  // 1 semitone off = 0.9
  // 2 semitones off = 0.7
  // 3 semitones off = 0.4
  // 4+ semitones off = 0
  if (diff <= 0.5) return 1.0;
  if (diff <= 1.5) return 0.9;
  if (diff <= 2.5) return 0.7;
  if (diff <= 3.5) return 0.4;
  return 0;
}

/**
 * Get the pitch difference in semitones (accounting for octave)
 */
export function getPitchDifference(
  detectedFreq: number,
  expectedPitch: number,
): number {
  if (detectedFreq <= 0) return Infinity;

  const detectedMidi = frequencyToMidi(detectedFreq);
  const expectedMidi = ultrastarPitchToMidi(expectedPitch);

  // Get difference within octave
  let diff = (detectedMidi - expectedMidi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  return diff;
}

/**
 * Note names for display
 */
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * Get note name from MIDI number
 */
export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[Math.round(midi) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Get note name from UltraStar pitch
 */
export function ultrastarPitchToNoteName(pitch: number): string {
  return midiToNoteName(ultrastarPitchToMidi(pitch));
}

/**
 * Get note name from frequency
 */
export function frequencyToNoteName(freq: number): string {
  return midiToNoteName(frequencyToMidi(freq));
}
