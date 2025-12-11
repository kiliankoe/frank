import { useEffect, useRef, useState, useCallback } from "react";
import type { SearchableSong } from "../api/types";
import { getFileUrl } from "../api/client";

const PREVIEW_DELAY_MS = 1000;
const PREVIEW_START_SECONDS = 15;
const PREVIEW_VOLUME = 0.3;

interface UsePreviewOptions {
  song: SearchableSong | null;
  enabled: boolean;
}

export function usePreview({ song, enabled }: UsePreviewOptions) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const currentSongIdRef = useRef<string | null>(null);

  const stopPreview = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    setIsPreviewPlaying(false);
    setPreviewVideoUrl(null);
  }, []);

  const startPreview = useCallback((targetSong: SearchableSong) => {
    if (targetSong.has_video) {
      // For video, we set the URL and let the component handle the video element
      setPreviewVideoUrl(getFileUrl(targetSong.id, "video"));
      setIsPreviewPlaying(true);
    } else {
      // For audio-only, create an audio element
      const audio = new Audio(getFileUrl(targetSong.id, "audio"));
      audio.volume = PREVIEW_VOLUME;
      audio.loop = true;

      audio.addEventListener("loadedmetadata", () => {
        const startTime = Math.min(PREVIEW_START_SECONDS, audio.duration * 0.3);
        audio.currentTime = startTime;
        audio.play().catch(() => {
          // Autoplay might be blocked - silently fail
        });
      });

      audioRef.current = audio;
      setIsPreviewPlaying(true);
    }
  }, []);

  const songId = song?.id ?? null;

  useEffect(() => {
    // Stop preview if disabled or no song
    if (!enabled || !song) {
      stopPreview();
      currentSongIdRef.current = null;
      return;
    }

    // If same song, don't restart
    if (songId === currentSongIdRef.current) {
      return;
    }

    // Stop any existing preview
    stopPreview();
    currentSongIdRef.current = songId;

    // Capture song for use in timeout callback
    const songToPreview = song;

    // Start preview after delay
    timeoutRef.current = window.setTimeout(() => {
      // Double-check the song hasn't changed during the delay
      if (songId === currentSongIdRef.current) {
        startPreview(songToPreview);
      }
    }, PREVIEW_DELAY_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [songId, song, enabled, stopPreview, startPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  // Callback to set video element time when it loads
  const onVideoReady = useCallback((video: HTMLVideoElement) => {
    const startTime = Math.min(PREVIEW_START_SECONDS, video.duration * 0.3);
    video.currentTime = startTime;
    video.volume = PREVIEW_VOLUME;
    video.play().catch(() => {
      // Autoplay might be blocked
    });
  }, []);

  return {
    isPreviewPlaying,
    previewVideoUrl,
    onVideoReady,
    stopPreview,
  };
}
