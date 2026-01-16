/**
 * Video Input - Video upload and prompt for video generation testing
 */

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface VideoInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceVideo?: File | null;
  onReferenceVideoChange: (file: File | null) => void;
  duration?: number;
  onDurationChange?: (value: number) => void;
  fps?: number;
  onFpsChange?: (value: number) => void;
  resolution?: { width: number; height: number };
  onResolutionChange?: (res: { width: number; height: number }) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

const RESOLUTIONS = [
  { width: 512, height: 512, label: '512x512' },
  { width: 720, height: 480, label: '720x480 (SD)' },
  { width: 1280, height: 720, label: '1280x720 (HD)' },
  { width: 1920, height: 1080, label: '1920x1080 (FHD)' },
];

export function VideoInput({
  prompt,
  onPromptChange,
  referenceVideo,
  onReferenceVideoChange,
  duration = 4,
  onDurationChange,
  fps = 24,
  onFpsChange,
  resolution = { width: 1280, height: 720 },
  onResolutionChange,
  onSubmit,
  isLoading = false,
}: VideoInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onReferenceVideoChange(file);
    }
  }, [onReferenceVideoChange]);

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
      onReferenceVideoChange(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Reference Video Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : referenceVideo
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-white/20 hover:border-white/40 bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {referenceVideo ? (
          <div className="p-4 space-y-3">
            <video
              ref={videoRef}
              src={URL.createObjectURL(referenceVideo)}
              className="w-full h-32 object-cover rounded-lg"
              muted
              loop
              onMouseEnter={() => videoRef.current?.play()}
              onMouseLeave={() => videoRef.current?.pause()}
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">{referenceVideo.name}</p>
                <p className="text-xs text-white/40">{(referenceVideo.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReferenceVideoChange(null);
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-white/40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="10 8 16 12 10 16" fill="currentColor" />
            </svg>
            <p className="mt-2 text-sm">Drop reference video (optional)</p>
          </div>
        )}
      </div>

      {/* Text Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Describe the video you want to generate..."
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

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10"
        >
          {/* Resolution */}
          {onResolutionChange && (
            <div className="space-y-2">
              <label className="text-sm text-white/60">Resolution</label>
              <div className="flex flex-wrap gap-2">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.label}
                    onClick={() => onResolutionChange({ width: res.width, height: res.height })}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      resolution.width === res.width && resolution.height === res.height
                        ? 'bg-cyan-500/30 text-cyan-300'
                        : 'bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            {onDurationChange && (
              <div className="space-y-2">
                <label className="flex justify-between text-sm">
                  <span className="text-white/60">Duration</span>
                  <span className="text-white">{duration}s</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={duration}
                  onChange={(e) => onDurationChange(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            )}

            {/* FPS */}
            {onFpsChange && (
              <div className="space-y-2">
                <label className="flex justify-between text-sm">
                  <span className="text-white/60">FPS</span>
                  <span className="text-white">{fps}</span>
                </label>
                <input
                  type="range"
                  min="12"
                  max="60"
                  step="6"
                  value={fps}
                  onChange={(e) => onFpsChange(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            )}
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
          'Generate Video'
        )}
      </button>
    </div>
  );
}

export default VideoInput;
