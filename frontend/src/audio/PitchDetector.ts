import init, {
  PitchDetectorWrapper,
  detect_pitch,
} from "../../wasm/pkg/frank_pitch";

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initWasm(): Promise<void> {
  if (wasmInitialized) return;
  if (initPromise) return initPromise;

  initPromise = init().then(() => {
    wasmInitialized = true;
  });

  return initPromise;
}

export class PitchDetector {
  private detector: PitchDetectorWrapper | null = null;
  private bufferSize: number;

  constructor(bufferSize: number = 2048) {
    this.bufferSize = bufferSize;
  }

  async init(): Promise<void> {
    await initWasm();
    this.detector = new PitchDetectorWrapper(this.bufferSize);
  }

  detect(samples: Float32Array, sampleRate: number): number {
    if (!this.detector) {
      throw new Error("PitchDetector not initialized. Call init() first.");
    }
    return this.detector.detect(samples, sampleRate);
  }

  getBufferSize(): number {
    return this.bufferSize;
  }

  dispose(): void {
    if (this.detector) {
      this.detector.free();
      this.detector = null;
    }
  }
}

/**
 * Simple one-off pitch detection without maintaining a detector instance
 */
export async function detectPitch(
  samples: Float32Array,
  sampleRate: number,
): Promise<number> {
  await initWasm();
  return detect_pitch(samples, sampleRate);
}
