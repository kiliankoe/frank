mod api;
mod config;
mod error;
mod song;
mod state;

use axum::{routing::get, Router};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::state::AppState;

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
        .route("/api/songs", get(api::list_songs))
        .route("/api/songs/{id}", get(api::get_song))
        .route("/api/search", get(api::search_songs))
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
