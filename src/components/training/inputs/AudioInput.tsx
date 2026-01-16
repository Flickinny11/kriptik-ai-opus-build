/**
 * Audio Input - Audio upload and prompt for audio generation testing
 */

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface AudioInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceAudio?: File | null;
  onReferenceAudioChange: (file: File | null) => void;
  duration?: number;
  onDurationChange?: (value: number) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  mode?: 'text-to-audio' | 'voice-clone' | 'music';
}

export function AudioInput({
  prompt,
  onPromptChange,
  referenceAudio,
  onReferenceAudioChange,
  duration = 10,
  onDurationChange,
  onSubmit,
  isLoading = false,
  mode = 'text-to-audio',
}: AudioInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      onReferenceAudioChange(file);
    }
  }, [onReferenceAudioChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onReferenceAudioChange(file);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Reference Audio Upload */}
      {(mode === 'voice-clone' || mode === 'text-to-audio') && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            isDragging
              ? 'border-cyan-500 bg-cyan-500/10'
              : referenceAudio
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-white/20 hover:border-white/40 bg-white/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {referenceAudio ? (
            <div className="p-4 space-y-3">
              <audio
                ref={audioRef}
                src={URL.createObjectURL(referenceAudio)}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{referenceAudio.name}</p>
                  <p className="text-xs text-white/40">{(referenceAudio.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReferenceAudioChange(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>

              {/* Waveform Preview */}
              <div className="flex items-center gap-0.5 h-8">
                {Array(40).fill(0).map((_, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-cyan-500/60 rounded-full"
                    animate={isPlaying ? {
                      height: [8, Math.random() * 24 + 8, 8],
                    } : { height: 8 }}
                    transition={{
                      duration: 0.4,
                      repeat: isPlaying ? Infinity : 0,
                      delay: i * 0.02,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-white/40">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 1v22M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="mt-2 text-sm">
                {mode === 'voice-clone' ? 'Drop reference voice' : 'Drop audio (optional)'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Text Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={
          mode === 'voice-clone'
            ? 'Enter text to speak in the cloned voice...'
            : mode === 'music'
            ? 'Describe the music you want to generate...'
            : 'Enter text for speech synthesis...'
        }
        rows={3}
        disabled={isLoading}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none disabled:opacity-50"
      />

      {/* Settings */}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        {showSettings ? 'Hide settings' : 'Show settings'}
      </button>

      {showSettings && onDurationChange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <div className="space-y-2">
            <label className="flex justify-between text-sm">
              <span className="text-white/60">Duration (seconds)</span>
              <span className="text-white">{duration}s</span>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={duration}
              onChange={(e) => onDurationChange(parseInt(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </motion.div>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!prompt.trim() || isLoading}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Audio'
        )}
      </button>
    </div>
  );
}

export default AudioInput;
