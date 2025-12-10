use crate::error::{AppError, Result};
use crate::song::types::{LineBreak, Note, NoteType, Song, SongFiles, SongMetadata};
use std::path::Path;

/// Parser for UltraStar TXT files
pub struct Parser;

impl Parser {
    /// Parse an UltraStar TXT file from a string
    pub fn parse(content: &str, txt_path: &Path) -> Result<Song> {
        let mut metadata = MetadataBuilder::default();
        let mut notes_p1: Vec<Note> = Vec::new();
        let mut notes_p2: Vec<Note> = Vec::new();
        let mut line_breaks_p1: Vec<LineBreak> = Vec::new();
        let mut line_breaks_p2: Vec<LineBreak> = Vec::new();
        let mut current_player = 1;
        let mut is_duet = false;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line.starts_with('#') {
                Self::parse_header_line(line, &mut metadata)?;
                if line.starts_with("#P1")
                    || line.starts_with("#P2")
                    || line.starts_with("#DUETSINGERP1")
                    || line.starts_with("#DUETSINGERP2")
                {
                    is_duet = true;
                }
            } else if line.starts_with('P') {
                // Player switch (P1 or P2)
                is_duet = true;
                if line.starts_with("P1") || line == "P 1" {
                    current_player = 1;
                } else if line.starts_with("P2") || line == "P 2" {
                    current_player = 2;
                }
            } else if line.starts_with(':')
                || line.starts_with('*')
                || line.starts_with('F')
                || line.starts_with('R')
                || line.starts_with('G')
            {
                let note = Self::parse_note_line(line)?;
                if current_player == 2 {
                    notes_p2.push(note);
                } else {
                    notes_p1.push(note);
                }
            } else if line.starts_with('-') {
                let line_break = Self::parse_line_break(line)?;
                if current_player == 2 {
                    line_breaks_p2.push(line_break);
                } else {
                    line_breaks_p1.push(line_break);
                }
            } else if line == "E" {
                // End of file marker
                break;
            }
        }

        let song_metadata = metadata.build()?;

        // Generate ID from path
        let id = Self::generate_id(txt_path);

