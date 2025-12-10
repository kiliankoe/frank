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

    // Default range if no notes visible
    if (minPitch === Infinity) {
      minPitch = -6;
      maxPitch = 18;
    } else {
      // Add padding
      minPitch -= 4;
      maxPitch += 4;
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

    // Draw pitch history
    ctx.strokeStyle = playerColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const relevantHistory = pitchHistory.filter(
      (sample) =>
        sample.timeMs >= startTime &&
        sample.timeMs <= endTime &&
        sample.frequency > 0,
    );

    if (relevantHistory.length > 1) {
      ctx.beginPath();
      let started = false;

      for (let i = 0; i < relevantHistory.length; i++) {
        const sample = relevantHistory[i];
        const x = timeToX(sample.timeMs);
        const pitchMidi = frequencyToMidi(sample.frequency);
        const pitchUltrastar = pitchMidi - 60; // Convert to UltraStar pitch
        const y = pitchToY(pitchUltrastar);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    // Draw current pitch indicator
    if (playerPitch > 0) {
      const pitchMidi = frequencyToMidi(playerPitch);
      const pitchUltrastar = pitchMidi - 60;
      const y = pitchToY(pitchUltrastar);

      ctx.beginPath();
      ctx.arc(currentX, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = playerColor;
      ctx.fill();
      ctx.strokeStyle = "white";
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
