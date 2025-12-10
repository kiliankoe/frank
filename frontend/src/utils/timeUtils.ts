/**
 * Convert beat number to milliseconds
 * Note: UltraStar BPM is 1/4 of actual BPM
 *
 * @param beat - Beat number
 * @param bpm - UltraStar BPM value
 * @param gap - Gap in milliseconds (delay before lyrics start)
 */
export function beatToMs(beat: number, bpm: number, gap: number = 0): number {
  // UltraStar BPM is quarter of real BPM
  const msPerBeat = 60000 / (bpm * 4);
  return gap + beat * msPerBeat;
}

/**
 * Convert milliseconds to beat number
 *
 * @param ms - Time in milliseconds
 * @param bpm - UltraStar BPM value
 * @param gap - Gap in milliseconds
 */
export function msToBeat(ms: number, bpm: number, gap: number = 0): number {
  const msPerBeat = 60000 / (bpm * 4);
  return (ms - gap) / msPerBeat;
}

/**
 * Get the milliseconds per beat for a given BPM
 */
export function getMsPerBeat(bpm: number): number {
  return 60000 / (bpm * 4);
}

/**
 * Format milliseconds as MM:SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds as MM:SS.mmm
 */
export function formatTimePrecise(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