        Ok(Song {
            id,
            metadata: song_metadata,
            notes: notes_p1,
            notes_p2: if is_duet && !notes_p2.is_empty() {
                Some(notes_p2)
            } else {
                None
            },
            line_breaks: line_breaks_p1,
            line_breaks_p2: if is_duet && !line_breaks_p2.is_empty() {
                Some(line_breaks_p2)
            } else {
                None
            },
            files: SongFiles {
                txt_path: txt_path.to_path_buf(),
                ..Default::default()
            },
        })
    }

    fn parse_header_line(line: &str, metadata: &mut MetadataBuilder) -> Result<()> {
        // Format: #TAG:value
        let line = &line[1..]; // Remove leading #
        let (tag, value) = line.split_once(':').unwrap_or((line, ""));
        let tag = tag.trim().to_uppercase();
        let value = value.trim();

        match tag.as_str() {
            "TITLE" => metadata.title = Some(value.to_string()),
            "ARTIST" => metadata.artist = Some(value.to_string()),
            "MP3" | "AUDIO" => metadata.audio_file = Some(value.to_string()),
            "BPM" => {
                // BPM might use comma as decimal separator
                let bpm_str = value.replace(',', ".");
                metadata.bpm =
                    Some(bpm_str.parse().map_err(|_| {
                        AppError::ParseError(format!("Invalid BPM value: {}", value))
                    })?);
            }
            "GAP" => {
                let gap_str = value.replace(',', ".");
                metadata.gap =
                    Some(gap_str.parse().map_err(|_| {
                        AppError::ParseError(format!("Invalid GAP value: {}", value))
                    })?);
            }
            "VIDEO" => metadata.video_file = Some(value.to_string()),
            "VIDEOGAP" => {
                let vgap_str = value.replace(',', ".");
                metadata.video_gap = vgap_str.parse().ok();
            }
            "COVER" => metadata.cover_file = Some(value.to_string()),
            "BACKGROUND" => metadata.background_file = Some(value.to_string()),
            "GENRE" => metadata.genre = Some(value.to_string()),
            "YEAR" => metadata.year = value.parse().ok(),
            "LANGUAGE" => metadata.language = Some(value.to_string()),
            "EDITION" => metadata.edition = Some(value.to_string()),
            "CREATOR" => metadata.creator = Some(value.to_string()),
            "DUETSINGERP1" | "P1" => metadata.duet_singer_p1 = Some(value.to_string()),
            "DUETSINGERP2" | "P2" => metadata.duet_singer_p2 = Some(value.to_string()),
            _ => {} // Ignore unknown tags
        }

        Ok(())
    }

    fn parse_note_line(line: &str) -> Result<Note> {
        // Format: NoteType StartBeat Length Pitch Text
        // Example: : 0 5 7 Some~ ly~
        let note_type = match line.chars().next() {
            Some(':') => NoteType::Normal,
            Some('*') => NoteType::Golden,
            Some('F') => NoteType::Freestyle,
            Some('R') => NoteType::Rap,
            Some('G') => NoteType::GoldenRap,
            _ => {
                return Err(AppError::ParseError(format!(
                    "Unknown note type in: {}",
                    line
                )))
            }
        };

        let rest = line[1..].trim();
        let parts: Vec<&str> = rest.splitn(4, ' ').collect();

        if parts.len() < 4 {
            return Err(AppError::ParseError(format!(
                "Invalid note line (expected 4+ parts): {}",
                line
            )));
        }

        let start_beat: i32 = parts[0]
            .parse()
            .map_err(|_| AppError::ParseError(format!("Invalid start beat: {}", parts[0])))?;
        let length: i32 = parts[1]
            .parse()
            .map_err(|_| AppError::ParseError(format!("Invalid length: {}", parts[1])))?;
        let pitch: i32 = parts[2]
            .parse()
            .map_err(|_| AppError::ParseError(format!("Invalid pitch: {}", parts[2])))?;
        let text = parts[3].to_string();

        Ok(Note {
            note_type,
            start_beat,
            length,
            pitch,
            text,
        })
    }

    fn parse_line_break(line: &str) -> Result<LineBreak> {
        // Format: - StartBeat [EndBeat]
        let rest = line[1..].trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();

        if parts.is_empty() {
            return Err(AppError::ParseError(format!(
                "Invalid line break: {}",
                line
            )));
        }

        let start_beat: i32 = parts[0]
            .parse()
            .map_err(|_| AppError::ParseError(format!("Invalid line break beat: {}", parts[0])))?;

        let end_beat: Option<i32> = if parts.len() > 1 {
            parts[1].parse().ok()
        } else {
            None
        };

        Ok(LineBreak {
            start_beat,
            end_beat,
        })
    }

    fn generate_id(path: &Path) -> String {
        // Use a hash of the path for a stable ID
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}

#[derive(Default)]
struct MetadataBuilder {
    title: Option<String>,
    artist: Option<String>,
    bpm: Option<f64>,
    gap: Option<f64>,
    video_gap: Option<f64>,
    genre: Option<String>,
    year: Option<u16>,
    language: Option<String>,
    edition: Option<String>,
    creator: Option<String>,
    duet_singer_p1: Option<String>,
    duet_singer_p2: Option<String>,
    audio_file: Option<String>,
    video_file: Option<String>,
    cover_file: Option<String>,
    background_file: Option<String>,
}

