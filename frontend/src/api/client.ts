import type { Song, SongSummary } from "./types";

const API_BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getSongs(): Promise<SongSummary[]> {
  return fetchJson<SongSummary[]>(`${API_BASE}/songs`);
}

export async function getSong(id: string): Promise<Song> {
  return fetchJson<Song>(`${API_BASE}/songs/${id}`);
}

export async function searchSongs(query: string): Promise<SongSummary[]> {
  const params = new URLSearchParams({ q: query });
  return fetchJson<SongSummary[]>(`${API_BASE}/search?${params}`);
}

export function getFileUrl(
  songId: string,
  fileType: "audio" | "video" | "cover" | "background",
): string {
  return `/files/${songId}/${fileType}`;
}
