import { create } from "zustand";
import {
  type MicrophoneChannel,
  getMicrophoneInputId,
} from "../audio/MicrophoneManager";

export interface Microphone {
  deviceId: string;
  label: string;
  channelCount: number; // 1 = mono, 2 = stereo (like Singstar mics)
}

/**
 * Represents an assignable microphone input.
 * For stereo devices, each channel becomes a separate input.
 */
export interface MicrophoneInput {
  inputId: string; // deviceId for mono, deviceId:left or deviceId:right for stereo
  deviceId: string;
  channel: MicrophoneChannel;
  label: string;
}

// Persisted mic-to-color assignments (now uses inputId instead of deviceId)
interface MicColorAssignment {
  inputId: string; // Can be deviceId or deviceId:channel
  colorId: string;
}

// Legacy format for migration
interface LegacyMicColorAssignment {
  deviceId: string;
  colorId: string;
}

const STORAGE_KEY = "frank-mic-assignments";

function loadMicAssignments(): MicColorAssignment[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate legacy format (deviceId) to new format (inputId)
      if (
        parsed.length > 0 &&
        "deviceId" in parsed[0] &&
        !("inputId" in parsed[0])
      ) {
        return (parsed as LegacyMicColorAssignment[]).map((a) => ({
          inputId: a.deviceId,
          colorId: a.colorId,
        }));
      }
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveMicAssignments(assignments: MicColorAssignment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

interface AudioState {
  audioContext: AudioContext | null;
  microphones: Microphone[];
  microphoneInputs: MicrophoneInput[]; // All assignable inputs (mono devices + stereo channels)
  micAssignments: MicColorAssignment[];
  permissionGranted: boolean;
  isInitialized: boolean;

  initAudio: () => Promise<void>;
  requestMicrophonePermission: () => Promise<void>;
  refreshMicrophones: () => Promise<void>;
  assignMicColor: (inputId: string, colorId: string) => void;
  unassignMic: (inputId: string) => void;
  getMicByColor: (colorId: string) => MicrophoneInput | undefined;
  getColorByMic: (inputId: string) => string | undefined;
  getAssignedMics: () => MicColorAssignment[];
  getAudioContext: () => AudioContext;
}

/**
 * Detects the number of channels a microphone device supports.
 * Returns 2 for stereo devices (like Singstar mics), 1 for mono.
 */
async function detectChannelCount(deviceId: string): Promise<number> {
  try {
    // Request stereo and see what we actually get
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    const channelCount = settings.channelCount ?? 1;

    // Clean up
    for (const t of stream.getTracks()) {
      t.stop();
    }

    return channelCount;
  } catch {
    return 1; // Default to mono on error
  }
}

/**
 * Builds the list of assignable microphone inputs from devices.
 * Stereo devices get two entries (left/right channels), mono devices get one.
 */
function buildMicrophoneInputs(microphones: Microphone[]): MicrophoneInput[] {
  const inputs: MicrophoneInput[] = [];

  for (const mic of microphones) {
    if (mic.channelCount >= 2) {
      // Stereo device: create two inputs for left and right channels
      inputs.push({
        inputId: getMicrophoneInputId(mic.deviceId, "left"),
        deviceId: mic.deviceId,
        channel: "left",
        label: `${mic.label} (Left / Blue)`,
      });
      inputs.push({
        inputId: getMicrophoneInputId(mic.deviceId, "right"),
        deviceId: mic.deviceId,
        channel: "right",
        label: `${mic.label} (Right / Red)`,
      });
    } else {
      // Mono device: single input
      inputs.push({
        inputId: getMicrophoneInputId(mic.deviceId, "mono"),
        deviceId: mic.deviceId,
        channel: "mono",
        label: mic.label,
      });
    }
  }

  return inputs;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  microphones: [],
  microphoneInputs: [],
  micAssignments: loadMicAssignments(),
  permissionGranted: false,
  isInitialized: false,

  initAudio: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    // Use 'interactive' latency hint for responsive pitch detection
    const audioContext = new AudioContext({ latencyHint: "interactive" });
    set({ audioContext, isInitialized: true });
  },

  requestMicrophonePermission: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) {
        track.stop();
      }
      set({ permissionGranted: true });
      await get().refreshMicrophones();
    } catch {
      set({ permissionGranted: false });
      throw new Error("Microphone permission denied");
    }
  },

  refreshMicrophones: async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputDevices = devices.filter(
      (device) => device.kind === "audioinput",
    );

    // Detect channel count for each device
    const microphones: Microphone[] = await Promise.all(
      audioInputDevices.map(async (device) => {
        const channelCount = await detectChannelCount(device.deviceId);
        return {
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          channelCount,
        };
      }),
    );

    // Build the list of assignable inputs
    const microphoneInputs = buildMicrophoneInputs(microphones);

    // Clean up stale assignments (input IDs that no longer exist)
    const validInputIds = new Set(microphoneInputs.map((m) => m.inputId));
    const currentAssignments = get().micAssignments;
    const validAssignments = currentAssignments.filter((a) =>
      validInputIds.has(a.inputId),
    );

    if (validAssignments.length !== currentAssignments.length) {
      saveMicAssignments(validAssignments);
      set({ microphones, microphoneInputs, micAssignments: validAssignments });
    } else {
      set({ microphones, microphoneInputs });
    }
  },

  assignMicColor: (inputId, colorId) => {
    set((state) => {
      // Remove any existing assignment for this color or this input
      const filtered = state.micAssignments.filter(
        (a) => a.inputId !== inputId && a.colorId !== colorId,
      );
      const newAssignments = [...filtered, { inputId, colorId }];
      saveMicAssignments(newAssignments);
      return { micAssignments: newAssignments };
    });
  },

  unassignMic: (inputId) => {
    set((state) => {
      const newAssignments = state.micAssignments.filter(
        (a) => a.inputId !== inputId,
      );
      saveMicAssignments(newAssignments);
      return { micAssignments: newAssignments };
    });
  },

  getMicByColor: (colorId) => {
    const { microphoneInputs, micAssignments } = get();
    const assignment = micAssignments.find((a) => a.colorId === colorId);
    if (!assignment) return undefined;
    return microphoneInputs.find((m) => m.inputId === assignment.inputId);
  },

  getColorByMic: (inputId) => {
    const { micAssignments } = get();
    return micAssignments.find((a) => a.inputId === inputId)?.colorId;
  },

  getAssignedMics: () => {
    return get().micAssignments;
  },

  getAudioContext: () => {
    const { audioContext } = get();
    if (!audioContext) {
      throw new Error("Audio context not initialized");
    }
    return audioContext;
  },
}));
