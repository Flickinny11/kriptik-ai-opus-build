/**
 * Video Output - Display video generation results with playback controls
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VideoOutputProps {
  src: string;
  thumbnailUrl?: string;
  duration?: number;
  fps?: number;
  resolution?: { width: number; height: number };
  latency?: number;
  cost?: number;
}

export function VideoOutput({
  src,
  thumbnailUrl,
  duration,
  fps,
  resolution,
  latency,
  cost,
}: VideoOutputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setVideoDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      videoRef.current.currentTime = parseFloat(e.target.value);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Video Player */}
      <div className="relative group rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={thumbnailUrl}
          className="w-full aspect-video"
          onClick={togglePlay}
        />

        {/* Play Overlay */}
        {!isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21" />
              </svg>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white">
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 3 20 12 6 21" />
                </svg>
              )}
            </button>

            {/* Progress */}
            <input
              type="range"
              min="0"
              max={videoDuration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-cyan-500"
            />

            {/* Time */}
            <span className="text-sm text-white/60">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </span>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white">
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
                </svg>
              )}
            </button>

            {/* Download */}
            <button onClick={handleDownload} className="text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-4 text-xs text-white/40">
        {resolution && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{resolution.width}x{resolution.height}</span>
          </div>
        )}
        {videoDuration > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{videoDuration.toFixed(1)}s</span>
          </div>
        )}
        {fps && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{fps}</span>
            <span>fps</span>
          </div>
        )}
        {latency !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{latency}</span>
            <span>ms</span>
          </div>
        )}
        {cost !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">${cost.toFixed(4)}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default VideoOutput;
