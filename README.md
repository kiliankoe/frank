🧑‍🎤 Frank

A browser-based karaoke game similar to UltraStar/Performous. Supports UltraStar TXT song format with real-time pitch detection via WebAssembly.

## Requirements

- Rust (for backend)
- Bun (for frontend)
- wasm-pack (for WASM pitch detection module)

## Running

Start the backend (serves API on port 3001):

```sh
cd backend
SONGS_DIRECTORY=/path/to/your/songs cargo run
```

Start the frontend dev server (port 5173):

```sh
cd frontend
bun install
bun run dev
```

Open http://localhost:5173 in your browser.

## Building

Backend:

```sh
cd backend
cargo build --release
```

Frontend:

```sh
cd frontend
bun run build
```

WASM pitch detection module (only needed if modifying):

```sh
cd frontend/wasm
wasm-pack build --target web
```

## Why "Frank"?

Named after a friend, Frank H., who hosted a lot of the karaoke/ultrastar nights I used to attend.
