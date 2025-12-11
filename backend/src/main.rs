mod api;
mod config;
mod error;
mod song;
mod state;

use axum::{
    routing::{delete, get},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::config::Config;
use crate::song::{LineBreak, Note, NoteType, Song, SongMetadata, SongSummary};
use crate::state::{AppState, QueueEntry};

#[derive(OpenApi)]
#[openapi(
    paths(
        api::list_songs,
        api::get_song,
        api::search_songs,
        api::serve_file,
        api::list_queue,
        api::add_to_queue,
        api::remove_from_queue,
        api::remove_by_song,
    ),
    components(schemas(
        Song,
        SongMetadata,
        SongSummary,
        Note,
        NoteType,
        LineBreak,
        QueueEntry,
        api::queue::AddToQueueRequest,
    )),
    tags(
        (name = "songs", description = "Song management endpoints"),
        (name = "queue", description = "Queue management endpoints"),
        (name = "files", description = "File serving endpoints"),
    ),
    info(
        title = "Frank Karaoke API",
        version = "0.1.0",
        description = "API for Frank, a browser-based karaoke game"
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "frank=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env();
    info!("Starting Frank server");
    info!("Songs directory: {:?}", config.songs_directory);

    // Create application state
    let state = AppState::new(config.clone());

    // Index songs
    state.init_song_index().await?;

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .merge(SwaggerUi::new("/").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/songs", get(api::list_songs))
        .route("/api/songs/{id}", get(api::get_song))
        .route("/api/search", get(api::search_songs))
        .route("/api/queue", get(api::list_queue).post(api::add_to_queue))
        .route("/api/queue/{id}", delete(api::remove_from_queue))
        .route("/api/queue/song/{song_id}", delete(api::remove_by_song))
        .route("/files/{song_id}/{file_type}", get(api::serve_file))
        .layer(cors)
        .with_state(state);

    // Start server
    let addr = config.address();
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Server listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
