use crate::config::Config;
use crate::song::{Indexer, Song, SongSummary};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use utoipa::ToSchema;

/// A queue entry representing a song request from a party guest
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QueueEntry {
    pub id: u64,
    pub song_id: String,
    pub song_title: String,
    pub song_artist: String,
    pub submitter: String,
}

/// Application state shared across all request handlers
#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub config: Config,
    pub songs: RwLock<HashMap<String, Song>>,
    pub queue: RwLock<VecDeque<QueueEntry>>,
    pub next_queue_id: AtomicU64,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                config,
                songs: RwLock::new(HashMap::new()),
                queue: RwLock::new(VecDeque::new()),
                next_queue_id: AtomicU64::new(1),
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

    /// Get all queue entries
    pub async fn get_queue(&self) -> Vec<QueueEntry> {
        let queue = self.inner.queue.read().await;
        queue.iter().cloned().collect()
    }

    /// Add a song to the queue
    pub async fn add_to_queue(&self, song_id: &str, submitter: String) -> Option<QueueEntry> {
        // Look up the song to get title and artist
        let songs = self.inner.songs.read().await;
        let song = songs.get(song_id)?;

        let entry = QueueEntry {
            id: self.inner.next_queue_id.fetch_add(1, Ordering::SeqCst),
            song_id: song_id.to_string(),
            song_title: song.metadata.title.clone(),
            song_artist: song.metadata.artist.clone(),
            submitter,
        };

        let mut queue = self.inner.queue.write().await;
        queue.push_back(entry.clone());

        Some(entry)
    }

    /// Remove a queue entry by ID
    pub async fn remove_from_queue(&self, entry_id: u64) -> bool {
        let mut queue = self.inner.queue.write().await;
        if let Some(pos) = queue.iter().position(|e| e.id == entry_id) {
            queue.remove(pos);
            true
        } else {
            false
        }
    }

    /// Remove a queue entry by song ID (used when a song is played)
    pub async fn remove_from_queue_by_song(&self, song_id: &str) -> bool {
        let mut queue = self.inner.queue.write().await;
        if let Some(pos) = queue.iter().position(|e| e.song_id == song_id) {
            queue.remove(pos);
            true
        } else {
            false
        }
    }
}
