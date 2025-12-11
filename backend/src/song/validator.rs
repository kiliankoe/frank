use std::path::Path;

/// Represents a validation error with context about where it occurred
#[derive(Debug, Clone)]
pub struct ValidationError {
    pub kind: ValidationErrorKind,
    pub line: Option<usize>,
    pub context: Option<String>,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.line {
            Some(line) => write!(f, "Line {}: {}", line, self.kind),
            None => write!(f, "{}", self.kind),
        }
    }
}

#[derive(Debug, Clone)]
pub enum ValidationErrorKind {
    // Encoding issues
    InvalidUtf8,
    ContainsBom,

    // Missing mandatory fields
    MissingTitle,
    MissingArtist,
    MissingBpm,
    MissingAudio,

    // Invalid field values
    InvalidBpm(String),
    InvalidGap(String),
    InvalidYear(String),

    // Note parsing errors
    InvalidNoteType(String),
    InvalidNoteFormat(String),
    InvalidLineBreak(String),

    // File reference errors
    AudioFileNotFound(String),
    VideoFileNotFound(String),
    CoverFileNotFound(String),
    BackgroundFileNotFound(String),

    // File format errors
    UnsupportedAudioFormat(String),
    UnsupportedVideoFormat(String),
    UnsupportedImageFormat(String),

    // Structure errors
    NoNotes,
    NoEndMarker,
    EmptyFile,
}

impl std::fmt::Display for ValidationErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidUtf8 => write!(f, "File is not valid UTF-8"),
            Self::ContainsBom => write!(f, "File contains UTF-8 BOM (should be UTF-8 without BOM)"),
            Self::MissingTitle => write!(f, "Missing required #TITLE tag"),
            Self::MissingArtist => write!(f, "Missing required #ARTIST tag"),
            Self::MissingBpm => write!(f, "Missing required #BPM tag"),
            Self::MissingAudio => write!(f, "Missing required #AUDIO or #MP3 tag"),
            Self::InvalidBpm(v) => write!(f, "Invalid BPM value: {}", v),
            Self::InvalidGap(v) => write!(f, "Invalid GAP value: {}", v),
            Self::InvalidYear(v) => write!(f, "Invalid YEAR value: {}", v),
            Self::InvalidNoteType(v) => write!(f, "Invalid note type: {}", v),
            Self::InvalidNoteFormat(v) => write!(f, "Invalid note format: {}", v),
            Self::InvalidLineBreak(v) => write!(f, "Invalid line break format: {}", v),
            Self::AudioFileNotFound(v) => write!(f, "Audio file not found: {}", v),
            Self::VideoFileNotFound(v) => write!(f, "Video file not found: {}", v),
            Self::CoverFileNotFound(v) => write!(f, "Cover file not found: {}", v),
            Self::BackgroundFileNotFound(v) => write!(f, "Background file not found: {}", v),
            Self::UnsupportedAudioFormat(v) => write!(f, "Unsupported audio format: {}", v),
            Self::UnsupportedVideoFormat(v) => write!(f, "Unsupported video format: {}", v),
            Self::UnsupportedImageFormat(v) => write!(f, "Unsupported image format: {}", v),
            Self::NoNotes => write!(f, "Song contains no notes"),
            Self::NoEndMarker => write!(f, "Missing 'E' end marker"),
            Self::EmptyFile => write!(f, "File is empty"),
        }
    }
}

/// Result of validating a song file
#[derive(Debug)]
pub struct ValidationResult {
    pub path: std::path::PathBuf,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationError>,
}

impl ValidationResult {
    pub fn is_valid(&self) -> bool {
        self.errors.is_empty()
    }
}

/// Supported audio formats (includes video containers since they can be used as audio source)
const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "ogg", "wav", "m4a", "flac", "opus", // Pure audio formats
    "mp4", "avi", "mkv", "webm", "mov", // Video containers (often used as audio source in UltraStar)
];

/// Supported video formats
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "avi", "mkv", "webm", "mov"];

/// Supported image formats
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];

/// Validates an UltraStar TXT file comprehensively
pub struct Validator;

impl Validator {
    /// Validate a song file and return all errors and warnings
    pub fn validate(txt_path: &Path) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Read raw bytes first to check encoding
        let bytes = match std::fs::read(txt_path) {
            Ok(b) => b,
            Err(e) => {
                errors.push(ValidationError {
                    kind: ValidationErrorKind::InvalidUtf8,
                    line: None,
                    context: Some(e.to_string()),
                });
                return ValidationResult {
                    path: txt_path.to_path_buf(),
                    errors,
                    warnings,
                };
            }
        };

