/**
 * Audio Output - Display audio generation results with waveform
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AudioOutputProps {
  src: string;
  duration?: number;
  waveform?: number[];
  latency?: number;
  cost?: number;
}

export function AudioOutput({
  src,
  duration,
  waveform,
  latency,
  cost,
}: AudioOutputProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setAudioDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audioRef.current.currentTime = percent * audioDuration;
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `audio-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Generate waveform if not provided
  const displayWaveform = waveform || Array(50).fill(0).map(() => Math.random() * 0.8 + 0.2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <audio ref={audioRef} src={src} />

      {/* Player */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21" />
              </svg>
            )}
          </button>

          {/* Time Display */}
          <div className="text-sm text-white/60">
            {formatTime(currentTime)} / {formatTime(audioDuration)}
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="ml-auto p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Waveform */}
        <div
          className="relative h-16 cursor-pointer"
          onClick={handleSeek}
        >
          <div className="flex items-center justify-center gap-0.5 h-full">
            {displayWaveform.map((value, i) => {
              const isBeforePlayhead = (i / displayWaveform.length) * 100 < progress;
              return (
                <motion.div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    isBeforePlayhead ? 'bg-cyan-500' : 'bg-white/30'
                  }`}
                  animate={{
                    height: isPlaying ? `${value * 100}%` : `${value * 60}%`,
                  }}
                  transition={{
                    duration: 0.2,
                    repeat: isPlaying ? Infinity : 0,
                    repeatType: 'reverse',
                    delay: i * 0.01,
                  }}
                />
              );
            })}
          </div>

          {/* Progress Overlay */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-cyan-500/10 pointer-events-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-4 text-xs text-white/40">
        {audioDuration > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{audioDuration.toFixed(1)}s</span>
            <span>duration</span>
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

export default AudioOutput;
