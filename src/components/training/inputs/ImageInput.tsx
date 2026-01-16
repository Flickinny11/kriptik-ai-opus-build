/**
 * Image Input - Image upload and prompt for image generation testing
 */

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ImageInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  image?: File | null;
  onImageChange: (file: File | null) => void;
  steps?: number;
  onStepsChange?: (value: number) => void;
  guidance?: number;
  onGuidanceChange?: (value: number) => void;
  resolution?: { width: number; height: number };
  onResolutionChange?: (res: { width: number; height: number }) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

const RESOLUTIONS = [
  { width: 512, height: 512, label: '512x512' },
  { width: 768, height: 768, label: '768x768' },
  { width: 1024, height: 1024, label: '1024x1024' },
  { width: 1024, height: 768, label: '1024x768 (Landscape)' },
  { width: 768, height: 1024, label: '768x1024 (Portrait)' },
];

export function ImageInput({
  prompt,
  onPromptChange,
  image,
  onImageChange,
  steps = 30,
  onStepsChange,
  guidance = 7.5,
  onGuidanceChange,
  resolution = { width: 1024, height: 1024 },
  onResolutionChange,
  onSubmit,
  isLoading = false,
}: ImageInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onImageChange(file);
    }
  }, [onImageChange]);

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
      onImageChange(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Upload Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative h-32 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : image
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-white/20 hover:border-white/40 bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {image ? (
          <div className="flex items-center gap-4 p-4 h-full">
            <img
              src={URL.createObjectURL(image)}
              alt="Input"
              className="h-full w-auto rounded-lg object-cover"
            />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{image.name}</p>
              <p className="text-xs text-white/40">{(image.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onImageChange(null);
                }}
                className="mt-2 text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="mt-2 text-sm">Drop image or click to upload</p>
            <p className="text-xs text-white/30">(Optional - for img2img)</p>
          </div>
        )}
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Describe the image you want to generate..."
        rows={3}
        disabled={isLoading}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none disabled:opacity-50"
      />

      {/* Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        {showSettings ? 'Hide settings' : 'Show settings'}
      </button>

      {/* Settings Panel */}
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
            {/* Steps */}
            {onStepsChange && (
              <div className="space-y-2">
                <label className="flex justify-between text-sm">
                  <span className="text-white/60">Steps</span>
                  <span className="text-white">{steps}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="1"
                  value={steps}
                  onChange={(e) => onStepsChange(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            )}

            {/* Guidance */}
            {onGuidanceChange && (
              <div className="space-y-2">
                <label className="flex justify-between text-sm">
                  <span className="text-white/60">Guidance</span>
                  <span className="text-white">{guidance.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={guidance}
                  onChange={(e) => onGuidanceChange(parseFloat(e.target.value))}
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
          'Generate Image'
        )}
      </button>
    </div>
  );
}

export default ImageInput;
