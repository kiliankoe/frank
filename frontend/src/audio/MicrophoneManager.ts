import { PitchDetector } from "./PitchDetector";

export interface MicrophoneStream {
  deviceId: string;
  stream: MediaStream;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  pitchDetector: PitchDetector;
}

export class MicrophoneManager {
  private audioContext: AudioContext;
  private streams: Map<string, MicrophoneStream> = new Map();
  private sampleRate: number;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
  }

  async connectMicrophone(deviceId: string): Promise<MicrophoneStream> {
    const existing = this.streams.get(deviceId);
    if (existing) {
      return existing;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;

    source.connect(analyser);

    const pitchDetector = new PitchDetector(2048);
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

    return micStream.pitchDetector.detect(dataArray, this.sampleRate);
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
