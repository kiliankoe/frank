use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::error::AppError;
use crate::song::SongSummary;
use crate::state::AppState;

/// GET /api/songs - List all songs
pub async fn list_songs(State(state): State<AppState>) -> Json<Vec<SongSummary>> {
    Json(state.get_song_list().await)
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

/// GET /api/search?q=... - Search songs
pub async fn search_songs(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Json<Vec<SongSummary>> {
    Json(state.search_songs(&query.q).await)
}

/// GET /api/songs/:id - Get a specific song with notes
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

/// GET /files/:song_id/:file_type - Serve song files (audio, video, cover, background)
pub async fn serve_file(
    State(state): State<AppState>,
    Path((song_id, file_type)): Path<(String, String)>,
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

    let content = tokio::fs::read(file_path).await?;

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

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, content_type)],
        content,
    ))
}
