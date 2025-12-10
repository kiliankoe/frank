use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::state::{AppState, QueueEntry};

/// GET /api/queue - List all queue entries
pub async fn list_queue(State(state): State<AppState>) -> Json<Vec<QueueEntry>> {
    Json(state.get_queue().await)
}

#[derive(Deserialize)]
pub struct AddToQueueRequest {
    pub song_id: String,
    pub submitter: String,
}

/// POST /api/queue - Add a song to the queue
pub async fn add_to_queue(
    State(state): State<AppState>,
    Json(request): Json<AddToQueueRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.add_to_queue(&request.song_id, request.submitter).await {
        Some(entry) => Ok((StatusCode::CREATED, Json(entry))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// DELETE /api/queue/:id - Remove a queue entry
pub async fn remove_from_queue(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> StatusCode {
    if state.remove_from_queue(id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

/// DELETE /api/queue/song/:song_id - Remove a queue entry by song ID (when played)
pub async fn remove_by_song(
    State(state): State<AppState>,
    Path(song_id): Path<String>,
) -> StatusCode {
    if state.remove_from_queue_by_song(&song_id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}
