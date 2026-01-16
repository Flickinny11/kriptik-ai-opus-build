/**
 * Image Output - Display image generation results with zoom and download
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageOutputProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  latency?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

export function ImageOutput({
  src,
  alt = 'Generated image',
  width,
  height,
  latency,
  cost,
  metadata,
}: ImageOutputProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleDownload = async () => {
    try {
      const response = await fetch(src, { credentials: 'include' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Image Container */}
        <div className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5">
              <div className="w-8 h-8 border-2 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          )}
          
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            onLoad={() => setIsLoading(false)}
            className="w-full h-auto cursor-zoom-in"
            onClick={() => setIsZoomed(true)}
          />

          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              onClick={() => setIsZoomed(true)}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              title="Zoom"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M11 8v6M8 11h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={handleDownload}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              title="Download"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex flex-wrap gap-4 text-xs text-white/40">
          {width && height && (
            <div className="flex items-center gap-1">
              <span className="text-white/60">{width}x{height}</span>
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
          {metadata?.steps !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-white/60">{String(metadata.steps)}</span>
              <span>steps</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-8"
            onClick={() => setIsZoomed(false)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ImageOutput;
