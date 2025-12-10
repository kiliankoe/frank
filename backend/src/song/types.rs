use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub metadata: SongMetadata,
    pub notes: Vec<Note>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes_p2: Option<Vec<Note>>,
    pub line_breaks: Vec<LineBreak>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_breaks_p2: Option<Vec<LineBreak>>,
    #[serde(skip)]
    pub files: SongFiles,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongMetadata {
    pub title: String,
    pub artist: String,
    pub bpm: f64,
    #[serde(default)]
    pub gap: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_gap: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duet_singer_p1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duet_singer_p2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_file: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct SongFiles {
    #[allow(dead_code)]
    pub txt_path: PathBuf,
    pub audio_path: Option<PathBuf>,
    pub video_path: Option<PathBuf>,
    pub cover_path: Option<PathBuf>,
    pub background_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteType {
    Normal,
    Golden,
    Freestyle,
    Rap,
    GoldenRap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub note_type: NoteType,
    pub start_beat: i32,
    pub length: i32,
    pub pitch: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineBreak {
    pub start_beat: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_beat: Option<i32>,
}

/// Summary of a song for listing (without full note data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongSummary {
    pub id: String,
    pub title: String,
    pub artist: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub has_video: bool,
    pub is_duet: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
}

impl From<&Song> for SongSummary {
    fn from(song: &Song) -> Self {
        Self {
            id: song.id.clone(),
            title: song.metadata.title.clone(),
            artist: song.metadata.artist.clone(),
            genre: song.metadata.genre.clone(),
            year: song.metadata.year,
            language: song.metadata.language.clone(),
            has_video: song.files.video_path.is_some(),
            is_duet: song.notes_p2.is_some(),
            cover_url: song
                .files
                .cover_path
                .as_ref()
                .map(|_| format!("/files/{}/cover", song.id)),
        }
    }
}
