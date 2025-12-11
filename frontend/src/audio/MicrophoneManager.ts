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

export interface MicrophoneStream {
	deviceId: string;
	stream: MediaStream;
	analyser: AnalyserNode;
	source: MediaStreamAudioSourceNode;
	pitchDetector: PitchDetector;
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
	private sampleRate: number;
	private pitchStates: Map<string, SmoothedPitchState> = new Map();

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
		this.sampleRate = audioContext.sampleRate;
	}

	private initPitchState(deviceId: string): SmoothedPitchState {
		const state: SmoothedPitchState = {
			lastPitch: -1,
			lastMidiNote: -1,
			smoothedPitch: -1,
			lastValidPitchTime: 0,
			holdPitch: -1,
			confidence: 0,
		};
		this.pitchStates.set(deviceId, state);
		return state;
	}

	private getSignalStrength(dataArray: Float32Array): number {
		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			sum += dataArray[i] * dataArray[i];
		}
		return Math.sqrt(sum / dataArray.length);
	}

	async connectMicrophone(deviceId: string): Promise<MicrophoneStream> {
		const existing = this.streams.get(deviceId);
		if (existing) {
			return existing;
		}

		// Use 'ideal' instead of 'exact' to be more forgiving if deviceId changed
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: { ideal: deviceId },
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			},
		});

		const source = this.audioContext.createMediaStreamSource(stream);
		const analyser = this.audioContext.createAnalyser();
		// Use same size as pitch detector buffer for efficiency
		analyser.fftSize = PITCH_BUFFER_SIZE;
		analyser.smoothingTimeConstant = 0;

		source.connect(analyser);

		const pitchDetector = new PitchDetector(PITCH_BUFFER_SIZE);
		await pitchDetector.init();

		const micStream: MicrophoneStream = {
			deviceId,
			stream,
			analyser,
			source,
			pitchDetector,
		};

		this.streams.set(deviceId, micStream);
		return micStream;
	}

	disconnectMicrophone(deviceId: string): void {
		const micStream = this.streams.get(deviceId);
		if (!micStream) return;

		micStream.source.disconnect();
		for (const track of micStream.stream.getTracks()) {
			track.stop();
		}
		micStream.pitchDetector.dispose();

		this.streams.delete(deviceId);
		this.pitchStates.delete(deviceId);
	}

	disconnectAll(): void {
		for (const deviceId of this.streams.keys()) {
			this.disconnectMicrophone(deviceId);
		}
	}

	getPitch(deviceId: string): number {
		const micStream = this.streams.get(deviceId);
		if (!micStream) return -1;

		const bufferSize = micStream.pitchDetector.getBufferSize();
		const dataArray = new Float32Array(bufferSize);
		micStream.analyser.getFloatTimeDomainData(dataArray);

		// Get or initialize pitch state for smoothing
		let state = this.pitchStates.get(deviceId);
		if (!state) {
			state = this.initPitchState(deviceId);
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
		for (const deviceId of this.streams.keys()) {
			pitches.set(deviceId, this.getPitch(deviceId));
		}
		return pitches;
	}

	getConnectedDevices(): string[] {
		return Array.from(this.streams.keys());
	}

	isConnected(deviceId: string): boolean {
		return this.streams.has(deviceId);
	}
}
