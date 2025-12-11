import { frequencyToMidi } from "../utils/pitchUtils";
import { PitchDetector } from "./PitchDetector";

// Smoothing configuration
const SMOOTHING_FACTOR = 0.3; // Lower = smoother (0-1)
const PITCH_HOLD_TIME_MS = 180; // How long pitch lingers after input stops
const PITCH_HOLD_DECAY_RATE = 0.85; // How fast held pitch fades (per frame)
const MIN_CONFIDENCE_THRESHOLD = 0.02; // Minimum signal strength to detect pitch

// ±3 semitones for note continuity filtering
const MAX_SEMITONE_JUMP = 3;

// Buffer size for pitch detection
const PITCH_BUFFER_SIZE = 2048;

// Channel indices for stereo devices (e.g., Singstar mics)
export type MicrophoneChannel = "mono" | "left" | "right";

export interface MicrophoneStream {
  deviceId: string;
  channel: MicrophoneChannel;
  stream: MediaStream;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  splitter?: ChannelSplitterNode; // Only present for stereo split streams
  pitchDetector: PitchDetector;
}

/**
 * Creates a unique key for a microphone input (device + channel combination)
 */
export function getMicrophoneInputId(
  deviceId: string,
  channel: MicrophoneChannel,
): string {
  return channel === "mono" ? deviceId : `${deviceId}:${channel}`;
}

/**
 * Parses a microphone input ID back into deviceId and channel
 */
export function parseMicrophoneInputId(inputId: string): {
  deviceId: string;
  channel: MicrophoneChannel;
} {
  if (inputId.endsWith(":left")) {
    return { deviceId: inputId.slice(0, -5), channel: "left" };
  }
  if (inputId.endsWith(":right")) {
    return { deviceId: inputId.slice(0, -6), channel: "right" };
  }
  return { deviceId: inputId, channel: "mono" };
}

interface SmoothedPitchState {
  lastPitch: number;
  lastMidiNote: number;
  smoothedPitch: number;
  lastValidPitchTime: number;
  holdPitch: number;
  confidence: number;
}