impl MetadataBuilder {
    fn build(self) -> Result<SongMetadata> {
        Ok(SongMetadata {
            title: self
                .title
                .ok_or_else(|| AppError::ParseError("Missing required TITLE tag".to_string()))?,
            artist: self
                .artist
                .ok_or_else(|| AppError::ParseError("Missing required ARTIST tag".to_string()))?,
            bpm: self
                .bpm
                .ok_or_else(|| AppError::ParseError("Missing required BPM tag".to_string()))?,
            gap: self.gap.unwrap_or(0.0),
            video_gap: self.video_gap,
            genre: self.genre,
            year: self.year,
            language: self.language,
            edition: self.edition,
            creator: self.creator,
            duet_singer_p1: self.duet_singer_p1,
            duet_singer_p2: self.duet_singer_p2,
            audio_file: self.audio_file,
            video_file: self.video_file,
            cover_file: self.cover_file,
            background_file: self.background_file,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_simple_song() {
        let content = r#"
#TITLE:Test Song
#ARTIST:Test Artist
#MP3:test.mp3
#BPM:300
#GAP:1000
: 0 5 7 Hello
: 8 3 5  world
- 15
: 20 4 7 Test
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.metadata.title, "Test Song");
        assert_eq!(song.metadata.artist, "Test Artist");
        assert_eq!(song.metadata.bpm, 300.0);
        assert_eq!(song.metadata.gap, 1000.0);
        assert_eq!(song.notes.len(), 3);
        assert_eq!(song.line_breaks.len(), 1);

        let first_note = &song.notes[0];
        assert_eq!(first_note.note_type, NoteType::Normal);
        assert_eq!(first_note.start_beat, 0);
        assert_eq!(first_note.length, 5);
        assert_eq!(first_note.pitch, 7);
        assert_eq!(first_note.text, "Hello");
    }

    #[test]
    fn test_parse_golden_notes() {
        let content = r#"
#TITLE:Golden Test
#ARTIST:Test Artist
#BPM:400
: 0 5 7 Normal
* 8 3 5  Golden
F 15 2 3 Free
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.notes[0].note_type, NoteType::Normal);
        assert_eq!(song.notes[1].note_type, NoteType::Golden);
        assert_eq!(song.notes[2].note_type, NoteType::Freestyle);
    }

    #[test]
    fn test_parse_duet() {
        let content = r#"
#TITLE:Duet Song
#ARTIST:Test Artists
#BPM:400
#DUETSINGERP1:Singer One
#DUETSINGERP2:Singer Two
P1
: 0 5 7 Player one
- 10
P2
: 0 5 5 Player two
- 10
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert!(song.notes_p2.is_some());
        assert_eq!(song.notes.len(), 1);
        assert_eq!(song.notes_p2.as_ref().unwrap().len(), 1);
        assert_eq!(song.notes[0].text, "Player one");
        assert_eq!(song.notes_p2.as_ref().unwrap()[0].text, "Player two");
        assert_eq!(song.metadata.duet_singer_p1, Some("Singer One".to_string()));
        assert_eq!(song.metadata.duet_singer_p2, Some("Singer Two".to_string()));
    }

    #[test]
    fn test_parse_bpm_with_comma() {
        let content = r#"
#TITLE:Comma BPM
#ARTIST:Test
#BPM:312,5
#GAP:1234,56
: 0 5 7 Test
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.metadata.bpm, 312.5);
        assert_eq!(song.metadata.gap, 1234.56);
    }

    #[test]
    fn test_parse_negative_pitch() {
        let content = r#"
#TITLE:Negative Pitch
#ARTIST:Test
#BPM:400
: 0 5 -3 Low note
: 8 3 12 High note
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.notes[0].pitch, -3);
        assert_eq!(song.notes[1].pitch, 12);
    }

    #[test]
    fn test_parse_line_break_with_end_beat() {
        let content = r#"
#TITLE:Line Break Test
#ARTIST:Test
#BPM:400
: 0 5 7 Test
- 10 15
: 20 5 7 More
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.line_breaks.len(), 1);
        assert_eq!(song.line_breaks[0].start_beat, 10);
        assert_eq!(song.line_breaks[0].end_beat, Some(15));
    }

    #[test]
    fn test_missing_title_error() {
        let content = r#"
#ARTIST:Test
#BPM:400
: 0 5 7 Test
E
"#;
        let result = Parser::parse(content, &PathBuf::from("test.txt"));
        assert!(result.is_err());
    }

    #[test]
    fn test_rap_notes() {
        let content = r#"
#TITLE:Rap Test
#ARTIST:Test
#BPM:400
R 0 5 7 Rap note
G 8 3 5 Golden rap
E
"#;
        let song = Parser::parse(content, &PathBuf::from("test.txt")).unwrap();

        assert_eq!(song.notes[0].note_type, NoteType::Rap);
        assert_eq!(song.notes[1].note_type, NoteType::GoldenRap);
    }
}
