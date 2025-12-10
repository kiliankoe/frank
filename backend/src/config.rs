use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub songs_directory: PathBuf,
    pub host: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            songs_directory: std::env::var("SONGS_DIRECTORY")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("./songs")),
            host: std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
        }
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
