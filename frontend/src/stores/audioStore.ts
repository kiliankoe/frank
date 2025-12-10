import { create } from "zustand";

export interface Microphone {
  deviceId: string;
  label: string;
}

interface AudioState {
  audioContext: AudioContext | null;
  microphones: Microphone[];
  selectedMicrophones: string[];
  permissionGranted: boolean;
  isInitialized: boolean;

  initAudio: () => Promise<void>;
  requestMicrophonePermission: () => Promise<void>;
  refreshMicrophones: () => Promise<void>;
  selectMicrophone: (deviceId: string) => void;
  deselectMicrophone: (deviceId: string) => void;
  getAudioContext: () => AudioContext;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  microphones: [],
  selectedMicrophones: [],
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
    set({ microphones });
  },

  selectMicrophone: (deviceId) => {
    set((state) => ({
      selectedMicrophones: state.selectedMicrophones.includes(deviceId)
        ? state.selectedMicrophones
        : [...state.selectedMicrophones, deviceId],
    }));
  },

  deselectMicrophone: (deviceId) => {
    set((state) => ({
      selectedMicrophones: state.selectedMicrophones.filter(
        (id) => id !== deviceId,
      ),
    }));
  },

  getAudioContext: () => {
    const { audioContext } = get();
    if (!audioContext) {
      throw new Error("Audio context not initialized");
    }
    return audioContext;
  },
}));
