use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use utoipa::ToSchema;

use crate::state::{AppState, QueueEntry};

/// List all queue entries
#[utoipa::path(
    get,
    path = "/api/queue",
    responses(
        (status = 200, description = "List of queue entries", body = Vec<QueueEntry>)
    ),
    tag = "queue"
)]
pub async fn list_queue(State(state): State<AppState>) -> Json<Vec<QueueEntry>> {
    Json(state.get_queue().await)
}

#[derive(Deserialize, ToSchema)]
pub struct AddToQueueRequest {
    /// The ID of the song to add
    pub song_id: String,
    /// Name of the person adding the song
    pub submitter: String,
}

/// Add a song to the queue
#[utoipa::path(
    post,
    path = "/api/queue",
    request_body = AddToQueueRequest,
    responses(
        (status = 201, description = "Song added to queue", body = QueueEntry),
        (status = 404, description = "Song not found")
    ),
    tag = "queue"
)]
pub async fn add_to_queue(
    State(state): State<AppState>,
    Json(request): Json<AddToQueueRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.add_to_queue(&request.song_id, request.submitter).await {
        Some(entry) => Ok((StatusCode::CREATED, Json(entry))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Remove a queue entry by ID
#[utoipa::path(
    delete,
    path = "/api/queue/{id}",
    params(
        ("id" = u64, Path, description = "Queue entry ID")
    ),
    responses(
        (status = 200, description = "Entry removed"),
        (status = 404, description = "Entry not found")
    ),
    tag = "queue"
)]
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

/// Remove a queue entry by song ID (used when a song is played)
#[utoipa::path(
    delete,
    path = "/api/queue/song/{song_id}",
    params(
        ("song_id" = String, Path, description = "Song ID")
    ),
    responses(
        (status = 200, description = "Entry removed"),
        (status = 404, description = "Entry not found")
    ),
    tag = "queue"
)]
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
