/**
 * MediaDeck - Premium V-JEPA 2 Visual Timeline Component
 *
 * A $10k-quality media deck for visualizing V-JEPA 2 temporal predictions,
 * state transitions, and visual semantic analysis with layered glass morphism.
 *
 * Features:
 * - 3D layered glass morphism with x/y/z depth perception
 * - Frame-by-frame timeline with prediction confidence
 * - Interactive scrubber with haptic-style feedback
 * - Real-time V-JEPA 2 prediction overlays
 * - State transition visualization
 * - Unique premium fonts (Satoshi, Cabinet Grotesk)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

// ============================================================================
// PREMIUM DESIGN TOKENS
// ============================================================================

const GLASS_DEPTH_TOKENS = {
  // Z-axis depth layers
  depths: {
    background: 'translateZ(-50px)',
    base: 'translateZ(0px)',
    content: 'translateZ(20px)',
    controls: 'translateZ(40px)',
    overlay: 'translateZ(60px)',
    tooltip: 'translateZ(80px)',
  },

  // Glass surfaces with varying blur intensities
  surfaces: {
    deep: {
      blur: 'blur(80px) saturate(200%)',
      bg: 'linear-gradient(145deg, rgba(12,12,16,0.95) 0%, rgba(8,8,12,0.98) 100%)',
      border: 'rgba(255,255,255,0.04)',
    },
    base: {
      blur: 'blur(40px) saturate(180%)',
      bg: 'linear-gradient(145deg, rgba(20,20,25,0.92) 0%, rgba(15,15,20,0.95) 100%)',
      border: 'rgba(255,255,255,0.06)',
    },
    elevated: {
      blur: 'blur(24px) saturate(160%)',
      bg: 'linear-gradient(145deg, rgba(30,30,38,0.88) 0%, rgba(22,22,28,0.92) 100%)',
      border: 'rgba(255,255,255,0.08)',
    },
    floating: {
      blur: 'blur(16px) saturate(150%)',
      bg: 'linear-gradient(145deg, rgba(42,42,52,0.85) 0%, rgba(32,32,40,0.88) 100%)',
      border: 'rgba(255,255,255,0.12)',
    },
  },

  // Premium accent colors
  accents: {
    primary: { h: 165, s: 85, l: 55 }, // Cyan-teal
    success: { h: 140, s: 70, l: 50 }, // Emerald
    warning: { h: 45, s: 95, l: 55 },  // Amber
    error: { h: 0, s: 85, l: 60 },     // Rose
    prediction: { h: 280, s: 75, l: 65 }, // Purple
  },

  // Multi-layer shadows for depth
  shadows: {
    inset: `
      inset 0 1px 1px rgba(255,255,255,0.05),
      inset 0 -1px 2px rgba(0,0,0,0.3)
    `,
    elevated: `
      0 4px 6px rgba(0,0,0,0.3),
      0 10px 20px rgba(0,0,0,0.25),
      0 20px 40px rgba(0,0,0,0.2)
    `,
    floating: `
      0 8px 16px rgba(0,0,0,0.35),
      0 20px 40px rgba(0,0,0,0.3),
      0 40px 80px rgba(0,0,0,0.25),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
    glow: (h: number, s: number, l: number, intensity = 0.3) => `
      0 0 20px hsla(${h}, ${s}%, ${l}%, ${intensity}),
      0 0 40px hsla(${h}, ${s}%, ${l}%, ${intensity * 0.5}),
      0 0 60px hsla(${h}, ${s}%, ${l}%, ${intensity * 0.25})
    `,
  },
};

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineFrame {
  id: string;
  timestamp: number;
  thumbnail?: string;
  state: 'idle' | 'transition' | 'error' | 'predicted';
  confidence: number;
  prediction?: {
    nextState: string;
    probability: number;
    timeToTransition: number;
  };
  semanticLabel?: string;
  embedding?: number[];
}

export interface StateTransition {
  id: string;
  fromFrame: string;
  toFrame: string;
  type: 'user-action' | 'system' | 'predicted' | 'anomaly';
  label: string;
  confidence: number;
}

export interface MediaDeckProps {
  frames: TimelineFrame[];
  transitions?: StateTransition[];
  currentTime?: number;
  duration?: number;
  onFrameSelect?: (frame: TimelineFrame) => void;
  onTimeChange?: (time: number) => void;
  onPlayPause?: (playing: boolean) => void;
  showPredictions?: boolean;
  showEmbeddings?: boolean;
  title?: string;
  className?: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const GlassLayer: React.FC<{
  depth: keyof typeof GLASS_DEPTH_TOKENS.surfaces;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ depth, children, className = '', style }) => {
  const surface = GLASS_DEPTH_TOKENS.surfaces[depth];

  return (
    <div
      className={className}
      style={{
        background: surface.bg,
        backdropFilter: surface.blur,
        WebkitBackdropFilter: surface.blur,
        border: `1px solid ${surface.border}`,
        boxShadow: depth === 'floating'
          ? GLASS_DEPTH_TOKENS.shadows.floating
          : GLASS_DEPTH_TOKENS.shadows.elevated,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const PredictionBadge: React.FC<{
  confidence: number;
  label: string;
}> = ({ confidence, label }) => {
  const accent = GLASS_DEPTH_TOKENS.accents.prediction;
  const isHighConfidence = confidence > 0.8;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        background: `linear-gradient(135deg,
          hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.2) 0%,
          hsla(${accent.h}, ${accent.s}%, ${accent.l - 10}%, 0.15) 100%)`,
        border: `1px solid hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.3)`,
        boxShadow: isHighConfidence
          ? GLASS_DEPTH_TOKENS.shadows.glow(accent.h, accent.s, accent.l, 0.2)
          : 'none',
        fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: `hsl(${accent.h}, ${accent.s}%, ${accent.l + 15}%)`,
        textTransform: 'uppercase',
      }}
    >
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: `hsl(${accent.h}, ${accent.s}%, ${accent.l}%)`,
        boxShadow: `0 0 8px hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.6)`,
      }} />
      {label}
      <span style={{ opacity: 0.7 }}>{Math.round(confidence * 100)}%</span>
    </motion.div>
  );
};

const TimelineScrubber: React.FC<{
  frames: TimelineFrame[];
  currentTime: number;
  duration: number;
  onTimeChange: (time: number) => void;
  showPredictions: boolean;
}> = ({ frames, currentTime, duration, onTimeChange, showPredictions }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(x * duration);
    if (isDragging) {
      onTimeChange(x * duration);
    }
  }, [isDragging, duration, onTimeChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onTimeChange(x * duration);
  }, [duration, onTimeChange]);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const accent = GLASS_DEPTH_TOKENS.accents.primary;

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: '48px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseLeave={() => setHoverTime(null)}
    >
      {/* Track background with frame markers */}
      <GlassLayer
        depth="deep"
        style={{
          position: 'absolute',
          top: '16px',
          left: 0,
          right: 0,
          height: '16px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Frame markers */}
        {frames.map((frame, i) => {
          const position = frame.timestamp / duration;
          const isError = frame.state === 'error';
          const isPredicted = frame.state === 'predicted';

          return (
            <div
              key={frame.id}
              style={{
                position: 'absolute',
                left: `${position * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: isError || isPredicted ? '4px' : '2px',
                height: isError || isPredicted ? '12px' : '8px',
                borderRadius: '2px',
                background: isError
                  ? `hsl(${GLASS_DEPTH_TOKENS.accents.error.h}, ${GLASS_DEPTH_TOKENS.accents.error.s}%, ${GLASS_DEPTH_TOKENS.accents.error.l}%)`
                  : isPredicted && showPredictions
                    ? `hsl(${GLASS_DEPTH_TOKENS.accents.prediction.h}, ${GLASS_DEPTH_TOKENS.accents.prediction.s}%, ${GLASS_DEPTH_TOKENS.accents.prediction.l}%)`
                    : 'rgba(255,255,255,0.2)',
                boxShadow: isError || (isPredicted && showPredictions)
                  ? `0 0 8px ${isError
                      ? `hsla(${GLASS_DEPTH_TOKENS.accents.error.h}, ${GLASS_DEPTH_TOKENS.accents.error.s}%, ${GLASS_DEPTH_TOKENS.accents.error.l}%, 0.5)`
                      : `hsla(${GLASS_DEPTH_TOKENS.accents.prediction.h}, ${GLASS_DEPTH_TOKENS.accents.prediction.s}%, ${GLASS_DEPTH_TOKENS.accents.prediction.l}%, 0.5)`
                    }`
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          );
        })}

        {/* Progress fill */}
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg,
              hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.4) 0%,
              hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.6) 100%)`,
            borderRadius: '8px 0 0 8px',
          }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </GlassLayer>

      {/* Playhead */}
      <motion.div
        style={{
          position: 'absolute',
          left: `${progress * 100}%`,
          top: '8px',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
        animate={{ left: `${progress * 100}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div
          style={{
            width: '16px',
            height: '32px',
            borderRadius: '8px',
            background: `linear-gradient(180deg,
              hsl(${accent.h}, ${accent.s}%, ${accent.l}%) 0%,
              hsl(${accent.h}, ${accent.s}%, ${accent.l - 15}%) 100%)`,
            boxShadow: `
              ${GLASS_DEPTH_TOKENS.shadows.glow(accent.h, accent.s, accent.l, 0.4)},
              0 4px 12px rgba(0,0,0,0.3)
            `,
            border: '2px solid rgba(255,255,255,0.2)',
            cursor: 'grab',
          }}
        />
      </motion.div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoverTime !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              left: `${(hoverTime / duration) * 100}%`,
              bottom: '100%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: GLASS_DEPTH_TOKENS.surfaces.floating.bg,
              backdropFilter: GLASS_DEPTH_TOKENS.surfaces.floating.blur,
              border: `1px solid ${GLASS_DEPTH_TOKENS.surfaces.floating.border}`,
              fontFamily: "'Cabinet Grotesk', 'Satoshi', system-ui, sans-serif",
              fontSize: '12px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {formatTime(hoverTime)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FramePreview: React.FC<{
  frame: TimelineFrame;
  isActive: boolean;
  showPredictions: boolean;
  onClick: () => void;
}> = ({ frame, isActive, showPredictions, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const stateColors = {
    idle: GLASS_DEPTH_TOKENS.accents.primary,
    transition: GLASS_DEPTH_TOKENS.accents.warning,
    error: GLASS_DEPTH_TOKENS.accents.error,
    predicted: GLASS_DEPTH_TOKENS.accents.prediction,
  };

  const stateColor = stateColors[frame.state];

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: '64px',
        height: '48px',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <GlassLayer
        depth={isActive ? 'floating' : 'elevated'}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          border: isActive
            ? `2px solid hsl(${stateColor.h}, ${stateColor.s}%, ${stateColor.l}%)`
            : `1px solid ${GLASS_DEPTH_TOKENS.surfaces.elevated.border}`,
          boxShadow: isActive
            ? GLASS_DEPTH_TOKENS.shadows.glow(stateColor.h, stateColor.s, stateColor.l, 0.3)
            : GLASS_DEPTH_TOKENS.shadows.elevated,
        }}
      >
        {/* Thumbnail or placeholder */}
        {frame.thumbnail ? (
          <img
            src={frame.thumbnail}
            alt={frame.semanticLabel || `Frame ${frame.id}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isActive ? 1 : 0.7,
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg,
              hsla(${stateColor.h}, ${stateColor.s}%, ${stateColor.l}%, 0.1) 0%,
              hsla(${stateColor.h}, ${stateColor.s}%, ${stateColor.l - 20}%, 0.05) 100%)`,
          }}>
            <span style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: '10px',
              fontWeight: 600,
              color: `hsl(${stateColor.h}, ${stateColor.s}%, ${stateColor.l + 20}%)`,
              opacity: 0.7,
            }}>
              {frame.state.toUpperCase()}
            </span>
          </div>
        )}

        {/* State indicator dot */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: `hsl(${stateColor.h}, ${stateColor.s}%, ${stateColor.l}%)`,
            boxShadow: `0 0 8px hsla(${stateColor.h}, ${stateColor.s}%, ${stateColor.l}%, 0.6)`,
          }}
        />

        {/* Confidence bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${frame.confidence * 100}%`,
              background: `hsl(${stateColor.h}, ${stateColor.s}%, ${stateColor.l}%)`,
            }}
          />
        </div>
      </GlassLayer>

      {/* Prediction overlay */}
      {showPredictions && frame.prediction && isHovered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            zIndex: 20,
          }}
        >
          <PredictionBadge
            confidence={frame.prediction.probability}
            label={frame.prediction.nextState}
          />
        </motion.div>
      )}
    </motion.div>
  );
};

const PlaybackControls: React.FC<{
  isPlaying: boolean;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}> = ({ isPlaying, onPlayPause, onStepBack, onStepForward, playbackSpeed, onSpeedChange }) => {
  const accent = GLASS_DEPTH_TOKENS.accents.primary;

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: GLASS_DEPTH_TOKENS.surfaces.elevated.bg,
    backdropFilter: GLASS_DEPTH_TOKENS.surfaces.elevated.blur,
    border: `1px solid ${GLASS_DEPTH_TOKENS.surfaces.elevated.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: 'rgba(255,255,255,0.8)',
  };

  const playButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: `linear-gradient(135deg,
      hsl(${accent.h}, ${accent.s}%, ${accent.l}%) 0%,
      hsl(${accent.h}, ${accent.s}%, ${accent.l - 10}%) 100%)`,
    border: 'none',
    boxShadow: GLASS_DEPTH_TOKENS.shadows.glow(accent.h, accent.s, accent.l, 0.3),
    color: 'white',
  };

  const speeds = [0.5, 1, 1.5, 2];

  return (
    <GlassLayer
      depth="elevated"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '16px',
      }}
    >
      {/* Step back */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStepBack}
        style={buttonStyle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="19 20 9 12 19 4 19 20" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      </motion.button>

      {/* Play/Pause */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPlayPause}
        style={playButtonStyle}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </motion.button>

      {/* Step forward */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStepForward}
        style={buttonStyle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </motion.button>

      {/* Separator */}
      <div style={{
        width: '1px',
        height: '24px',
        background: 'rgba(255,255,255,0.1)',
        margin: '0 4px',
      }} />

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {speeds.map(speed => (
          <motion.button
            key={speed}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSpeedChange(speed)}
            style={{
              ...buttonStyle,
              width: '32px',
              height: '28px',
              borderRadius: '6px',
              background: playbackSpeed === speed
                ? `linear-gradient(135deg,
                    hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.3) 0%,
                    hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.2) 100%)`
                : buttonStyle.background,
              borderColor: playbackSpeed === speed
                ? `hsla(${accent.h}, ${accent.s}%, ${accent.l}%, 0.4)`
                : buttonStyle.borderColor,
              fontFamily: "'Satoshi', system-ui, sans-serif",
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {speed}x
          </motion.button>
        ))}
      </div>
    </GlassLayer>
  );
};

const EmbeddingVisualization: React.FC<{
  embedding: number[];
}> = ({ embedding }) => {
  // Visualize embedding as a radial pattern
  const normalized = embedding.slice(0, 32).map(v => Math.abs(v));
  const max = Math.max(...normalized);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '80px',
      height: '80px',
      position: 'relative',
    }}>
      {normalized.map((val, i) => {
        const angle = (i / normalized.length) * Math.PI * 2;
        const radius = 20 + (val / max) * 15;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.02 }}
            style={{
              position: 'absolute',
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: `hsl(${(i / normalized.length) * 360}, 70%, 60%)`,
              boxShadow: `0 0 6px hsla(${(i / normalized.length) * 360}, 70%, 60%, 0.5)`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}

      {/* Center dot */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.8)',
        boxShadow: '0 0 12px rgba(255,255,255,0.4)',
      }} />
    </div>
  );
};

// ============================================================================
// UTILITIES
// ============================================================================

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MediaDeck: React.FC<MediaDeckProps> = ({
  frames,
  transitions = [],
  currentTime = 0,
  duration = 0,
  onFrameSelect,
  onTimeChange,
  onPlayPause,
  showPredictions = true,
  showEmbeddings = false,
  title,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedFrame, setSelectedFrame] = useState<TimelineFrame | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find active frame based on current time
  const activeFrame = frames.find((frame, i) => {
    const nextFrame = frames[i + 1];
    return frame.timestamp <= currentTime && (!nextFrame || nextFrame.timestamp > currentTime);
  }) || frames[0];

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    onPlayPause?.(!isPlaying);
  }, [isPlaying, onPlayPause]);

  const handleStepBack = useCallback(() => {
    const currentIndex = frames.findIndex(f => f.id === activeFrame?.id);
    if (currentIndex > 0) {
      const prevFrame = frames[currentIndex - 1];
      onTimeChange?.(prevFrame.timestamp);
      setSelectedFrame(prevFrame);
      onFrameSelect?.(prevFrame);
    }
  }, [frames, activeFrame, onTimeChange, onFrameSelect]);

  const handleStepForward = useCallback(() => {
    const currentIndex = frames.findIndex(f => f.id === activeFrame?.id);
    if (currentIndex < frames.length - 1) {
      const nextFrame = frames[currentIndex + 1];
      onTimeChange?.(nextFrame.timestamp);
      setSelectedFrame(nextFrame);
      onFrameSelect?.(nextFrame);
    }
  }, [frames, activeFrame, onTimeChange, onFrameSelect]);

  const handleFrameClick = useCallback((frame: TimelineFrame) => {
    setSelectedFrame(frame);
    onTimeChange?.(frame.timestamp);
    onFrameSelect?.(frame);
  }, [onTimeChange, onFrameSelect]);

  const actualDuration = duration || (frames.length > 0 ? frames[frames.length - 1].timestamp : 0);

  return (
    <div
      className={className}
      style={{
        perspective: '1000px',
        perspectiveOrigin: '50% 50%',
      }}
    >
      {/* Main container with 3D transform context */}
      <GlassLayer
        depth="base"
        style={{
          borderRadius: '24px',
          padding: '24px',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Header */}
        {title && (
          <div style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{
              fontFamily: "'Cabinet Grotesk', 'Satoshi', system-ui, sans-serif",
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.95)',
              margin: 0,
            }}>
              {title}
            </h3>

            {/* V-JEPA 2 badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(100,200,255,0.15) 0%, rgba(80,160,255,0.1) 100%)',
              border: '1px solid rgba(100,200,255,0.2)',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#64c8ff',
                boxShadow: '0 0 8px rgba(100,200,255,0.6)',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: "'Satoshi', system-ui, sans-serif",
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'rgba(100,200,255,0.9)',
                textTransform: 'uppercase',
              }}>
                V-JEPA 2 Temporal
              </span>
            </div>
          </div>
        )}

        {/* Main viewport with selected frame preview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: showEmbeddings && selectedFrame?.embedding ? '1fr 100px' : '1fr',
          gap: '16px',
          marginBottom: '20px',
        }}>
          {/* Frame viewport */}
          <GlassLayer
            depth="deep"
            style={{
              borderRadius: '16px',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {selectedFrame?.thumbnail ? (
              <img
                src={selectedFrame.thumbnail}
                alt={selectedFrame.semanticLabel || 'Frame preview'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
              }}>
                <div style={{
                  fontSize: '40px',
                  marginBottom: '8px',
                  opacity: 0.3,
                }}>
                  ⏱
                </div>
                <span style={{
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                  {activeFrame?.semanticLabel || 'Select a frame to preview'}
                </span>
              </div>
            )}

            {/* Frame info overlay */}
            {activeFrame && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <GlassLayer
                  depth="floating"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.8)',
                  }}>
                    {formatTime(currentTime)}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.4)',
                  }}>
                    /
                  </span>
                  <span style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.5)',
                  }}>
                    {formatTime(actualDuration)}
                  </span>
                </GlassLayer>

                {showPredictions && activeFrame.prediction && (
                  <PredictionBadge
                    confidence={activeFrame.prediction.probability}
                    label={activeFrame.prediction.nextState}
                  />
                )}
              </div>
            )}
          </GlassLayer>

          {/* Embedding visualization */}
          {showEmbeddings && selectedFrame?.embedding && (
            <GlassLayer
              depth="deep"
              style={{
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
              }}
            >
              <span style={{
                fontFamily: "'Satoshi', system-ui, sans-serif",
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '8px',
              }}>
                Embedding
              </span>
              <EmbeddingVisualization embedding={selectedFrame.embedding} />
            </GlassLayer>
          )}
        </div>

        {/* Timeline scrubber */}
        <TimelineScrubber
          frames={frames}
          currentTime={currentTime}
          duration={actualDuration}
          onTimeChange={onTimeChange || (() => {})}
          showPredictions={showPredictions}
        />

        {/* Frame strip */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '8px 0',
            marginTop: '16px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}
        >
          {frames.map(frame => (
            <FramePreview
              key={frame.id}
              frame={frame}
              isActive={activeFrame?.id === frame.id}
              showPredictions={showPredictions}
              onClick={() => handleFrameClick(frame)}
            />
          ))}
        </div>

        {/* Playback controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '16px',
        }}>
          <PlaybackControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            playbackSpeed={playbackSpeed}
            onSpeedChange={setPlaybackSpeed}
          />
        </div>
      </GlassLayer>

      {/* Add pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default MediaDeck;
