import { useEffect, useRef } from "react";

interface VideoBackgroundProps {
  videoUrl: string | null;
  backgroundUrl: string | null;
  audioElement: HTMLAudioElement | null;
  videoGap: number;
}

export function VideoBackground({
  videoUrl,
  backgroundUrl,
  audioElement,
  videoGap,
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !audioElement) return;

    // Sync video with audio
    const syncVideo = () => {
      const audioTime = audioElement.currentTime * 1000;
      const videoTime = (audioTime - videoGap) / 1000;

      if (videoTime >= 0 && Math.abs(video.currentTime - videoTime) > 0.1) {
        video.currentTime = videoTime;
      }
    };

    // Play video when audio plays
    const handlePlay = () => {
      video.play().catch(() => {});
    };

    // Pause video when audio pauses
    const handlePause = () => {
      video.pause();
    };

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("timeupdate", syncVideo);

    // Initial sync
    if (!audioElement.paused) {
      handlePlay();
    }

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("timeupdate", syncVideo);
    };
  }, [videoUrl, audioElement, videoGap]);

  if (videoUrl) {
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />
    );
  }

  if (backgroundUrl) {
    return (
      <img
        src={backgroundUrl}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-gray-900 to-black" />
  );
}