        // Check for BOM
        if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
            warnings.push(ValidationError {
                kind: ValidationErrorKind::ContainsBom,
                line: None,
                context: None,
            });
        }

        // Try to decode as UTF-8
        let content = match String::from_utf8(bytes.clone()) {
            Ok(s) => s,
            Err(_) => {
                errors.push(ValidationError {
                    kind: ValidationErrorKind::InvalidUtf8,
                    line: None,
                    context: Some("File is not valid UTF-8 encoding".to_string()),
                });
                return ValidationResult {
                    path: txt_path.to_path_buf(),
                    errors,
                    warnings,
                };
            }
        };

        // Check for empty file
        let trimmed = content.trim();
        if trimmed.is_empty() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::EmptyFile,
                line: None,
                context: None,
            });
            return ValidationResult {
                path: txt_path.to_path_buf(),
                errors,
                warnings,
            };
        }

        // Get parent directory for file checks
        let dir = txt_path.parent();

        // Parse and validate content
        let mut has_title = false;
        let mut has_artist = false;
        let mut has_bpm = false;
        let mut audio_file: Option<String> = None;
        let mut video_file: Option<String> = None;
        let mut cover_file: Option<String> = None;
        let mut background_file: Option<String> = None;
        let mut has_notes = false;
        let mut has_end_marker = false;

        for (line_num, line) in content.lines().enumerate() {
            let line_num = line_num + 1; // 1-indexed
            let line = line.trim();

            if line.is_empty() {
                continue;
            }

            if let Some(line_content) = line.strip_prefix('#') {
                // Header line
                let (tag, value) = line_content.split_once(':').unwrap_or((line_content, ""));
                let tag = tag.trim().to_uppercase();
                let value = value.trim();

                match tag.as_str() {
                    "TITLE" => {
                        has_title = true;
                        if value.is_empty() {
                            errors.push(ValidationError {
                                kind: ValidationErrorKind::MissingTitle,
                                line: Some(line_num),
                                context: Some("TITLE tag is empty".to_string()),
                            });
                        }
                    }
                    "ARTIST" => {
                        has_artist = true;
                        if value.is_empty() {
                            errors.push(ValidationError {
                                kind: ValidationErrorKind::MissingArtist,
                                line: Some(line_num),
                                context: Some("ARTIST tag is empty".to_string()),
                            });
                        }
                    }
                    "BPM" => {
                        has_bpm = true;
                        let bpm_str = value.replace(',', ".");
                        if bpm_str.parse::<f64>().is_err() {
                            errors.push(ValidationError {
                                kind: ValidationErrorKind::InvalidBpm(value.to_string()),
                                line: Some(line_num),
                                context: None,
                            });
                        }
                    }
                    "GAP" => {
                        let gap_str = value.replace(',', ".");
                        if gap_str.parse::<f64>().is_err() && !value.is_empty() {
                            errors.push(ValidationError {
                                kind: ValidationErrorKind::InvalidGap(value.to_string()),
                                line: Some(line_num),
                                context: None,
                            });
                        }
                    }
                    "YEAR" => {
                        if !value.is_empty() && value.parse::<u16>().is_err() {
                            warnings.push(ValidationError {
                                kind: ValidationErrorKind::InvalidYear(value.to_string()),
                                line: Some(line_num),
                                context: None,
                            });
                        }
                    }
                    "MP3" | "AUDIO" => {
                        audio_file = Some(value.to_string());
                    }
                    "VIDEO" => {
                        video_file = Some(value.to_string());
                    }
                    "COVER" => {
                        cover_file = Some(value.to_string());
                    }
                    "BACKGROUND" => {
                        background_file = Some(value.to_string());
                    }
                    _ => {} // Unknown tags are OK
                }
            } else if line.starts_with(':')
                || line.starts_with('*')
                || line.starts_with('F')
                || line.starts_with('R')
                || line.starts_with('G')
            {
                // Note line
                has_notes = true;
                Self::validate_note_line(line, line_num, &mut errors);
            } else if line.starts_with('-') {
                // Line break
                Self::validate_line_break(line, line_num, &mut errors);
            } else if line == "E" {
                has_end_marker = true;
            } else if line.starts_with('P') {
                // Player marker (P1, P2, P 1, P 2) - valid
            } else if !line.is_empty() {
                // Unknown line type
                warnings.push(ValidationError {
                    kind: ValidationErrorKind::InvalidNoteFormat(format!(
                        "Unknown line type: {}",
                        &line[..line.len().min(50)]
                    )),
                    line: Some(line_num),
                    context: None,
                });
            }
        }

        // Check for missing mandatory fields
        if !has_title {
            errors.push(ValidationError {
                kind: ValidationErrorKind::MissingTitle,
                line: None,
                context: None,
            });
        }
        if !has_artist {
            errors.push(ValidationError {
                kind: ValidationErrorKind::MissingArtist,
                line: None,
                context: None,
            });
        }
        if !has_bpm {
            errors.push(ValidationError {
                kind: ValidationErrorKind::MissingBpm,
                line: None,
                context: None,
            });
        }
        if audio_file.is_none() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::MissingAudio,
                line: None,
                context: None,
            });
        }

        // Check for notes and end marker
        if !has_notes {
            errors.push(ValidationError {
                kind: ValidationErrorKind::NoNotes,
                line: None,
                context: None,
            });
        }
        if !has_end_marker {
            warnings.push(ValidationError {
                kind: ValidationErrorKind::NoEndMarker,
                line: None,
                context: None,
            });
        }

        // Validate file references
        if let Some(dir) = dir {
            if let Some(ref audio) = audio_file {
                Self::validate_audio_file(dir, audio, &mut errors);
            }
            if let Some(ref video) = video_file {
                Self::validate_video_file(dir, video, &mut errors);
            }
            if let Some(ref cover) = cover_file {
                Self::validate_image_file(dir, cover, "cover", &mut errors);
            }
            if let Some(ref background) = background_file {
                Self::validate_image_file(dir, background, "background", &mut errors);
            }
        }

        ValidationResult {
            path: txt_path.to_path_buf(),
            errors,
            warnings,
        }
    }

    fn validate_note_line(line: &str, line_num: usize, errors: &mut Vec<ValidationError>) {
        let rest = line[1..].trim();
        let parts: Vec<&str> = rest.splitn(4, ' ').collect();

        if parts.len() < 4 {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidNoteFormat(format!(
                    "Note needs 4 parts (start, length, pitch, text), got {}",
                    parts.len()
                )),
                line: Some(line_num),
                context: Some(line.to_string()),
            });
            return;
        }

        // Validate start beat
        if parts[0].parse::<i32>().is_err() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidNoteFormat(format!(
                    "Invalid start beat: {}",
                    parts[0]
                )),
                line: Some(line_num),
                context: None,
            });
        }

        // Validate length
        if parts[1].parse::<i32>().is_err() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidNoteFormat(format!(
                    "Invalid note length: {}",
                    parts[1]
                )),
                line: Some(line_num),
                context: None,
            });
        }

        // Validate pitch
        if parts[2].parse::<i32>().is_err() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidNoteFormat(format!(
                    "Invalid pitch: {}",
                    parts[2]
                )),
                line: Some(line_num),
                context: None,
            });
        }
    }

    fn validate_line_break(line: &str, line_num: usize, errors: &mut Vec<ValidationError>) {
        let rest = line[1..].trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();

        if parts.is_empty() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidLineBreak("Line break needs at least a start beat".to_string()),
                line: Some(line_num),
                context: Some(line.to_string()),
            });
            return;
        }

        if parts[0].parse::<i32>().is_err() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidLineBreak(format!(
                    "Invalid start beat: {}",
                    parts[0]
                )),
                line: Some(line_num),
                context: None,
            });
        }

        // Optional end beat
        if parts.len() > 1 && parts[1].parse::<i32>().is_err() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::InvalidLineBreak(format!(
                    "Invalid end beat: {}",
                    parts[1]
                )),
                line: Some(line_num),
                context: None,
            });
        }
    }

    fn validate_audio_file(dir: &Path, filename: &str, errors: &mut Vec<ValidationError>) {
        let path = dir.join(filename);

        if !path.exists() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::AudioFileNotFound(filename.to_string()),
                line: None,
                context: None,
            });
            return;
        }

        // Check extension
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if !AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
                errors.push(ValidationError {
                    kind: ValidationErrorKind::UnsupportedAudioFormat(ext.to_string()),
                    line: None,
                    context: Some(filename.to_string()),
                });
            }
        }
    }

    fn validate_video_file(dir: &Path, filename: &str, errors: &mut Vec<ValidationError>) {
        let path = dir.join(filename);

        if !path.exists() {
            errors.push(ValidationError {
                kind: ValidationErrorKind::VideoFileNotFound(filename.to_string()),
                line: None,
                context: None,
            });
            return;
        }

        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if !VIDEO_EXTENSIONS.contains(&ext_lower.as_str()) {
                errors.push(ValidationError {
                    kind: ValidationErrorKind::UnsupportedVideoFormat(ext.to_string()),
                    line: None,
                    context: Some(filename.to_string()),
                });
            }
        }
    }

    fn validate_image_file(
        dir: &Path,
        filename: &str,
        file_type: &str,
        errors: &mut Vec<ValidationError>,
    ) {
        let path = dir.join(filename);

        if !path.exists() {
            let kind = match file_type {
                "cover" => ValidationErrorKind::CoverFileNotFound(filename.to_string()),
                "background" => ValidationErrorKind::BackgroundFileNotFound(filename.to_string()),
                _ => ValidationErrorKind::CoverFileNotFound(filename.to_string()),
            };
            errors.push(ValidationError {
                kind,
                line: None,
                context: None,
            });
            return;
        }

        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if !IMAGE_EXTENSIONS.contains(&ext_lower.as_str()) {
                errors.push(ValidationError {
                    kind: ValidationErrorKind::UnsupportedImageFormat(ext.to_string()),
                    line: None,
                    context: Some(filename.to_string()),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &TempDir, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.path().join(name);
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
        path
    }

    #[test]
    fn test_valid_song() {
        let dir = TempDir::new().unwrap();
        let content = r#"#TITLE:Test Song
#ARTIST:Test Artist
#BPM:300
#AUDIO:test.mp3
: 0 5 7 Hello
- 10
: 15 5 7 World
E
"#;
        let txt_path = create_test_file(&dir, "song.txt", content);
        // Create dummy audio file
        std::fs::write(dir.path().join("test.mp3"), b"dummy").unwrap();

        let result = Validator::validate(&txt_path);
        assert!(result.errors.is_empty(), "Errors: {:?}", result.errors);
    }

    #[test]
    fn test_missing_title() {
        let dir = TempDir::new().unwrap();
        let content = r#"#ARTIST:Test Artist
#BPM:300
#AUDIO:test.mp3
: 0 5 7 Hello
E
"#;
        let txt_path = create_test_file(&dir, "song.txt", content);
        std::fs::write(dir.path().join("test.mp3"), b"dummy").unwrap();

        let result = Validator::validate(&txt_path);
        assert!(result.errors.iter().any(|e| matches!(e.kind, ValidationErrorKind::MissingTitle)));
    }

    #[test]
    fn test_invalid_bpm() {
        let dir = TempDir::new().unwrap();
        let content = r#"#TITLE:Test
#ARTIST:Test
#BPM:not_a_number
#AUDIO:test.mp3
: 0 5 7 Hello
E
"#;
        let txt_path = create_test_file(&dir, "song.txt", content);
        std::fs::write(dir.path().join("test.mp3"), b"dummy").unwrap();

        let result = Validator::validate(&txt_path);
        assert!(result.errors.iter().any(|e| matches!(e.kind, ValidationErrorKind::InvalidBpm(_))));
    }

    #[test]
    fn test_missing_audio_file() {
        let dir = TempDir::new().unwrap();
        let content = r#"#TITLE:Test
#ARTIST:Test
#BPM:300
#AUDIO:nonexistent.mp3
: 0 5 7 Hello
E
"#;
        let txt_path = create_test_file(&dir, "song.txt", content);

        let result = Validator::validate(&txt_path);
        assert!(result.errors.iter().any(|e| matches!(e.kind, ValidationErrorKind::AudioFileNotFound(_))));
    }

    #[test]
    fn test_invalid_note_format() {
        let dir = TempDir::new().unwrap();
        let content = r#"#TITLE:Test
#ARTIST:Test
#BPM:300
#AUDIO:test.mp3
: abc 5 7 Hello
E
"#;
        let txt_path = create_test_file(&dir, "song.txt", content);
        std::fs::write(dir.path().join("test.mp3"), b"dummy").unwrap();

        let result = Validator::validate(&txt_path);
        assert!(result.errors.iter().any(|e| matches!(e.kind, ValidationErrorKind::InvalidNoteFormat(_))));
    }
}
