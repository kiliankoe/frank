export type NoteType = "normal" | "golden" | "freestyle" | "rap" | "goldenrap";

export interface Note {
  note_type: NoteType;
  start_beat: number;
  length: number;
  pitch: number;
  text: string;
}

export interface LineBreak {
  start_beat: number;
  end_beat?: number;
}

export interface SongMetadata {
  title: string;
  artist: string;
  bpm: number;
  gap: number;
  video_gap?: number;
  genre?: string;
  year?: number;
  language?: string;
  edition?: string;
  creator?: string;
  duet_singer_p1?: string;
  duet_singer_p2?: string;
  audio_file?: string;
  video_file?: string;
  cover_file?: string;
  background_file?: string;
}

export interface Song {
  id: string;
  metadata: SongMetadata;
  notes: Note[];
  notes_p2?: Note[];
  line_breaks: LineBreak[];
  line_breaks_p2?: LineBreak[];
}

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  year?: number;
  language?: string;
  has_video: boolean;
  is_duet: boolean;
  cover_url?: string;
}

// Extended type with pre-computed lowercase fields for efficient search
export interface SearchableSong extends SongSummary {
  _searchTitle: string;
  _searchArtist: string;
}

export interface QueueEntry {
  id: number;
  song_id: string;
  song_title: string;
  song_artist: string;
  submitter: string;
}
