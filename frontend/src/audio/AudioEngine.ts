import { MicrophoneManager } from "./MicrophoneManager";

export class AudioEngine {
  private audioContext: AudioContext;
  private microphoneManager: MicrophoneManager;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode;

  constructor() {
    // Use 'interactive' latency hint for responsive pitch detection
    // This prioritizes low latency over power efficiency
    this.audioContext = new AudioContext({ latencyHint: "interactive" });
    this.microphoneManager = new MicrophoneManager(this.audioContext);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  getMicrophoneManager(): MicrophoneManager {
    return this.microphoneManager;
  }

  async resume(): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  loadAudio(url: string): HTMLAudioElement {
    this.unloadAudio();

    this.audioElement = new Audio();
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.src = url;

    this.sourceNode = this.audioContext.createMediaElementSource(
      this.audioElement,
    );
    this.sourceNode.connect(this.gainNode);

    return this.audioElement;
  }

  unloadAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      // Remove src without triggering error by removing all event listeners first
      this.audioElement.removeAttribute("src");
      this.audioElement.load(); // Reset the element
      this.audioElement = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  play(): void {
    this.audioElement?.play();
  }

  pause(): void {
    this.audioElement?.pause();
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  getCurrentTime(): number {
    return (this.audioElement?.currentTime ?? 0) * 1000; // Return in milliseconds
  }

  getDuration(): number {
    return (this.audioElement?.duration ?? 0) * 1000;
  }

  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false;
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  onTimeUpdate(callback: (timeMs: number) => void): void {
    this.audioElement?.addEventListener("timeupdate", () => {
      callback(this.getCurrentTime());
    });
  }

  onEnded(callback: () => void): void {
    this.audioElement?.addEventListener("ended", callback);
  }

  dispose(): void {
    this.unloadAudio();
    this.microphoneManager.disconnectAll();
    this.audioContext.close();
  }
}
