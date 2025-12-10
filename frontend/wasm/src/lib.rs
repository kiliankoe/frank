use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use wasm_bindgen::prelude::*;

const POWER_THRESHOLD: f64 = 5.0;
const CLARITY_THRESHOLD: f64 = 0.7;

#[wasm_bindgen]
pub struct PitchDetectorWrapper {
    detector: McLeodDetector<f64>,
    size: usize,
    padding: usize,
}

#[wasm_bindgen]
impl PitchDetectorWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Self {
        let padding = size / 2;
        Self {
            detector: McLeodDetector::new(size, padding),
            size,
            padding,
        }
    }

    /// Detect pitch from f32 audio samples
    /// Returns the frequency in Hz, or -1 if no pitch detected
    #[wasm_bindgen]
    pub fn detect(&mut self, samples: &[f32], sample_rate: u32) -> f64 {
        if samples.len() < self.size {
            return -1.0;
        }

        // Convert f32 to f64 for the detector
        let samples_f64: Vec<f64> = samples.iter().map(|&s| s as f64).collect();

        match self.detector.get_pitch(
            &samples_f64,
            sample_rate as usize,
            POWER_THRESHOLD,
            CLARITY_THRESHOLD,
        ) {
            Some(pitch) => pitch.frequency,
            None => -1.0,
        }
    }

    /// Get the required buffer size for this detector
    #[wasm_bindgen]
    pub fn buffer_size(&self) -> usize {
        self.size
    }
}

/// Helper function to detect pitch without creating a persistent detector
#[wasm_bindgen]
pub fn detect_pitch(samples: &[f32], sample_rate: u32) -> f64 {
    let size = 2048;
    let padding = size / 2;
    let mut detector = McLeodDetector::new(size, padding);

    if samples.len() < size {
        return -1.0;
    }

    let samples_f64: Vec<f64> = samples.iter().map(|&s| s as f64).collect();

    match detector.get_pitch(
        &samples_f64,
        sample_rate as usize,
        POWER_THRESHOLD,
        CLARITY_THRESHOLD,
    ) {
        Some(pitch) => pitch.frequency,
        None => -1.0,
    }
}
