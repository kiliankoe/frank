use crate::error::{AppError, Result};
use crate::song::parser::Parser;
use crate::song::types::{Song, SongFiles};
use std::collections::HashMap;
use std::path::Path;
use tracing::{info, warn};

/// Indexes songs from a directory
pub struct Indexer;

impl Indexer {
    /// Scan a directory recursively and index all UltraStar TXT files
    pub fn scan_directory(path: &Path) -> Result<HashMap<String, Song>> {
        let mut songs = HashMap::new();

        if !path.exists() {
            warn!("Songs directory does not exist: {:?}", path);
            return Ok(songs);
        }

        Self::scan_recursive(path, &mut songs)?;
        info!("Indexed {} songs from {:?}", songs.len(), path);
        Ok(songs)
    }

    fn scan_recursive(path: &Path, songs: &mut HashMap<String, Song>) -> Result<()> {
        let entries = std::fs::read_dir(path)?;

        for entry in entries {
            let entry = entry?;
            let file_path = entry.path();

            if file_path.is_dir() {
                Self::scan_recursive(&file_path, songs)?;
            } else if Self::is_ultrastar_file(&file_path) {
                match Self::index_song(&file_path) {
                    Ok(song) => {
                        info!(
                            "Indexed: {} - {}",
                            song.metadata.artist, song.metadata.title
                        );
                        songs.insert(song.id.clone(), song);
                    }
                    Err(e) => {
                        warn!("Failed to parse {:?}: {}", file_path, e);
                    }
                }
            }
        }

        Ok(())
    }

    fn is_ultrastar_file(path: &Path) -> bool {
        path.extension()
            .map(|ext| ext.eq_ignore_ascii_case("txt"))
            .unwrap_or(false)
    }

    fn index_song(txt_path: &Path) -> Result<Song> {
        let content = std::fs::read_to_string(txt_path)?;

        // Try to detect encoding issues and re-read if necessary
        let content = if content.contains('\u{FFFD}') {
            // Contains replacement characters, might be wrong encoding
            // Try reading as Latin-1
            let bytes = std::fs::read(txt_path)?;
            bytes.iter().map(|&b| b as char).collect()
        } else {
            content
        };

        let mut song = Parser::parse(&content, txt_path)?;

        // Resolve file paths
        song.files = Self::resolve_files(txt_path, &song)?;

        Ok(song)
    }

    fn resolve_files(txt_path: &Path, song: &Song) -> Result<SongFiles> {
        let dir = txt_path
            .parent()
            .ok_or_else(|| AppError::Internal("Cannot get parent directory".to_string()))?;

        let audio_path = song
            .metadata
            .audio_file
            .as_ref()
            .map(|f| dir.join(f))
            .filter(|p| p.exists());

        let video_path = song
            .metadata
            .video_file
            .as_ref()
            .map(|f| dir.join(f))
            .filter(|p| p.exists());

        let cover_path = song
            .metadata
            .cover_file
            .as_ref()
            .map(|f| dir.join(f))
            .filter(|p| p.exists())
            .or_else(|| Self::find_cover_image(dir));

        let background_path = song
            .metadata
            .background_file
            .as_ref()
            .map(|f| dir.join(f))
            .filter(|p| p.exists());

        Ok(SongFiles {
            txt_path: txt_path.to_path_buf(),
            audio_path,
            video_path,
            cover_path,
            background_path,
        })
    }

    /// Try to find a cover image in the directory if not specified
    fn find_cover_image(dir: &Path) -> Option<std::path::PathBuf> {
        let patterns = ["cover.jpg", "cover.png", "[CO].jpg", "[CO].png"];

        for pattern in &patterns {
            let path = dir.join(pattern);
            if path.exists() {
                return Some(path);
            }
        }

        // Look for any image file with "cover" in the name
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let name_lower = name.to_lowercase();
                    if name_lower.contains("cover")
                        && (name_lower.ends_with(".jpg")
                            || name_lower.ends_with(".jpeg")
                            || name_lower.ends_with(".png"))
                    {
                        return Some(path);
                    }
                }
            }
        }

        None
    }
}
