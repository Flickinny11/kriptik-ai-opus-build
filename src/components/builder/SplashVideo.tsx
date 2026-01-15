/**
 * SplashVideo - Full-screen video splash for Live UI Preview
 * 
 * Shows a looping video until the first build is complete.
 * Video should be placed at: public/videos/kriptik-splash.mp4
 */

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashVideoProps {
  isVisible: boolean;
}

export function SplashVideo({ isVisible }: SplashVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Auto-play and loop the video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVisible) return;

    const handleCanPlay = () => {
      setIsLoaded(true);
      video.play().catch(() => {
        // Auto-play blocked, try muted
        video.muted = true;
        video.play().catch(() => setHasError(true));
      });
    };

    const handleError = () => {
      setHasError(true);
      console.warn('[SplashVideo] Failed to load video. Place video at public/videos/kriptik-splash.mp4');
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a25 50%, #0f0f15 100%)',
        }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          preload="auto"
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
        >
          <source src="/videos/kriptik-splash.mp4" type="video/mp4" />
          <source src="/videos/kriptik-splash.webm" type="video/webm" />
        </video>

        {/* Loading State */}
        {!isLoaded && !hasError && (
          <div className="relative z-20 flex flex-col items-center gap-6">
            {/* Animated Logo */}
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <defs>
                  <linearGradient id="splashGrad" x1="0" y1="0" x2="80" y2="80">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <path
                  d="M40 8L68 24v32L40 72 12 56V24L40 8z"
                  stroke="url(#splashGrad)"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M40 20L56 30v20L40 60 24 50V30L40 20z"
                  fill="url(#splashGrad)"
                  fillOpacity="0.3"
                />
                <circle cx="40" cy="40" r="8" fill="url(#splashGrad)" />
              </svg>
            </motion.div>
            
            {/* Loading Text */}
            <div className="text-center">
              <p 
                className="text-lg font-semibold"
                style={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  letterSpacing: '-0.02em',
                }}
              >
                KripTik AI
              </p>
              <p 
                className="text-sm mt-1"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Ready to build your vision
              </p>
            </div>

            {/* Pulse Ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: '1px solid rgba(245, 158, 11, 0.3)',
                width: '120px',
                height: '120px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          </div>
        )}

        {/* Fallback when no video */}
        {hasError && (
          <div className="relative z-20 flex flex-col items-center gap-6 text-center px-8">
            {/* Animated geometric background */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 20%, rgba(245, 158, 11, 0.15) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, rgba(220, 38, 38, 0.1) 0%, transparent 50%)
                `,
              }}
              animate={{
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Geometric Icon */}
            <motion.svg 
              width="120" 
              height="120" 
              viewBox="0 0 120 120" 
              fill="none"
              className="relative z-10"
              animate={{ rotateZ: [0, 360] }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <defs>
                <linearGradient id="hexGrad" x1="0" y1="0" x2="120" y2="120">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {/* Outer hexagon */}
              <path
                d="M60 10L102 35v50L60 110 18 85V35L60 10z"
                stroke="url(#hexGrad)"
                strokeWidth="1"
                fill="none"
                opacity="0.4"
              />
              {/* Middle hexagon */}
              <path
                d="M60 25L90 42.5v35L60 95 30 77.5v-35L60 25z"
                stroke="url(#hexGrad)"
                strokeWidth="1.5"
                fill="none"
                opacity="0.6"
              />
              {/* Inner hexagon */}
              <path
                d="M60 40L78 50v20L60 80 42 70V50L60 40z"
                fill="url(#hexGrad)"
                fillOpacity="0.2"
                stroke="url(#hexGrad)"
                strokeWidth="2"
              />
              {/* Center dot */}
              <circle cx="60" cy="60" r="4" fill="#dc2626" />
            </motion.svg>

            <div className="relative z-10">
              <h2 
                className="text-2xl font-bold mb-2"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f59e0b 50%, #dc2626 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  letterSpacing: '-0.03em',
                }}
              >
                KripTik AI
              </h2>
              <p 
                className="text-sm max-w-xs"
                style={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                Describe your app in the prompt bar and watch it come to life
              </p>
            </div>

            {/* Animated gradient border */}
            <motion.div
              className="absolute inset-4 rounded-xl pointer-events-none"
              style={{
                border: '1px solid transparent',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(220,38,38,0.2), rgba(245,158,11,0.2)) border-box',
                WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        )}

        {/* Gradient overlay for video blend */}
        {isLoaded && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                linear-gradient(to bottom, rgba(10,10,15,0.3) 0%, transparent 20%, transparent 80%, rgba(10,10,15,0.5) 100%),
                radial-gradient(ellipse at center, transparent 50%, rgba(10,10,15,0.4) 100%)
              `,
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default SplashVideo;