export class MicrophoneManager {
  private audioContext: AudioContext;
  private streams: Map<string, MicrophoneStream> = new Map();
  // Track shared streams for stereo devices (when we use both left and right channels)
  private sharedStreams: Map<
    string,
    { stream: MediaStream; refCount: number }
  > = new Map();
  private sampleRate: number;
  private pitchStates: Map<string, SmoothedPitchState> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
  }

  private initPitchState(inputId: string): SmoothedPitchState {
    const state: SmoothedPitchState = {
      lastPitch: -1,
      lastMidiNote: -1,
      smoothedPitch: -1,
      lastValidPitchTime: 0,
      holdPitch: -1,
      confidence: 0,
    };
    this.pitchStates.set(inputId, state);
    return state;
  }

  private getSignalStrength(dataArray: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Connect to a microphone, optionally selecting a specific stereo channel.
   * For stereo devices like Singstar mics, use channel "left" or "right".
   * For mono devices, use channel "mono" (the default).
   */
  async connectMicrophone(
    deviceId: string,
    channel: MicrophoneChannel = "mono",
  ): Promise<MicrophoneStream> {
    const inputId = getMicrophoneInputId(deviceId, channel);
    const existing = this.streams.get(inputId);
    if (existing) {
      return existing;
    }

    // For stereo channel selection, request stereo audio
    const requestStereo = channel === "left" || channel === "right";

    // Check if we already have a shared stream for this device (another channel is using it)
    let stream: MediaStream;
    let isShared = false;

    const existingShared = this.sharedStreams.get(deviceId);
    if (requestStereo && existingShared) {
      // Reuse existing stream for the other channel
      stream = existingShared.stream;
      existingShared.refCount++;
      isShared = true;
    } else {
      // Create new stream
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { ideal: deviceId },
          // Request stereo if we want to split channels
          channelCount: requestStereo ? { ideal: 2 } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Track as shared stream if stereo
      if (requestStereo) {
        this.sharedStreams.set(deviceId, { stream, refCount: 1 });
        isShared = true;
      }
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = PITCH_BUFFER_SIZE;
    analyser.smoothingTimeConstant = 0;

    let splitter: ChannelSplitterNode | undefined;

    if (requestStereo) {
      // Create a channel splitter to extract left or right channel
      splitter = this.audioContext.createChannelSplitter(2);
      source.connect(splitter);

      // Connect the desired channel (0 = left, 1 = right) to the analyser
      // We need a gain node to convert the single channel output to mono
      const channelIndex = channel === "left" ? 0 : 1;
      const gainNode = this.audioContext.createGain();
      gainNode.channelCount = 1;
      gainNode.channelCountMode = "explicit";

      splitter.connect(gainNode, channelIndex);
      gainNode.connect(analyser);
    } else {
      // Mono: connect directly
      source.connect(analyser);
    }

    const pitchDetector = new PitchDetector(PITCH_BUFFER_SIZE);
    await pitchDetector.init();

    const micStream: MicrophoneStream = {
      deviceId,
      channel,
      stream: isShared ? stream : stream, // Keep reference for cleanup
      analyser,
      source,
      splitter,
      pitchDetector,
    };

    this.streams.set(inputId, micStream);
    return micStream;
  }

  /**
   * Convenience method to connect using a combined input ID (deviceId:channel)
   */
  async connectMicrophoneByInputId(inputId: string): Promise<MicrophoneStream> {
    const { deviceId, channel } = parseMicrophoneInputId(inputId);
    return this.connectMicrophone(deviceId, channel);
  }

  /**
   * Disconnect a microphone by its input ID (deviceId or deviceId:channel)
   */
  disconnectMicrophone(inputId: string): void {
    const micStream = this.streams.get(inputId);
    if (!micStream) return;

    const { deviceId, channel } = parseMicrophoneInputId(inputId);

    // Disconnect audio nodes
    micStream.source.disconnect();
    if (micStream.splitter) {
      micStream.splitter.disconnect();
    }
    micStream.pitchDetector.dispose();

    // Handle shared stream cleanup for stereo devices
    if (channel !== "mono") {
      const shared = this.sharedStreams.get(deviceId);
      if (shared) {
        shared.refCount--;
        if (shared.refCount <= 0) {
          // No more references, stop the stream
          for (const track of shared.stream.getTracks()) {
            track.stop();
          }
          this.sharedStreams.delete(deviceId);
        }
      }
    } else {
      // Mono stream: stop directly
      for (const track of micStream.stream.getTracks()) {
        track.stop();
      }
    }

    this.streams.delete(inputId);
    this.pitchStates.delete(inputId);
  }

  disconnectAll(): void {
    for (const inputId of this.streams.keys()) {
      this.disconnectMicrophone(inputId);
    }
  }

  /**
   * Get the current detected pitch for a microphone input.
   * @param inputId Either a deviceId (for mono) or deviceId:channel (for stereo)
   */
  getPitch(inputId: string): number {
    const micStream = this.streams.get(inputId);
    if (!micStream) return -1;

    const bufferSize = micStream.pitchDetector.getBufferSize();
    const dataArray = new Float32Array(bufferSize);
    micStream.analyser.getFloatTimeDomainData(dataArray);

    // Get or initialize pitch state for smoothing
    let state = this.pitchStates.get(inputId);
    if (!state) {
      state = this.initPitchState(inputId);
    }

    const now = performance.now();
    const signalStrength = this.getSignalStrength(dataArray);
    const rawPitch = micStream.pitchDetector.detect(dataArray, this.sampleRate);

    // Check if we have a valid pitch with sufficient signal
    const hasValidPitch =
      rawPitch > 0 && signalStrength > MIN_CONFIDENCE_THRESHOLD;

    if (hasValidPitch) {
      const rawMidiNote = frequencyToMidi(rawPitch);

      // Semitone-based filtering, this filters out spurious octave jumps and noise
      if (state.lastMidiNote > 0) {
        const semitoneDiff = Math.abs(rawMidiNote - state.lastMidiNote);

        // If jump is too large (more than MAX_SEMITONE_JUMP), likely spurious
        if (semitoneDiff > MAX_SEMITONE_JUMP) {
          // Don't immediately reject - could be legitimate note change
          // Use faster smoothing to catch up, but don't accept raw value
          state.smoothedPitch = state.smoothedPitch * 0.7 + rawPitch * 0.3;
        } else {
          // Normal smoothing for small pitch changes
          state.smoothedPitch =
            state.smoothedPitch * (1 - SMOOTHING_FACTOR) +
            rawPitch * SMOOTHING_FACTOR;
        }
      } else {
        // First valid pitch, use it directly
        state.smoothedPitch = rawPitch;
      }

      state.lastPitch = rawPitch;
      state.lastMidiNote = rawMidiNote;
      state.lastValidPitchTime = now;
      state.holdPitch = state.smoothedPitch;
      state.confidence = Math.min(1, signalStrength * 10);

      return state.smoothedPitch;
    }

    // No valid pitch detected - check if we should hold/linger
    const timeSinceLastValid = now - state.lastValidPitchTime;

    if (timeSinceLastValid < PITCH_HOLD_TIME_MS && state.holdPitch > 0) {
      // Still within hold time - return the held pitch
      // Apply decay to make it fade naturally
      state.confidence *= PITCH_HOLD_DECAY_RATE;
      return state.holdPitch;
    }

    // Pitch hold expired, clear state
    state.smoothedPitch = -1;
    state.lastMidiNote = -1;
    state.holdPitch = -1;
    state.confidence = 0;
    return -1;
  }

  getAllPitches(): Map<string, number> {
    const pitches = new Map<string, number>();
    for (const inputId of this.streams.keys()) {
      pitches.set(inputId, this.getPitch(inputId));
    }
    return pitches;
  }

  /**
   * Get all connected input IDs (deviceId for mono, deviceId:channel for stereo)
   */
  getConnectedInputs(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * @deprecated Use getConnectedInputs() instead
   */
  getConnectedDevices(): string[] {
    return this.getConnectedInputs();
  }

  /**
   * Check if a microphone input is connected
   * @param inputId Either a deviceId (for mono) or deviceId:channel (for stereo)
   */
  isConnected(inputId: string): boolean {
    return this.streams.has(inputId);
  }
}
