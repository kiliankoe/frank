use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use wasm_bindgen::prelude::*;

// Default thresholds
const DEFAULT_POWER_THRESHOLD: f64 = 0.15;
const DEFAULT_CLARITY_THRESHOLD: f64 = 0.7;

/// Result of pitch detection containing frequency and clarity
#[wasm_bindgen]
pub struct PitchResult {
    pub frequency: f64,
    pub clarity: f64,
}

#[wasm_bindgen]
impl PitchResult {
    #[wasm_bindgen(getter)]
    pub fn is_valid(&self) -> bool {
        self.frequency > 0.0
    }
}

#[wasm_bindgen]
pub struct PitchDetectorWrapper {
    detector: McLeodDetector<f64>,
    size: usize,
    padding: usize,
    power_threshold: f64,
    clarity_threshold: f64,
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
            power_threshold: DEFAULT_POWER_THRESHOLD,
            clarity_threshold: DEFAULT_CLARITY_THRESHOLD,
        }
    }

    /// Create a new detector with custom thresholds
    #[wasm_bindgen]
    pub fn new_with_thresholds(size: usize, power_threshold: f64, clarity_threshold: f64) -> Self {
        let padding = size / 2;
        Self {
            detector: McLeodDetector::new(size, padding),
            size,
            padding,
            power_threshold,
            clarity_threshold,
        }
    }

    /// Set the power threshold (minimum signal strength to detect pitch)
    /// Lower values = more sensitive
    #[wasm_bindgen]
    pub fn set_power_threshold(&mut self, threshold: f64) {
        self.power_threshold = threshold;
    }

    /// Set the clarity threshold (minimum confidence for valid detection)
    /// Higher values = stricter filtering
    #[wasm_bindgen]
    pub fn set_clarity_threshold(&mut self, threshold: f64) {
        self.clarity_threshold = threshold;
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
            self.power_threshold,
            self.clarity_threshold,
        ) {
            Some(pitch) => pitch.frequency,
            None => -1.0,
        }
    }

    /// Detect pitch and return both frequency and clarity
    /// This allows JS to make decisions based on detection confidence
    #[wasm_bindgen]
    pub fn detect_with_clarity(&mut self, samples: &[f32], sample_rate: u32) -> PitchResult {
        if samples.len() < self.size {
            return PitchResult {
                frequency: -1.0,
                clarity: 0.0,
            };
        }

        // Convert f32 to f64 for the detector
        let samples_f64: Vec<f64> = samples.iter().map(|&s| s as f64).collect();

        match self.detector.get_pitch(
            &samples_f64,
            sample_rate as usize,
            self.power_threshold,
            self.clarity_threshold,
        ) {
            Some(pitch) => PitchResult {
                frequency: pitch.frequency,
                clarity: pitch.clarity,
            },
            None => PitchResult {
                frequency: -1.0,
                clarity: 0.0,
            },
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
        DEFAULT_POWER_THRESHOLD,
        DEFAULT_CLARITY_THRESHOLD,
    ) {
        Some(pitch) => pitch.frequency,
        None => -1.0,
    }
}
