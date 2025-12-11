import { create } from "zustand";

export interface Microphone {
  deviceId: string;
  label: string;
}

// Persisted mic-to-color assignments
interface MicColorAssignment {
  deviceId: string;
  colorId: string;
}

const STORAGE_KEY = "frank-mic-assignments";

function loadMicAssignments(): MicColorAssignment[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
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
  micAssignments: MicColorAssignment[];
  permissionGranted: boolean;
  isInitialized: boolean;

  initAudio: () => Promise<void>;
  requestMicrophonePermission: () => Promise<void>;
  refreshMicrophones: () => Promise<void>;
  assignMicColor: (deviceId: string, colorId: string) => void;
  unassignMic: (deviceId: string) => void;
  getMicByColor: (colorId: string) => Microphone | undefined;
  getColorByMic: (deviceId: string) => string | undefined;
  getAssignedMics: () => MicColorAssignment[];
  getAudioContext: () => AudioContext;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  microphones: [],
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
    const microphones = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      }));

    // Clean up stale assignments (device IDs that no longer exist)
    const validDeviceIds = new Set(microphones.map((m) => m.deviceId));
    const currentAssignments = get().micAssignments;
    const validAssignments = currentAssignments.filter((a) =>
      validDeviceIds.has(a.deviceId)
    );

    if (validAssignments.length !== currentAssignments.length) {
      saveMicAssignments(validAssignments);
      set({ microphones, micAssignments: validAssignments });
    } else {
      set({ microphones });
    }
  },

  assignMicColor: (deviceId, colorId) => {
    set((state) => {
      // Remove any existing assignment for this color or this mic
      const filtered = state.micAssignments.filter(
        (a) => a.deviceId !== deviceId && a.colorId !== colorId
      );
      const newAssignments = [...filtered, { deviceId, colorId }];
      saveMicAssignments(newAssignments);
      return { micAssignments: newAssignments };
    });
  },

  unassignMic: (deviceId) => {
    set((state) => {
      const newAssignments = state.micAssignments.filter(
        (a) => a.deviceId !== deviceId
      );
      saveMicAssignments(newAssignments);
      return { micAssignments: newAssignments };
    });
  },

  getMicByColor: (colorId) => {
    const { microphones, micAssignments } = get();
    const assignment = micAssignments.find((a) => a.colorId === colorId);
    if (!assignment) return undefined;
    return microphones.find((m) => m.deviceId === assignment.deviceId);
  },

  getColorByMic: (deviceId) => {
    const { micAssignments } = get();
    return micAssignments.find((a) => a.deviceId === deviceId)?.colorId;
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
