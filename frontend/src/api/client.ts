import type { QueueEntry, Song, SongSummary } from "./types";

const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
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

// Queue API

export async function getQueue(): Promise<QueueEntry[]> {
  return fetchJson<QueueEntry[]>(`${API_BASE}/queue`);
}

export async function addToQueue(
  songId: string,
  submitter: string,
): Promise<QueueEntry> {
  return fetchJson<QueueEntry>(`${API_BASE}/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ song_id: songId, submitter }),
  });
}

export async function removeFromQueue(entryId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/queue/${entryId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to remove queue entry: ${response.status}`);
  }
}

export async function removeFromQueueBySong(songId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/queue/song/${songId}`, {
    method: "DELETE",
  });
  // Don't throw if not found - the song might not have been in the queue
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to remove queue entry: ${response.status}`);
  }
}
