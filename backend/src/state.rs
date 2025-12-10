use crate::config::Config;
use crate::song::{Indexer, Song, SongSummary};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Application state shared across all request handlers
#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub config: Config,
    pub songs: RwLock<HashMap<String, Song>>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                config,
                songs: RwLock::new(HashMap::new()),
            }),
        }
    }

    #[allow(dead_code)]
    pub fn config(&self) -> &Config {
        &self.inner.config
    }

    /// Initialize the song index by scanning the songs directory
    pub async fn init_song_index(&self) -> crate::error::Result<()> {
        let songs = Indexer::scan_directory(&self.inner.config.songs_directory)?;
        let mut lock = self.inner.songs.write().await;
        *lock = songs;
        Ok(())
    }

    /// Get a list of all songs (summaries only)
    pub async fn get_song_list(&self) -> Vec<SongSummary> {
        let songs = self.inner.songs.read().await;
        songs.values().map(SongSummary::from).collect()
    }

    /// Get a song by ID
    pub async fn get_song(&self, id: &str) -> Option<Song> {
        let songs = self.inner.songs.read().await;
        songs.get(id).cloned()
    }

    /// Search songs by query (matches title or artist)
    pub async fn search_songs(&self, query: &str) -> Vec<SongSummary> {
        let query = query.to_lowercase();
        let songs = self.inner.songs.read().await;

        songs
            .values()
            .filter(|song| {
                song.metadata.title.to_lowercase().contains(&query)
                    || song.metadata.artist.to_lowercase().contains(&query)
            })
            .map(SongSummary::from)
            .collect()
    }
}
