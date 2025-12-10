import { useRef, useEffect } from "react";
import type { GameNote, PitchSample } from "../../game/types";
import { frequencyToMidi } from "../../utils/pitchUtils";

interface PitchTrackProps {
  notes: GameNote[];
  currentTimeMs: number;
  playerPitch: number;
  pitchHistory: PitchSample[];
  windowMs?: number;
  playerColor?: string;
}

const NOTE_HEIGHT = 16;
const PITCH_RANGE = 24; // Show 2 octaves
const PITCH_INDICATOR_RADIUS = 12; // Larger indicator for visibility
const PITCH_HISTORY_GAP_THRESHOLD_MS = 200; // Break line if gap is larger than this

/**
 * Shift a pitch to the nearest octave of a target pitch.
 * This implements UltraStar-style octave correction where we only care about
 * the pitch class (C, D, E, etc.) not the absolute octave.
 * This allows men to sing songs meant for women and vice versa.
 */
function shiftToNearestOctave(pitch: number, targetPitch: number): number {
  // Get the pitch class difference (0-11)
  let diff = (pitch - targetPitch) % 12;

  // Normalize to -6 to +5 range (closest octave)
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  // Return the target pitch plus the small difference
  return targetPitch + diff;
}

export function PitchTrack({
  notes,
  currentTimeMs,
  playerPitch,
  pitchHistory,
  windowMs = 4000,
  playerColor = "#a855f7",
}: PitchTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Calculate visible time range
    const startTime = currentTimeMs - windowMs * 0.25;
    const endTime = currentTimeMs + windowMs * 0.75;

    // Calculate pitch range from visible notes
    let minPitch = Infinity;
    let maxPitch = -Infinity;

    const visibleNotes = notes.filter(
      (note) => note.endTimeMs >= startTime && note.startTimeMs <= endTime,
    );

    for (const note of visibleNotes) {
      minPitch = Math.min(minPitch, note.pitch);
      maxPitch = Math.max(maxPitch, note.pitch);
    }

    // Calculate center pitch of visible notes for octave correction
    // This is the reference point we'll shift the player's pitch towards
    let centerPitch = 0;
    if (visibleNotes.length > 0) {
      centerPitch = (minPitch + maxPitch) / 2;
    } else if (notes.length > 0) {
      // Fall back to all notes if no visible notes
      const allMinPitch = Math.min(...notes.map((n) => n.pitch));
      const allMaxPitch = Math.max(...notes.map((n) => n.pitch));
      centerPitch = (allMinPitch + allMaxPitch) / 2;
    }

    // Convert player pitch to UltraStar pitch with octave correction
    let playerPitchUltrastar: number | null = null;
    if (playerPitch > 0) {
      const pitchMidi = frequencyToMidi(playerPitch);
      const rawPitch = pitchMidi - 60;
      // Apply octave correction to shift detected pitch to same octave as target notes
      playerPitchUltrastar = shiftToNearestOctave(rawPitch, centerPitch);
    }

    // Default range if no notes visible
    if (minPitch === Infinity) {
      minPitch = -6;
      maxPitch = 18;
    } else {
      // Add padding
      minPitch -= 4;
      maxPitch += 4;
    }

    // Expand range to include player's current pitch (with padding)
    if (playerPitchUltrastar !== null) {
      minPitch = Math.min(minPitch, playerPitchUltrastar - 2);
      maxPitch = Math.max(maxPitch, playerPitchUltrastar + 2);
    }

    const pitchRange = Math.max(maxPitch - minPitch, PITCH_RANGE);

    // Helper to convert time to x position
    const timeToX = (time: number) => {
      return ((time - startTime) / windowMs) * width;
    };

    // Helper to convert pitch to y position (higher pitch = higher on screen)
    const pitchToY = (pitch: number) => {
      const normalizedPitch = (pitch - minPitch) / pitchRange;
      return height - normalizedPitch * height;
    };

    // Draw reference lines (every 4 semitones)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    for (
      let pitch = Math.ceil(minPitch / 4) * 4;
      pitch <= maxPitch;
      pitch += 4
    ) {
      const y = pitchToY(pitch);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw current time line
    const currentX = timeToX(currentTimeMs);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, height);
    ctx.stroke();

    // Draw notes
    for (const note of visibleNotes) {
      const x = timeToX(note.startTimeMs);
      const noteWidth = timeToX(note.endTimeMs) - x;
      const y = pitchToY(note.pitch);

      // Note background
      const isActive =
        currentTimeMs >= note.startTimeMs && currentTimeMs <= note.endTimeMs;
      const isPast = currentTimeMs > note.endTimeMs;

      let noteColor = "rgba(100, 100, 100, 0.6)";
      if (note.note_type === "golden" || note.note_type === "goldenrap") {
        noteColor = isActive
          ? "rgba(250, 204, 21, 0.9)"
          : "rgba(250, 204, 21, 0.6)";
      } else if (note.note_type === "freestyle") {
        noteColor = "rgba(100, 100, 100, 0.3)";
      } else {
        noteColor = isActive
          ? "rgba(168, 85, 247, 0.9)"
          : isPast
            ? "rgba(168, 85, 247, 0.4)"
            : "rgba(168, 85, 247, 0.6)";
      }

      ctx.fillStyle = noteColor;
      ctx.fillRect(x, y - NOTE_HEIGHT / 2, noteWidth, NOTE_HEIGHT);

      // Note border
      ctx.strokeStyle = isActive
        ? "rgba(255, 255, 255, 0.8)"
        : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(x, y - NOTE_HEIGHT / 2, noteWidth, NOTE_HEIGHT);
    }

    // Draw pitch history with smooth curves
    ctx.strokeStyle = playerColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const relevantHistory = pitchHistory.filter(
      (sample) =>
        sample.timeMs >= startTime &&
        sample.timeMs <= endTime &&
        sample.frequency > 0,
    );

    if (relevantHistory.length > 1) {
      // Convert samples to points with octave correction
      const points: { x: number; y: number; time: number }[] = [];
      for (const sample of relevantHistory) {
        const x = timeToX(sample.timeMs);
        const pitchMidi = frequencyToMidi(sample.frequency);
        const rawPitch = pitchMidi - 60;
        const pitchUltrastar = shiftToNearestOctave(rawPitch, centerPitch);
        const y = pitchToY(pitchUltrastar);
        points.push({ x, y, time: sample.timeMs });
      }

      // Draw with smooth quadratic curves, breaking on gaps
      ctx.beginPath();
      let segmentStarted = false;

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const prevPoint = i > 0 ? points[i - 1] : null;

        // Check for time gap (new segment)
        const hasGap =
          prevPoint &&
          point.time - prevPoint.time > PITCH_HISTORY_GAP_THRESHOLD_MS;

        if (!segmentStarted || hasGap) {
          // Start new segment
          if (hasGap && segmentStarted) {
            ctx.stroke();
            ctx.beginPath();
          }
          ctx.moveTo(point.x, point.y);
          segmentStarted = true;
        } else if (i < points.length - 1) {
          // Use quadratic curve to midpoint for smoothing
          const nextPoint = points[i + 1];
          const midX = (point.x + nextPoint.x) / 2;
          const midY = (point.y + nextPoint.y) / 2;
          ctx.quadraticCurveTo(point.x, point.y, midX, midY);
        } else {
          // Last point - draw line to it
          ctx.lineTo(point.x, point.y);
        }
      }

      ctx.stroke();

      // Draw a subtle glow trail behind the main line
      ctx.save();
      ctx.strokeStyle = `${playerColor}40`;
      ctx.lineWidth = 8;
      ctx.filter = "blur(4px)";
      ctx.beginPath();
      segmentStarted = false;

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const prevPoint = i > 0 ? points[i - 1] : null;
        const hasGap =
          prevPoint &&
          point.time - prevPoint.time > PITCH_HISTORY_GAP_THRESHOLD_MS;

        if (!segmentStarted || hasGap) {
          if (hasGap && segmentStarted) {
            ctx.stroke();
            ctx.beginPath();
          }
          ctx.moveTo(point.x, point.y);
          segmentStarted = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw current pitch indicator with horizontal reference line
    if (playerPitchUltrastar !== null) {
      const y = pitchToY(playerPitchUltrastar);

      // Draw horizontal reference line across the entire track
      ctx.strokeStyle = `${playerColor}80`; // Semi-transparent
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]); // Dashed line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Draw glow effect for the indicator
      ctx.shadowColor = playerColor;
      ctx.shadowBlur = 15;

      // Draw main pitch indicator circle
      ctx.beginPath();
      ctx.arc(currentX, y, PITCH_INDICATOR_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = playerColor;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow for stroke

      // Draw white border
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw inner highlight for better visibility
      ctx.beginPath();
      ctx.arc(currentX, y, PITCH_INDICATOR_RADIUS - 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [notes, currentTimeMs, playerPitch, pitchHistory, windowMs, playerColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
