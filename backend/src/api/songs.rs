use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use utoipa::IntoParams;

use crate::error::AppError;
use crate::song::{Song, SongSummary};
use crate::state::AppState;

/// List all songs
#[utoipa::path(
    get,
    path = "/api/songs",
    responses(
        (status = 200, description = "List all songs", body = Vec<SongSummary>)
    ),
    tag = "songs"
)]
pub async fn list_songs(State(state): State<AppState>) -> Json<Vec<SongSummary>> {
    Json(state.get_song_list().await)
}

#[derive(Deserialize, IntoParams)]
pub struct SearchQuery {
    /// Search query string (matches title or artist)
    pub q: String,
}

/// Search songs by title or artist
#[utoipa::path(
    get,
    path = "/api/search",
    params(SearchQuery),
    responses(
        (status = 200, description = "Search results", body = Vec<SongSummary>)
    ),
    tag = "songs"
)]
pub async fn search_songs(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Json<Vec<SongSummary>> {
    Json(state.search_songs(&query.q).await)
}

/// Get a specific song with full note data
#[utoipa::path(
    get,
    path = "/api/songs/{id}",
    params(
        ("id" = String, Path, description = "Song ID")
    ),
    responses(
        (status = 200, description = "Song found", body = Song),
        (status = 404, description = "Song not found")
    ),
    tag = "songs"
)]
pub async fn get_song(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let song = state
        .get_song(&id)
        .await
        .ok_or(AppError::SongNotFound(id))?;

    Ok(Json(song))
}

/// Serve song files (audio, video, cover, background)
///
/// Supports HTTP Range requests for seeking in media files
#[utoipa::path(
    get,
    path = "/files/{song_id}/{file_type}",
    params(
        ("song_id" = String, Path, description = "Song ID"),
        ("file_type" = String, Path, description = "File type: audio, video, cover, or background")
    ),
    responses(
        (status = 200, description = "File content"),
        (status = 206, description = "Partial content (range request)"),
        (status = 404, description = "File not found")
    ),
    tag = "files"
)]
pub async fn serve_file(
    State(state): State<AppState>,
    Path((song_id, file_type)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let song = state
        .get_song(&song_id)
        .await
        .ok_or_else(|| AppError::SongNotFound(song_id.clone()))?;

    let file_path = match file_type.as_str() {
        "audio" => song.files.audio_path.as_ref(),
        "video" => song.files.video_path.as_ref(),
        "cover" => song.files.cover_path.as_ref(),
        "background" => song.files.background_path.as_ref(),
        _ => None,
    };

    let file_path = file_path.ok_or_else(|| {
        AppError::SongNotFound(format!("{} file not found for song {}", file_type, song_id))
    })?;

    // Get file metadata for size
    let metadata = tokio::fs::metadata(file_path).await?;
    let file_size = metadata.len();

    // Determine content type from extension
    let content_type = match file_path.extension().and_then(|e| e.to_str()) {
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("m4a") => "audio/mp4",
        Some("mp4") => "video/mp4",
        Some("avi") => "video/x-msvideo",
        Some("mkv") => "video/x-matroska",
        Some("webm") => "video/webm",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };

    // Parse Range header if present
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| parse_range_header(s, file_size));

    let mut file = tokio::fs::File::open(file_path).await?;

    match range {
        Some((start, end)) => {
            // Seek to start position
            file.seek(std::io::SeekFrom::Start(start)).await?;

            // Create a limited reader for the range
            let length = end - start + 1;
            let limited = file.take(length);
            let stream = ReaderStream::new(limited);
            let body = Body::from_stream(stream);

            let content_range = format!("bytes {}-{}/{}", start, end, file_size);

            Ok((
                StatusCode::PARTIAL_CONTENT,
                [
                    (header::CONTENT_TYPE, content_type.to_string()),
                    (header::CONTENT_LENGTH, length.to_string()),
                    (header::CONTENT_RANGE, content_range),
                    (header::ACCEPT_RANGES, "bytes".to_string()),
                ],
                body,
            ))
        }
        None => {
            // No range requested, stream the entire file
            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);

            Ok((
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, content_type.to_string()),
                    (header::CONTENT_LENGTH, file_size.to_string()),
                    (header::ACCEPT_RANGES, "bytes".to_string()),
                    // Dummy header to match tuple size
                    (header::CACHE_CONTROL, "public, max-age=86400".to_string()),
                ],
                body,
            ))
        }
    }
}

/// Parse HTTP Range header
/// Format: "bytes=start-end" or "bytes=start-"
fn parse_range_header(header: &str, file_size: u64) -> Option<(u64, u64)> {
    let header = header.strip_prefix("bytes=")?;
    let parts: Vec<&str> = header.split('-').collect();

    if parts.len() != 2 {
        return None;
    }

    let start: u64 = parts[0].parse().ok()?;

    let end: u64 = if parts[1].is_empty() {
        // "bytes=start-" means from start to end of file
        file_size - 1
    } else {
        parts[1].parse().ok()?
    };

    // Validate range
    if start > end || start >= file_size {
        return None;
    }

    // Clamp end to file size
    let end = end.min(file_size - 1);

    Some((start, end))
}
